"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const Artwork = require("../js/artwork.js");

function fixture() {
    const originals = new Map();
    const store = new Map();
    const created = [];
    const removed = [];
    const textures = {
        exists: (key) => store.has(key),
        get: (key) => store.get(key),
        remove(key) { removed.push(key); store.delete(key); },
        createCanvas(key, width, height) {
            const calls = [];
            const context = {
                imageSmoothingEnabled: false,
                imageSmoothingQuality: "low",
                clearRect(...args) { calls.push(["clearRect", ...args]); },
                drawImage(...args) { calls.push(["drawImage", ...args]); }
            };
            const source = { width, height };
            const texture = {
                key, width, height, calls, context, filter: null, refreshes: 0,
                get: () => ({ width, height, realWidth: width, realHeight: height, source: { image: source } }),
                getContext: () => context,
                refresh() { this.refreshes++; return this; },
                setFilter(value) { this.filter = value; return this; }
            };
            store.set(key, texture);
            created.push(texture);
            return texture;
        }
    };
    function source(key, width, height, extra = {}) {
        const image = { width, height, pixels: [255, 12, 0, 0, 12, 255, 0, 127] };
        const frame = { width, height, realWidth: width, realHeight: height, cutWidth: width, cutHeight: height, source: { image }, ...extra };
        const texture = { get: () => frame, getSourceImage: () => image, setFilter() { throw new Error("Original filter mutated"); } };
        store.set(key, texture);
        originals.set(key, { image, frame, texture });
        return image;
    }
    source("kid", 26, 34);
    source("throw", 63, 51);
    source("ground", 600, 320);
    source("snowball", 11, 42);
    function image(key = "kid") {
        const object = new EventEmitter();
        Object.assign(object, {
            x: 123, y: 87, originX: 0.4, originY: 0.8,
            visible: false, alpha: 0.37, depth: 17, rotation: 0.4, flipX: true,
            input: { enabled: false, customHitArea: false, hitArea: { width: 26, height: 34 }, cursor: "pointer" },
            setTexture(nextKey) {
                const frame = textures.get(nextKey).get();
                this.texture = { key: nextKey };
                this.width = frame.realWidth;
                this.height = frame.realHeight;
                // Match Phaser's automatic hit rectangle update.
                if (this.input && !this.input.customHitArea) {
                    this.input.hitArea.width = this.width;
                    this.input.hitArea.height = this.height;
                }
                return this;
            },
            setDisplaySize(width, height) {
                this.scaleX = width / this.width;
                this.scaleY = height / this.height;
                return this;
            },
            setOrigin(x, y) { this.originX = x; this.originY = y; return this; }
        });
        Object.defineProperties(object, {
            displayWidth: { get() { return Math.abs(this.width * this.scaleX); } },
            displayHeight: { get() { return Math.abs(this.height * this.scaleY); } }
        });
        object.setTexture(key).setDisplaySize(object.width, object.height);
        return object;
    }
    return { scene: { textures, events: new EventEmitter() }, originals, source, image, created, removed, store };
}

test("original mode registers original texture and dimensions without allocating or altering artwork", () => {
    const f = fixture();
    const manager = Artwork.create(f.scene);
    const kid = f.image();
    const originalPixels = [...f.originals.get("kid").image.pixels];
    assert.equal(manager.apply(kid, "kid"), kid);
    assert.equal(manager.mode, "original");
    assert.equal(kid.snowcraftOriginalTextureKey, "kid");
    assert.equal(kid.texture.key, "kid");
    assert.equal(kid.displayWidth, 26);
    assert.equal(kid.displayHeight, 34);
    assert.equal(f.created.length, 0);
    assert.deepEqual(f.originals.get("kid").image.pixels, originalPixels);
    manager.destroy();
});

test("recovered scenery/effect fallback keeps 4x alpha smoothing and original logical dimensions", () => {
    const f = fixture();
    const manager = Artwork.create(f.scene, "high-resolution");
    for (const key of ["kid", "throw", "ground", "snowball"]) {
        const object = f.image(key);
        manager.apply(object, key);
        const original = f.originals.get(key);
        const derived = f.created.at(-1);
        assert.equal(derived.width, original.image.width * 4);
        assert.equal(derived.height, original.image.height * 4);
        assert.equal(object.displayWidth, original.image.width);
        assert.equal(object.displayHeight, original.image.height);
        assert.equal(derived.context.imageSmoothingEnabled, true);
        assert.equal(derived.context.imageSmoothingQuality, "high");
        assert.deepEqual(derived.calls, [
            ["clearRect", 0, 0, derived.width, derived.height],
            ["drawImage", original.image, 0, 0, original.image.width, original.image.height, 0, 0, derived.width, derived.height]
        ]);
        assert.equal(derived.filter, 0); // Phaser LINEAR
        assert.equal(derived.refreshes, 1);
        assert.equal(f.store.get(key), original.texture);
    }
    manager.destroy();
});

test("redrawn character textures use their own 8x pixels and preserve original custom hit coordinates across switches", () => {
    const f = fixture();
    const key = Artwork.characterTextureKey('kid');
    f.source(key, 26 * 8, 34 * 8);
    let filter;
    f.store.get(key).setFilter = value => { filter = value; };
    const manager = Artwork.create(f.scene);
    const kid = f.image();
    const hit = (shape, x, y) => x >= 0 && x <= shape.width && y >= 0 && y <= shape.height;
    kid.input.customHitArea = true;
    kid.input.hitArea = { width: 26, height: 34 };
    kid.input.hitAreaCallback = hit;
    manager.apply(kid, 'kid');
    manager.setMode('high-resolution');
    assert.equal(kid.texture.key, key);
    assert.equal(kid.width, 208);
    assert.equal(kid.height, 272);
    assert.equal(kid.displayWidth, 26);
    assert.equal(kid.displayHeight, 34);
    assert.equal(f.created.length, 0, 'redrawn sprites are loaded, not interpolated');
    assert.equal(filter, 0);
    assert.equal(manager.hasRedrawn('kid'), true);
    assert.equal(kid.input.hitAreaCallback(kid.input.hitArea, 25 * 8, 33 * 8), true);
    assert.equal(kid.input.hitAreaCallback(kid.input.hitArea, 27 * 8, 33 * 8), false);
    manager.setMode('original');
    assert.equal(kid.texture.key, 'kid');
    assert.equal(kid.input.hitAreaCallback, hit);
    manager.destroy();
    assert.equal(f.store.has(key), true, 'preloaded pack belongs to the scene texture manager');
});

test("mode switches preserve object layout, visibility, alpha, input identity and logical hit bounds", () => {
    const f = fixture();
    const manager = Artwork.create(f.scene);
    const kid = f.image();
    manager.apply(kid, "kid");
    kid.setDisplaySize(52, 68);
    kid.scaleX *= -1;
    const input = kid.input;
    let presses = 0;
    kid.on("pointerdown", () => presses++);
    const state = () => [kid.x, kid.y, kid.originX, kid.originY, kid.visible, kid.alpha, kid.depth, kid.rotation, kid.flipX, kid.displayWidth, kid.displayHeight];
    const before = state();
    for (const mode of ["high-resolution", "original", "high-resolution", "original"]) {
        assert.equal(manager.setMode(mode), manager);
        assert.deepEqual(state(), before);
        assert.equal(kid.input, input);
        assert.equal(kid.input.enabled, false);
        assert.equal(kid.input.cursor, "pointer");
        assert.ok(kid.scaleX < 0);
        assert.equal(kid.input.hitArea.width * Math.abs(kid.scaleX), 52);
        assert.equal(kid.input.hitArea.height * Math.abs(kid.scaleY), 68);
    }
    kid.emit("pointerdown");
    assert.equal(presses, 1);
    assert.equal(kid.texture.key, "kid");
    assert.equal(f.created.length, 1);
    manager.destroy();
});

test("custom hit shapes retain the same logical click target in either artwork mode", () => {
    const f = fixture();
    const manager = Artwork.create(f.scene);
    const kid = f.image();
    const shape = { radius: 12 };
    const hit = (area, x, y) => x * x + y * y <= area.radius * area.radius;
    kid.input.customHitArea = true;
    kid.input.hitArea = shape;
    kid.input.hitAreaCallback = hit;
    manager.apply(kid, "kid");
    manager.setMode("high-resolution");
    assert.equal(kid.input.hitArea, shape);
    assert.equal(kid.input.hitAreaCallback(shape, 11 * 4, 0, kid), true);
    assert.equal(kid.input.hitAreaCallback(shape, 13 * 4, 0, kid), false);
    manager.setMode("original");
    assert.equal(kid.input.hitAreaCallback, hit);
    assert.equal(hit(shape, 11, 0), true);
    assert.equal(hit(shape, 13, 0), false);
    manager.destroy();
});

test("changing animation poses reuses cached textures and switches back to the latest original pose", () => {
    const f = fixture();
    const manager = Artwork.create(f.scene, "high-resolution");
    const kid = f.image();
    manager.apply(kid, "kid");
    manager.apply(kid, "throw");
    assert.equal(kid.displayWidth, 63);
    assert.equal(kid.displayHeight, 51);
    manager.apply(f.image(), "throw");
    manager.apply(kid, "kid");
    manager.apply(kid, "throw");
    assert.equal(f.created.length, 2);
    assert.equal(kid.listenerCount("destroy"), 1);
    manager.setMode("original");
    assert.equal(kid.texture.key, "throw");
    assert.equal(kid.snowcraftOriginalTextureKey, "throw");
    manager.destroy();
});

test("trimmed frames upscale onto transparent original-size canvas without moving the pose", () => {
    const f = fixture();
    f.source("trimmed", 30, 40, { cutX: 5, cutY: 7, cutWidth: 12, cutHeight: 20, x: 3, y: 4 });
    const manager = Artwork.create(f.scene, "high-resolution");
    const kid = f.image();
    manager.apply(kid, "trimmed");
    assert.deepEqual(f.created[0].calls[1].slice(2), [5, 7, 12, 20, 12, 16, 48, 80]);
    assert.equal(kid.displayWidth, 30);
    assert.equal(kid.displayHeight, 40);
    manager.destroy();
});

test("destroyed objects are unregistered; scene shutdown reverts live images and releases derived textures", () => {
    const f = fixture();
    const manager = Artwork.create(f.scene, "high-resolution");
    const dead = f.image();
    const alive = f.image();
    manager.apply(dead, "kid");
    manager.apply(alive, "throw");
    dead.emit("destroy");
    assert.equal(dead.snowcraftOriginalTextureKey, undefined);
    dead.setTexture = () => assert.fail("Destroyed object revisited");
    f.scene.events.emit("shutdown");
    assert.equal(alive.texture.key, "throw");
    assert.equal(alive.snowcraftOriginalTextureKey, undefined);
    assert.equal(alive.listenerCount("destroy"), 0);
    assert.equal(f.removed.length, 2);
    assert.equal(f.scene.events.listenerCount("destroy"), 0);
    assert.equal(f.scene.events.listenerCount("shutdown"), 0);
    assert.ok(f.store.has("kid"));
    assert.ok(f.store.has("throw"));
    manager.destroy();
    assert.throws(() => manager.setMode("original"), /destroyed/);
});

test("shared cache survives one manager disposal until every manager releases it", () => {
    const f = fixture();
    const one = Artwork.create(f.scene, "high-resolution");
    const two = Artwork.create(f.scene, "high-resolution");
    const a = f.image();
    const b = f.image();
    one.apply(a, "kid");
    two.apply(b, "kid");
    assert.equal(f.created.length, 1);
    const derivedKey = b.texture.key;
    one.destroy();
    assert.equal(a.texture.key, "kid");
    assert.equal(b.texture.key, derivedKey);
    assert.ok(f.store.has(derivedKey));
    two.destroy();
    assert.equal(f.store.has(derivedKey), false);
    assert.equal(f.removed.length, 1);
});

test("bad modes/missing source keys fail without registering an object or changing mode", () => {
    const f = fixture();
    assert.throws(() => Artwork.create(f.scene, "redrawn"), /Unknown artwork mode/);
    const manager = Artwork.create(f.scene);
    const kid = f.image();
    assert.throws(() => manager.apply(kid, "missing"), /Missing original artwork/);
    assert.equal(kid.snowcraftOriginalTextureKey, undefined);
    assert.equal(kid.listenerCount("destroy"), 0);
    assert.throws(() => manager.setMode("redrawn"), /Unknown artwork mode/);
    assert.equal(manager.mode, "original");
    manager.destroy();
});
