"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function loadParity() {
    const src = fs.readFileSync(path.join(__dirname, "..", "src", "js", "parity.js"), "utf8");
    const module = { exports: {} };
    const globalThis = global;
    eval(src); // same realm so deepEqual sees ordinary objects
    return module.exports;
}

const P = loadParity();
const layouts = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "docs", "recovered", "event-loop-layouts.json"), "utf8")
);

describe("recovered Event Loop layouts", () => {
    it("has 10 Event Loop frames with gd 3,5,7,9, then 12×6", () => {
        assert.equal(layouts.length, 10);
        assert.equal(P.LEVELS.length, 10);
        assert.deepEqual(P.LEVELS.map((l) => l.gd), [3, 5, 7, 9, 12, 12, 12, 12, 12, 12]);
    });

    it("matches VWSC green/red loc for every level", () => {
        layouts.forEach((frame, i) => {
            const level = P.LEVELS[i];
            assert.equal(frame.greens.length, level.gd, `level ${i + 1} gd`);
            assert.deepEqual(
                frame.greens.map((g) => ({ x: g.x, y: g.y })),
                level.greens
            );
            assert.deepEqual(
                frame.reds.map((r) => ({ x: r.x, y: r.y })),
                level.reds
            );
        });
    });

    it("keeps reds at the usual three spots except level 10", () => {
        const usual = [{ x: 508, y: 192 }, { x: 377, y: 268 }, { x: 484, y: 282 }];
        for (let i = 0; i < 9; i++) {
            assert.deepEqual(P.LEVELS[i].reds, usual);
        }
        assert.deepEqual(P.LEVELS[9].reds, [
            { x: 408, y: 221 }, { x: 346, y: 257 }, { x: 290, y: 300 }
        ]);
    });
});

describe("Lingo movement and throws", () => {
    it("uses loc += myDirection of (2,1) / (1,2) and edge (4,1)/(1,4)", () => {
        assert.deepEqual(P.walkAxisDirection(1), { x: 2, y: 1 });
        assert.deepEqual(P.walkAxisDirection(-1), { x: -2, y: -1 });
        assert.deepEqual(P.sideStepDirection(1), { x: 1, y: 2 });
        assert.deepEqual(P.edgeSteer(10, 80, { x: -2, y: -1 }), { x: 4, y: 1 });
        assert.deepEqual(P.edgeSteer(80, 10, { x: 2, y: 1 }), { x: 1, y: 4 });
        assert.deepEqual(P.edgeSteer(80, 80, { x: 2, y: 1 }), { x: 2, y: 1 });
    });

    it("uses the original centre line x = 2*(320 − y)", () => {
        assert.equal(P.centreLineY(0), 320);
        assert.equal(P.centreLineY(640), 0);
        assert.equal(P.onRedSide(508, 192), true);
        assert.equal(P.onRedSide(176, 49), false);
    });

    it("steps snowballs (±20,±10) then drop (±10,±5)", () => {
        assert.deepEqual(P.ballStepForTeam("player"), { x: -20, y: -10 });
        assert.deepEqual(P.ballStepForTeam("cpu"), { x: 20, y: 10 });
        assert.deepEqual(P.dropStepForTeam("player"), { x: -10, y: -5 });
        assert.equal(P.throwRangeSteps(8), 16);
        assert.equal(P.throwRangeSteps(0), 0);
        assert.equal(P.flightHitSteps(8), 15);
        assert.equal(P.flightHitSteps(0), 0);
        assert.equal(P.DROP_STEPS, 4);
        assert.equal(P.MELT_STEPS, 4);
    });

    it("charges power as (timer / 5) clamped 0–8", () => {
        assert.equal(P.powerFromHoldMs(0), 0);
        assert.equal(P.powerFromHoldMs(83), 0);
        assert.equal(P.powerFromHoldMs(84), 1);
        assert.equal(P.powerFromHoldMs(670), 8);
        assert.equal(P.powerFromHoldMs(5000), 8);
    });
});

describe("scoring", () => {
    it("adds gd on a clear and multiplies on a loss", () => {
        assert.equal(P.scoreOnLevelWin(0, 3), 3);
        assert.equal(P.scoreOnLevelWin(3, 5), 8);
        assert.equal(P.scoreOnGameOver(8, 2, 3), 30);
        assert.equal(P.scoreOnVictory(96), 1000);
        assert.equal(P.scoreOnVictory(80), 800);
    });
});
