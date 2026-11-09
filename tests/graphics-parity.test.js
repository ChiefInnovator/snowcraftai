"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function loadParity() {
    const src = fs.readFileSync(path.join(__dirname, "..", "src", "js", "parity.js"), "utf8");
    const module = { exports: {} };
    const globalThis = global;
    eval(src);
    return module.exports;
}

const P = loadParity();
const CAST_DIR = path.join(__dirname, "..", "src", "assets", "cast");
const UI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "docs", "recovered", "ui-bitmaps.json"), "utf8")
);

function pngSize(buf) {
    assert.equal(buf.slice(0, 8).toString("binary"), "\x89PNG\r\n\x1a\n");
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe("Director stage geometry", () => {
    it("uses DRCF 592×320 with ground BITD 600×320 at loc (296,160)", () => {
        assert.equal(P.STAGE_W, 592);
        assert.equal(P.STAGE_H, 320);
        assert.deepEqual(P.CAST.ground.loc, [296, 160]);
        assert.deepEqual(P.CAST.ground.reg, [300, 160]);
        assert.equal(P.CAST.ground.w, 600);
        assert.equal(P.CAST.ground.h, 320);
        assert.equal(P.CAST.ground.ink, 0);
        const left = P.CAST.ground.loc[0] - P.CAST.ground.reg[0];
        const right = left + P.CAST.ground.w;
        assert.equal(left, -4);
        assert.equal(right, 596);
    });
});

describe("recovered 8-bit UI BITDs", () => {
    it("keeps ground, SnowCraft title, Level, digits 2–4, and Bonus Round byte-exact", () => {
        UI.forEach((rec) => {
            const buf = fs.readFileSync(path.join(CAST_DIR, rec.file));
            const size = pngSize(buf);
            assert.equal(size.w, rec.w, rec.file + " width");
            assert.equal(size.h, rec.h, rec.file + " height");
            assert.equal(crypto.createHash("sha256").update(buf).digest("hex"), rec.sha256, rec.file);
        });
        assert.deepEqual(P.CAST.title.loc, [296, 160]);
        assert.deepEqual(P.CAST.levelWord.loc, [286, 160]);
        assert.deepEqual(P.CAST.levelDigit[2].loc, [326, 160]);
        assert.deepEqual(P.CAST.bonusRound.loc, [285, 160]);
    });
});

describe("matte pixel intersects", () => {
    it("requires overlapping opaque pixels, not only AABB", () => {
        const a = { w: 2, h: 2, bits: Uint8Array.from([1, 0, 0, 0]) };
        const b = { w: 2, h: 2, bits: Uint8Array.from([0, 0, 0, 1]) };
        const cast = { w: 2, h: 2, reg: [0, 0] };
        assert.equal(P.rectsOverlap(P.memberRect(0, 0, cast), P.memberRect(0, 0, cast)), true);
        assert.equal(P.mattesOverlap(0, 0, cast, a, 0, 0, cast, b), false);
        const c = { w: 2, h: 2, bits: Uint8Array.from([1, 0, 0, 0]) };
        assert.equal(P.mattesOverlap(0, 0, cast, a, 0, 0, cast, c), true);
    });
});
