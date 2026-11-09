"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function loadParity() {
    const src = fs.readFileSync(path.join(__dirname, "..", "src", "js", "parity.js"), "utf8");
    const module = { exports: {} };
    const globalThis = global;
    eval(src);
    return module.exports;
}

const P = loadParity();
const html = fs.readFileSync(path.join(__dirname, "..", "src", "index.html"), "utf8");
const gameSrc = fs.readFileSync(path.join(__dirname, "..", "src", "js", "game.js"), "utf8");

describe("Rich display scaler", () => {
    it("keeps the 600×320 1×–3× options and fit-to-window", () => {
        assert.match(html, /id="scale-select"/);
        assert.match(html, /<option value="0" selected>Fit to window<\/option>/);
        assert.match(html, /<option value="1">600 x 320 \(1x\)<\/option>/);
        assert.match(html, /<option value="1.5">900 x 480 \(1.5x\)<\/option>/);
        assert.match(html, /<option value="2">1200 x 640 \(2x\)<\/option>/);
        assert.match(html, /<option value="2.5">1500 x 800 \(2.5x\)<\/option>/);
        assert.match(html, /<option value="3">1800 x 960 \(3x\)<\/option>/);
        assert.equal(P.DISPLAY_BASE_W, 600);
        assert.equal(P.DISPLAY_BASE_H, 320);
        assert.equal(P.STAGE_W, 592);
        assert.equal(P.STAGE_H, 320);
    });

    it("sizes the container as multiples of 600×320 without changing stage geometry", () => {
        const one = P.computeDisplayLayout(1, 1920, 1080, 1);
        assert.deepEqual(one, { width: 600, height: 320, renderScale: 1 });
        const two = P.computeDisplayLayout(2, 1920, 1080, 1);
        assert.deepEqual(two, { width: 1200, height: 640, renderScale: 2 });
        const oneFive = P.computeDisplayLayout(1.5, 1920, 1080, 1);
        assert.deepEqual(oneFive, { width: 900, height: 480, renderScale: 2 });
        const hidpi = P.computeDisplayLayout(1, 1920, 1080, 2);
        assert.deepEqual(hidpi, { width: 600, height: 320, renderScale: 2 });
        const fit = P.computeDisplayLayout(0, 1040, 870, 1);
        assert.equal(fit.width, 1000);
        assert.equal(fit.height, 533);
        assert.equal(fit.renderScale, 2);
    });

    it("maps world coordinates uniformly through Phaser FIT at each scale", () => {
        [1, 1.5, 2, 2.5, 3].forEach((scale) => {
            const layout = P.computeDisplayLayout(scale, 1920, 1080, 1);
            const css = P.fitCanvasCssSize(layout.width, layout.height, P.STAGE_W, P.STAGE_H);
            assert.ok(Math.abs(css.width / css.height - P.STAGE_W / P.STAGE_H) < 1e-9, "aspect " + scale);
            assert.equal(css.height, layout.height);
            const kid = { x: 508, y: 192 };
            const screen = P.worldToCanvasCss(kid.x, kid.y, css.width, css.height, P.STAGE_W, P.STAGE_H);
            const back = P.canvasCssToWorld(screen.x, screen.y, css.width, css.height, P.STAGE_W, P.STAGE_H);
            assert.ok(Math.abs(back.x - kid.x) < 1e-9, "x round-trip " + scale);
            assert.ok(Math.abs(back.y - kid.y) < 1e-9, "y round-trip " + scale);
            const mid = P.canvasCssToWorld(css.width / 2, css.height / 2, css.width, css.height, P.STAGE_W, P.STAGE_H);
            assert.ok(Math.abs(mid.x - P.STAGE_W / 2) < 1e-9);
            assert.ok(Math.abs(mid.y - P.STAGE_H / 2) < 1e-9);
        });
    });

    it("keeps pixelArt scaling and does not add a new smoothing mode", () => {
        assert.match(gameSrc, /pixelArt:\s*true/);
        assert.equal(gameSrc.includes("roundPixels"), false);
        assert.equal(gameSrc.includes("antialias: false"), false);
        assert.match(gameSrc, /mode:\s*Phaser\.Scale\.FIT/);
        assert.match(gameSrc, /changeScale\(/);
        assert.match(gameSrc, /computeDisplayLayout\(/);
    });
});
