/**
 * Optional 4x canvas interpolation of the SAME recovered artwork. This smooths
 * existing pixels; it cannot recover or invent detail missing from the originals.
 * Source textures stay byte-for-byte intact, including those used for mattes.
 */
(function (root, factory) {
    root.SnowcraftArtwork = factory(root);
    if (typeof module !== "undefined" && module.exports) module.exports = root.SnowcraftArtwork;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
    "use strict";

    const SCALE = 4;
    const SUFFIX = "__snowcraft_smooth4x";
    const caches = new WeakMap();

    function checkedMode(mode) {
        if (mode !== "original" && mode !== "high-resolution") {
            throw new RangeError("Unknown artwork mode: " + mode);
        }
        return mode;
    }

    function create(scene, initialMode = "original") {
        let mode = checkedMode(initialMode);
        let destroyed = false;
        const textures = scene.textures;
        const images = new Map();
        const acquired = new Set();
        if (!caches.has(textures)) caches.set(textures, new Map());
        const cache = caches.get(textures);

        function sourceSpec(key) {
            if (!textures.exists(key)) throw new Error("Missing original artwork: " + key);
            const texture = textures.get(key);
            const frame = texture.get();
            const source = frame.source && frame.source.image || texture.getSourceImage();
            return {
                frame: frame, source: source,
                width: frame.realWidth || frame.width || source.width,
                height: frame.realHeight || frame.height || source.height
            };
        }

        function derivedKey(key, spec) {
            let entry = cache.get(key);
            if (!entry) {
                let derived = key + SUFFIX;
                for (let n = 1; textures.exists(derived); n++) derived = key + SUFFIX + "_" + n;
                const texture = textures.createCanvas(derived, spec.width * SCALE, spec.height * SCALE);
                const ctx = texture.getContext();
                const frame = spec.frame;
                const cutW = frame.cutWidth || frame.width || spec.width;
                const cutH = frame.cutHeight || frame.height || spec.height;
                // A fresh transparent canvas keeps antialiased alpha edges intact.
                ctx.clearRect(0, 0, spec.width * SCALE, spec.height * SCALE);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(spec.source, frame.cutX || 0, frame.cutY || 0, cutW, cutH,
                    (frame.x || 0) * SCALE, (frame.y || 0) * SCALE, cutW * SCALE, cutH * SCALE);
                texture.refresh();
                const filters = root.Phaser && root.Phaser.Textures && root.Phaser.Textures.FilterMode;
                texture.setFilter(filters ? filters.LINEAR : 0);
                entry = { key: derived, owners: new Set() };
                cache.set(key, entry);
            }
            entry.owners.add(manager);
            acquired.add(key);
            return entry.key;
        }

        function render(image, record, preserveSize) {
            const spec = sourceSpec(record.key);
            const width = preserveSize ? image.displayWidth : spec.width;
            const height = preserveSize ? image.displayHeight : spec.height;
            const originX = image.originX;
            const originY = image.originY;
            const signX = preserveSize && image.scaleX < 0 ? -1 : 1;
            const signY = preserveSize && image.scaleY < 0 ? -1 : 1;
            const input = image.input;
            // Custom hit shapes remain in original pixel coordinates. Phaser's
            // automatic hit rectangles already resize with setTexture/setFrame.
            if (input && input.customHitArea) {
                if (input.hitAreaCallback !== record.inputWrapper) record.inputCallback = input.hitAreaCallback;
            }
            const key = mode === "high-resolution" ? derivedKey(record.key, spec) : record.key;
            image.setTexture(key);
            image.setDisplaySize(width, height);
            if (signX < 0) image.scaleX = -Math.abs(image.scaleX);
            if (signY < 0) image.scaleY = -Math.abs(image.scaleY);
            image.setOrigin(originX, originY);
            if (input && input.customHitArea && record.inputCallback) {
                if (mode === "high-resolution") {
                    record.inputWrapper = function (shape, x, y, gameObject) {
                        return record.inputCallback.call(this, shape, x / SCALE, y / SCALE, gameObject);
                    };
                    input.hitAreaCallback = record.inputWrapper;
                } else {
                    input.hitAreaCallback = record.inputCallback;
                    record.inputWrapper = null;
                }
            }
        }

        function unregister(image) {
            const record = images.get(image);
            if (!record) return;
            if (image.off) image.off("destroy", record.onDestroy);
            if (image.input && image.input.hitAreaCallback === record.inputWrapper) {
                image.input.hitAreaCallback = record.inputCallback;
            }
            delete image.snowcraftOriginalTextureKey;
            images.delete(image);
        }

        function apply(image, originalTextureKey) {
            if (destroyed) throw new Error("Artwork manager is destroyed");
            // Validate before registering so failed calls leave no listeners/tags.
            sourceSpec(originalTextureKey);
            let record = images.get(image);
            if (!record) {
                record = { key: originalTextureKey, onDestroy: () => unregister(image) };
                images.set(image, record);
                if (image.once) image.once("destroy", record.onDestroy);
            }
            record.key = originalTextureKey;
            image.snowcraftOriginalTextureKey = originalTextureKey;
            render(image, record, false);
            return image;
        }

        function setMode(nextMode) {
            if (destroyed) throw new Error("Artwork manager is destroyed");
            checkedMode(nextMode);
            if (nextMode === mode) return manager;
            mode = nextMode;
            images.forEach((record, image) => render(image, record, true));
            return manager;
        }

        function destroy() {
            if (destroyed) return;
            mode = "original";
            images.forEach((record, image) => {
                render(image, record, true);
                unregister(image);
            });
            acquired.forEach((key) => {
                const entry = cache.get(key);
                entry.owners.delete(manager);
                if (!entry.owners.size) {
                    textures.remove(entry.key);
                    cache.delete(key);
                }
            });
            acquired.clear();
            if (scene.events && scene.events.off) {
                scene.events.off("shutdown", destroy);
                scene.events.off("destroy", destroy);
            }
            destroyed = true;
        }

        const manager = { apply: apply, setMode: setMode, destroy: destroy, get mode() { return mode; } };
        if (scene.events && scene.events.once) {
            scene.events.once("shutdown", destroy);
            scene.events.once("destroy", destroy);
        }
        return manager;
    }

    return { create: create };
});
