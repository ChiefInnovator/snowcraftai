"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const assert = require("assert");
const { test } = require("node:test");

const root = path.join(__dirname, "..");
const intro = path.join(root, "src/assets/intro.mp3");
const music = path.join(root, "src/assets/musicAlt.mp3");

function probe(file) {
    const r = spawnSync(
        "ffprobe",
        ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
        { encoding: "utf8" }
    );
    assert.equal(r.status, 0, "ffprobe " + file);
    return JSON.parse(r.stdout);
}

test("remake intro and BGM stay MP3 at 44.1 kHz with original duration and channels", () => {
    assert.equal(fs.statSync(intro).size, 63245);
    assert.equal(fs.statSync(music).size, 1251058);
    assert.equal(fs.readFileSync(intro).subarray(0, 2).toString("hex"), "fffb");
    assert.equal(fs.readFileSync(music).subarray(0, 2).toString("hex"), "fffb");

    const introP = probe(intro);
    const musicP = probe(music);
    assert.equal(introP.streams[0].codec_name, "mp3");
    assert.equal(musicP.streams[0].codec_name, "mp3");
    assert.equal(introP.streams[0].sample_rate, "44100");
    assert.equal(musicP.streams[0].sample_rate, "44100");
    assert.equal(introP.streams[0].channels, 1);
    assert.equal(musicP.streams[0].channels, 2);
    assert.equal(Number(introP.format.duration).toFixed(3), "5.460");
    assert.equal(Number(musicP.format.duration).toFixed(3), "49.450");
});

test("game still loads remake extras as intro.mp3 and musicAlt.mp3 with looping BGM", () => {
    const game = fs.readFileSync(path.join(root, "src/js/game.js"), "utf8");
    assert.ok(game.includes("this.load.audio('sfx_intro', 'assets/intro.mp3')"));
    assert.ok(game.includes("this.load.audio('music', 'assets/musicAlt.mp3')"));
    assert.ok(game.includes("this.sound.add('music', { loop: true, volume: 0.3 })"));
    assert.ok(game.includes("this.audio.playIntro()"));
    assert.ok(game.includes("this.audio.startMusic()"));
});
