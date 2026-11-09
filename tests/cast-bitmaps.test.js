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

const FILES = {
    "power_0.png": { w: 4, h: 3, sha256: "e12b5007c39c857a3f67b1335ae2c368a605dab843aeb768af7627509e11c10e" },
    "power_1.png": { w: 9, h: 9, sha256: "2a5f3625ace600eea58814ceba7a683b6d28ecb9a64a2a949b43e5bfbe6b4c70" },
    "power_2.png": { w: 9, h: 12, sha256: "84a4c9460f2548fb492e3e13286a1ed19abf178286f025cf2df519461c56d0c2" },
    "power_3.png": { w: 9, h: 15, sha256: "8e07502de532acc5044962ef65ac8a3d17540219d750ceca4f05bb013d514c16" },
    "power_4.png": { w: 9, h: 18, sha256: "74e5cfe2ee3fef549c4efcbcfd0f197d5fdd1037ed9aac56de42f88b90137380" },
    "power_5.png": { w: 9, h: 21, sha256: "1121d1c66a9357eac813d2f5afe84d645dc8223b4fce4d203e37e0a6baf305b1" },
    "power_6.png": { w: 9, h: 24, sha256: "d3b81f11e63010cf1a184695968749db24b5d1d86a5cf43bbdda34316b52ffcb" },
    "power_7.png": { w: 9, h: 27, sha256: "8cbcc754d5f45ba4b82c66c0b634a0d5508f39e4ce8f7af7cb4fc1b4833c3e31" },
    "power_8.png": { w: 9, h: 30, sha256: "4fb89fb9a08c3516b0b1278963cdf8c7352666419060b3187326863d222d0b9e" },
    "snowball.png": { w: 11, h: 42, sha256: "6797e1bca1ad8205801949739f8fea11cac1aaa70abc6b6d16d2d0038b958a0d" },
    "drop_0.png": { w: 11, h: 39, sha256: "c0e2ecef32d39e5dff12b4c2cd36564723023fb0bc79c14659306a91043214c7" },
    "drop_1.png": { w: 10, h: 34, sha256: "6965761fdd5b6ad846f74190949d505ebc7aaa61f838fc04e3c40a7d03153458" },
    "drop_2.png": { w: 10, h: 27, sha256: "e84356b557a42607dc39ed41d2b8f4d68e6d617778b2a7a92fb75920dcbb25f7" },
    "drop_3.png": { w: 10, h: 18, sha256: "14e9ec5371e97d8a4cf55af306aa92bc82e5b128ccdc22071af0dae1d21057f5" },
    "splat.png": { w: 16, h: 7, sha256: "3917b36b282ffcdb93705ca3ba9b8f4f0d3b642f67f7bf882e9fceded98f26e2" },
    "melt_0.png": { w: 17, h: 13, sha256: "f8157299b5131582fbda9f206519fde6ec4342ff371d8a8cd3b1929f5d5ea2b8" },
    "melt_1.png": { w: 22, h: 16, sha256: "55016bbc300da18da698de04c9c66cd65d5ae9f096259b59c454e6c096456727" },
    "melt_2.png": { w: 22, h: 16, sha256: "999971e6e67ccc779c1839eb426b4c07ec28c69e101718c790880def41567ef6" },
    "melt_3.png": { w: 22, h: 16, sha256: "da4d6c65ade4c69ebba7c220a3e01bb9016855dc1225fb08c30a8911df99f790" }
};

function pngSize(buf) {
    assert.equal(buf.slice(0, 8).toString("binary"), "\x89PNG\r\n\x1a\n");
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe("recovered BITD cast members", () => {
    it("keeps every power/snowball/drop/melt PNG byte-exact", () => {
        Object.entries(FILES).forEach(([name, expected]) => {
            const buf = fs.readFileSync(path.join(CAST_DIR, name));
            const size = pngSize(buf);
            assert.equal(size.w, expected.w, name + " width");
            assert.equal(size.h, expected.h, name + " height");
            assert.equal(crypto.createHash("sha256").update(buf).digest("hex"), expected.sha256, name);
        });
    });

    it("exposes Director registration points used by the remake", () => {
        assert.deepEqual(P.CAST.snowball.reg, [5, 38]);
        assert.equal(P.CAST.power.length, 9);
        assert.deepEqual(P.CAST.power[8].reg, [-27, 26]);
        assert.equal(P.CAST.drop.length, 4);
        assert.equal(P.CAST.melt.length, 4);
        assert.deepEqual(P.CAST.splat.reg, [8, 3]);
        assert.equal(P.CAST.kids.length, 36);
        assert.deepEqual(P.kidMember("R ready").reg, [15, 28]);
        assert.deepEqual(P.kidMember("shadow").reg, [6, 17]);
        assert.equal(P.kidMembersNamed("G dead").length, 4);
        assert.equal(P.kidMembersNamed("R dead").length, 3);
    });

    it("keeps recovered kid/shadow BITDs byte-exact", () => {
        const meta = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "docs/recovered/kid-bitmaps.json"), "utf8"));
        assert.equal(meta.length, 36);
        meta.forEach((rec) => {
            const buf = fs.readFileSync(path.join(CAST_DIR, rec.file));
            const size = pngSize(buf);
            assert.equal(size.w, rec.w, rec.file + " width");
            assert.equal(size.h, rec.h, rec.file + " height");
            assert.equal(crypto.createHash("sha256").update(buf).digest("hex"), rec.sha256, rec.file);
        });
    });
});

describe("VWSC walk-on paths", () => {
    const walkon = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "src/assets/walkon.json"), "utf8")
    );

    it("replays 10 levels and ends on Event Loop locs", () => {
        assert.equal(walkon.length, 10);
        assert.equal(P.SCORE_WALKON_FPS, 15);
        assert.equal(P.SCORE_BANNER_FPS, 10);
        walkon.forEach((pack, i) => {
            assert.equal(pack.fps, 15, "level " + (i + 1) + " extracted fps stamp");
            assert.equal(P.scoreTempoFps(i + 1), i === 0 ? 15 : 10, "level " + (i + 1) + " score tempo");
            assert.equal(pack.reds.length, 3);
            assert.equal(pack.greens.length, P.LEVELS[i].gd);
            const lastReds = pack.reds.map((path) => {
                const last = path[path.length - 1];
                return { x: last.x, y: last.y };
            });
            const lastGreens = pack.greens.map((path) => {
                const last = path[path.length - 1];
                return { x: last.x, y: last.y };
            });
            assert.deepEqual(lastReds, P.LEVELS[i].reds, "level " + (i + 1) + " reds");
            assert.deepEqual(lastGreens, P.LEVELS[i].greens, "level " + (i + 1) + " greens");
        });
    });

    it("uses BITD sprite rects for matte-style AABB hits", () => {
        const ball = P.memberRect(176, 49, P.CAST.snowball);
        const kid = P.memberRect(176, 49, P.kidMember("G ready"));
        assert.equal(P.rectsOverlap(ball, kid), true);
        const miss = P.memberRect(500, 200, P.CAST.snowball);
        assert.equal(P.rectsOverlap(miss, kid), false);
        assert.equal(P.INK_MATTE, 8);
    });
});
