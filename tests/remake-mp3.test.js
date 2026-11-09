"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { test } = require("node:test");

const root = path.join(__dirname, "..");
const intro = path.join(root, "src/assets/intro.mp3");
const music = path.join(root, "src/assets/musicAlt.mp3");

function assertRemakeMp3(file, { size, sha256, channels, duration }) {
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.length, size, file + " byte length");

    // These LAME assets start with an MPEG-1 Layer III frame without a CRC.
    assert.equal(bytes.readUInt16BE(0), 0xfffb, file + " MPEG header");
    const sampleRate = [44100, 48000, 32000][(bytes[2] >> 2) & 0b11];
    assert.equal(sampleRate, 44100, file + " sample rate");
    const channelCount = (bytes[3] >> 6) === 0b11 ? 1 : 2;
    assert.equal(channelCount, channels, file + " channel count");

    // Xing follows the four-byte header and the MPEG-1 side information.
    const xingOffset = 4 + (channelCount === 1 ? 17 : 32);
    assert.equal(bytes.toString("ascii", xingOffset, xingOffset + 4), "Xing", file + " VBR header");
    assert.ok(bytes.readUInt32BE(xingOffset + 4) & 1, file + " Xing frame count flag");
    const frameCount = bytes.readUInt32BE(xingOffset + 8);
    const durationSeconds = (frameCount * 1152) / sampleRate;
    assert.equal(durationSeconds.toFixed(3), duration, file + " duration");
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), sha256, file + " SHA-256");
}

test("remake intro and BGM stay MP3 at 44.1 kHz with original duration and channels", () => {
    assertRemakeMp3(intro, {
        size: 63245,
        sha256: "5cc5e83d7d66978ed140a3715bf5aead1f730a21f229b4cebfbef2c61118149e",
        channels: 1,
        duration: "5.460"
    });
    assertRemakeMp3(music, {
        size: 1251058,
        sha256: "48415b2b3cf472134fe6ca9cb787e1b7e51b06e1c516793528f8c6af45b3c7bc",
        channels: 2,
        duration: "49.450"
    });
});

test("game still loads remake extras as intro.mp3 and musicAlt.mp3 with looping BGM", () => {
    const game = fs.readFileSync(path.join(root, "src/js/game.js"), "utf8");
    assert.ok(game.includes("this.load.audio('sfx_intro', 'assets/intro.mp3')"));
    assert.ok(game.includes("this.load.audio('music', 'assets/musicAlt.mp3')"));
    assert.ok(game.includes("this.sound.add('music', { loop: true, volume: 0.3 })"));
    assert.ok(game.includes("this.audio.playIntro()"));
    assert.ok(game.includes("this.audio.startMusic()"));
});
