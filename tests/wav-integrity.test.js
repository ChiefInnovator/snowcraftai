"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");
const { test } = require("node:test");

const root = path.join(__dirname, "..");
const inventory = JSON.parse(
    fs.readFileSync(path.join(root, "assets/sounds/inventory.json"), "utf8")
);

function wavPcmSha256(filePath) {
    const buf = fs.readFileSync(filePath);
    assert.equal(buf.slice(0, 4).toString("ascii"), "RIFF");
    assert.equal(buf.slice(8, 12).toString("ascii"), "WAVE");
    const dataIdx = buf.indexOf(Buffer.from("data"));
    assert.ok(dataIdx > 0, "WAV data chunk");
    const dataSize = buf.readUInt32LE(dataIdx + 4);
    const pcm = buf.slice(dataIdx + 8, dataIdx + 8 + dataSize);
    return {
        sha: crypto.createHash("sha256").update(pcm).digest("hex"),
        channels: buf.readUInt16LE(22),
        sampleRate: buf.readUInt32LE(24),
        bits: buf.readUInt16LE(34),
        byteLength: pcm.length
    };
}

test("all 16 original WAVs are present with exact PCM bytes and header rates", () => {
    assert.equal(inventory.sounds.length, 16);
    for (const rec of inventory.sounds) {
        const filePath = path.join(root, "assets/sounds", rec.file);
        assert.ok(fs.existsSync(filePath), rec.file);
        const info = wavPcmSha256(filePath);
        assert.equal(info.sha, rec.sha256_pcm, rec.file + " PCM hash");
        assert.equal(info.sampleRate, rec.sample_rate, rec.file + " sample rate");
        assert.equal(info.channels, 1);
        assert.equal(info.bits, 8);
    }
});
