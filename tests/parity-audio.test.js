"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { test } = require("node:test");

const root = path.join(__dirname, "..");
const Parity = require(path.join(root, "js/snowcraft-parity.js"));
const Audio = require(path.join(root, "js/snowcraft-audio.js"));

test("every recovered original sound except Uh is wired to an event", () => {
    const wired = new Set(Parity.expectedWiredSoundIds());
    for (const file of Object.values(Parity.SOUND_FILES)) {
        assert.ok(fs.existsSync(path.join(root, file)), file);
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
    assert.equal(Parity.UNUSED_CAST_SOUNDS.length, 1);
    assert.equal(Parity.UNUSED_CAST_SOUNDS[0].cast_member_name, "Uh");
    assert.ok(fs.existsSync(path.join(root, Parity.UNUSED_CAST_SOUNDS[0].file)));
});

test("index.html wires each original event and does not load placeholder mp3s", () => {
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
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
        assert.ok(html.includes(snippet), "missing " + snippet);
    }
    assert.ok(!html.includes("assets/throw.mp3"));
    assert.ok(!html.includes("assets/hit1.mp3"));
    assert.ok(!html.includes("assets/deathHit.mp3"));
    assert.ok(!html.includes("assets/intro.mp3"));
    assert.ok(!html.includes("assets/musicAlt.mp3"));
    assert.ok(!html.includes("detune"));
    assert.ok(html.includes("js/snowcraft-parity.js"));
    assert.ok(html.includes("js/snowcraft-audio.js"));
    assert.ok(html.includes('id="mute-checkbox"'));
    assert.ok(html.includes("const START_LEVEL = 1"));
    assert.ok(html.includes("restartMatch"));
    assert.ok(html.includes("whenChannelIdle"), "nextLevel/ridicule wait for soundBusy(1)");
    assert.ok(!html.includes("delayedCall(2200, () => this.playOriginalEvent('game_over'))"));
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

test("original hit counts, power, isometric step, and scoring", () => {
    assert.equal(Parity.hitsToKo("player"), 2);
    assert.equal(Parity.hitsToKo("cpu"), 3);
    assert.equal(Parity.powerFromHoldMs(0), 0);
    assert.equal(Parity.powerFromHoldMs(5 * Parity.TICK_MS), 1);
    assert.equal(Parity.powerFromHoldMs(40 * Parity.TICK_MS), 8);
    assert.deepEqual(Parity.ballStepForTeam("player"), { x: -20, y: -10 });
    assert.deepEqual(Parity.ballStepForTeam("cpu"), { x: 20, y: 10 });
    assert.equal(Parity.greenCountForLevel(1), 3);
    assert.equal(Parity.greenCountForLevel(2), 5);
    assert.equal(Parity.greenCountForLevel(6), 12);
    assert.equal(Parity.scoreOnLevelWin(4, 5), 9);
    assert.equal(Parity.scoreOnGameOver(4, 2, 3), 18);
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
