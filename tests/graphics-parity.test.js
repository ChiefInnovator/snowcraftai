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

describe("recovered UI BITDs", () => {
    it("keeps ground, title, Level, digits 2–9, Bonus Round, logo, Congratulations, and Play Again byte-exact", () => {
        assert.equal(UI.length, 15);
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
        assert.deepEqual(P.CAST.levelDigit[5].loc, [326, 160]);
        assert.deepEqual(P.CAST.levelDigit[5].castReg, [54, 12]);
        assert.deepEqual(P.CAST.levelDigit[9].castReg, [-41, 11]);
        assert.equal(P.CAST.levelDigit[5].loc[0] - P.CAST.levelDigit[5].reg[0], P.DIGIT_SLOT_LEFT);
        assert.equal(P.CAST.levelDigit[2].loc[0] - P.CAST.levelDigit[2].reg[0], P.DIGIT_SLOT_LEFT);
        assert.deepEqual(P.CAST.bonusRound.loc, [285, 160]);
        assert.deepEqual(P.CAST.logo.loc, [296, 140]);
        assert.deepEqual(P.CAST.congrats.loc, [295, 160]);
        assert.deepEqual(P.CAST.playAgain.loc, [292, 160]);
        assert.deepEqual(P.CAST.playAgain.victoryLoc, [296, 160]);
        assert.deepEqual(P.CAST.playAgain.reg, [-216, -138]);
    });
});

describe("score UI timing from VWSC", () => {
    it("uses 15 fps on level 1 and 10 fps on later banners", () => {
        assert.equal(P.scoreTempoFps(1), 15);
        assert.equal(P.scoreTempoFps(2), 10);
        assert.equal(P.scoreTempoFps(11), 10);
        assert.deepEqual(P.bannerTiming(1), { fps: 15, fadeIn: 15, hold: 7, fadeOut: 4 });
        assert.deepEqual(P.bannerTiming(5), { fps: 10, fadeIn: 0, hold: 1, fadeOut: 10 });
        assert.deepEqual(P.SCORE_UI.congrats, { fps: 10, fadeIn: 11, hold: 2, fadeOut: 14 });
        assert.deepEqual(P.SCORE_UI.logoVictory, { fps: 10, fadeIn: 9, hold: 0, fadeOut: 0 });
        assert.equal(P.directorBlendToAlpha(255), 0);
        assert.equal(P.directorBlendToAlpha(0), 1);
        assert.equal(P.framesToMs(11, 10), 1100);
        assert.deepEqual(P.CAST.levelDigit[5].reg, [-30, 12]);
        assert.deepEqual(P.CAST.levelDigit[8].reg, [-30, 11]);
        assert.deepEqual(P.SCORE_UI.playAgain, { fps: 10, fadeIn: 5 });
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
