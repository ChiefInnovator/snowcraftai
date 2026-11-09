"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { test } = require("node:test");

const root = path.join(__dirname, "..");

function loadScript(rel) {
    const src = fs.readFileSync(path.join(root, rel), "utf8");
    const module = { exports: {} };
    const globalThis = global;
    eval(src);
    return module.exports;
}

const Parity = loadScript("src/js/parity.js");
global.SnowcraftParity = Parity;
const Audio = loadScript("src/js/audio.js");

test("every shipped original sound is wired to an event", () => {
    const wired = new Set(Parity.expectedWiredSoundIds());
    for (const file of Object.values(Parity.SOUND_FILES)) {
        assert.ok(fs.existsSync(path.join(root, "src", file)), file);
    }
    assert.deepEqual([...wired].sort(), [
        "ahhhh",
        "bird_tweets",
        "halaluja",
        "hit1",
        "hit2",
        "kids1",
        "kids2",
        "kids3",
        "laugh",
        "short_chirps",
        "splat",
        "step",
        "ugly",
        "whoosh",
        "whoosh_percussive"
    ]);
    const shipped = fs.readdirSync(path.join(root, "src/assets/sounds")).filter(f => f.endsWith(".wav"));
    assert.equal(shipped.length, Object.keys(Parity.SOUND_FILES).length, "no unused WAVs shipped");
});

test("src/index.html wires original events, mute, and does not load synthesized sfx", () => {
    const html = fs.readFileSync(path.join(root, "src/index.html"), "utf8");
    const game = fs.readFileSync(path.join(root, "src/js/game.js"), "utf8");
    const required = [
        "playOriginalEvent('throw'",
        "playOriginalEvent('person_impact'",
        "playOriginalEvent('ground_land'",
        "playOriginalEvent('walk_step'",
        "playOriginalEvent('red_stun'",
        "playOriginalEvent('red_death'",
        "playOriginalEvent('green_second_hit'",
        "playOriginalEvent('green_death'",
        "playOriginalEvent('dead_hover'",
        "playOriginalEvent('level_clear'",
        "playOriginalEvent('game_over'"
    ];
    for (const snippet of required) {
        assert.ok(game.includes(snippet), "missing " + snippet);
    }
    assert.ok(!game.includes("assets/sfx/"));
    assert.ok(html.includes("js/parity.js"));
    assert.ok(html.includes("js/audio.js"));
    assert.ok(html.includes('id="mute-checkbox"'));
    assert.ok(game.includes("whenSfxIdle"));
    assert.ok(game.includes("kid.isImmune = true"));
    assert.ok(game.includes("this.audio.playIntro()"));
    assert.ok(game.includes("this.audio.startMusic()"));
    assert.ok(!/this\.sound\.play\(\s*['"]sfx_intro['"]/.test(game));
});

test("throw whoosh mapping follows myRange = 16 (power 8)", () => {
    for (let p = 0; p < 8; p++) {
        assert.equal(Parity.throwSoundId(p), "whoosh_percussive");
    }
    assert.equal(Parity.throwSoundId(8), "whoosh");
    assert.equal(Parity.throwRangeSteps(8), 16);
    assert.equal(Parity.throwRangeSteps(0), 0);
});

test("level-clear ugly/halaluja split is mouseH 280", () => {
    assert.equal(Parity.levelClearSoundId(0), "ugly");
    assert.equal(Parity.levelClearSoundId(279), "ugly");
    assert.equal(Parity.levelClearSoundId(280), "halaluja");
    assert.equal(Parity.levelClearSoundId(599), "halaluja");
});

test("kids death concatenates kids + random(3)", () => {
    assert.equal(Parity.kidsDeathSoundId(1), "kids1");
    assert.equal(Parity.kidsDeathSoundId(2), "kids2");
    assert.equal(Parity.kidsDeathSoundId(3), "kids3");
});

test("channel-1 idle gate, mute, and restart prevent spam and leftover playback", () => {
    const playing = new Set();
    const started = [];
    const adapter = {
        play: function (id) {
            playing.add(id);
            started.push(id);
            return { durationMs: 500 };
        },
        stop: function () {
            playing.clear();
        },
        stopAll: function () {
            playing.clear();
        },
        isPlaying: function () {
            return playing.size > 0;
        }
    };
    const audio = Audio.createSnowcraftAudio(adapter);
    audio.unlock();

    assert.equal(audio.playEvent("walk_step"), true);
    assert.equal(audio.playEvent("walk_step"), false, "step skipped while channel busy");
    assert.equal(audio.playEvent("ground_land"), false, "splat skipped while channel busy");
    assert.equal(audio.playEvent("person_impact"), true, "hit1 replaces channel 1");
    assert.equal(started[started.length - 1], "hit1");

    audio.setMuted(true);
    const beforeMute = started.length;
    assert.equal(audio.playEvent("red_death"), false);
    assert.equal(started.length, beforeMute);
    assert.equal(playing.size, 0);

    audio.setMuted(false);
    audio.restart();
    assert.equal(playing.size, 0);
    assert.equal(audio.getPlayLog().length, 0);
    assert.equal(audio.playEvent("throw", { power: 8 }), true);
    assert.equal(audio.getPlayLog()[0].soundId, "whoosh");
});

test("whenIdle fires after channel 1 goes quiet", async () => {
    let playing = true;
    const audio = Audio.createSnowcraftAudio({
        play: function () { return { durationMs: 0 }; },
        stop: function () {},
        stopAll: function () {},
        isPlaying: function () { return playing; }
    });
    audio.unlock();
    assert.equal(audio.playEvent("person_impact"), true);
    let fired = 0;
    const queue = [];
    audio.whenIdle(() => { fired += 1; }, (cb) => queue.push(cb));
    assert.equal(fired, 0);
    playing = false;
    await new Promise((r) => setTimeout(r, 30));
    while (queue.length) queue.shift()();
    assert.equal(fired, 1);
});

test("mute pauses music and unmute resumes it; intro respects mute", () => {
    const playing = new Set();
    const calls = [];
    const adapter = {
        play: function (id) {
            playing.add(id);
            return { durationMs: 100 };
        },
        stop: function () {
            playing.clear();
            calls.push("stop");
        },
        stopAll: function () {
            playing.clear();
            calls.push("stopAll");
        },
        pauseMusic: function () { calls.push("pauseMusic"); },
        resumeMusic: function () { calls.push("resumeMusic"); },
        playIntro: function () { calls.push("playIntro"); },
        playMusic: function () { calls.push("playMusic"); },
        isPlaying: function () { return playing.size > 0; }
    };
    const audio = Audio.createSnowcraftAudio(adapter);
    audio.unlock();

    assert.equal(audio.playIntro(), true);
    assert.equal(audio.startMusic(), true);
    assert.deepEqual(calls, ["playIntro", "playMusic"]);
    assert.equal(audio.getState().musicWanted, true);

    audio.setMuted(true);
    assert.ok(calls.includes("pauseMusic"));
    assert.ok(!calls.includes("stopAll"), "mute must not stopAll/kill BGM");
    assert.equal(audio.playIntro(), false);
    assert.equal(audio.startMusic(), false);
    assert.ok(audio.getSkippedLog().filter((r) => r.reason === "muted").length >= 2);

    audio.setMuted(false);
    assert.ok(calls.includes("resumeMusic"));
    assert.equal(audio.getState().musicWanted, true);
});

test("autoplay lock skips playback until unlock", () => {
    const started = [];
    const audio = Audio.createSnowcraftAudio({
        play: function (id) {
            started.push(id);
            return { durationMs: 10 };
        },
        stopAll: function () {},
        isPlaying: function () { return false; }
    });
    assert.equal(audio.playEvent("throw", { power: 3 }), false);
    assert.equal(started.length, 0);
    audio.unlock();
    assert.equal(audio.playEvent("throw", { power: 3 }), true);
    assert.equal(started[0], "whoosh_percussive");
});
