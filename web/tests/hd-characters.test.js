const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { inflateSync } = require('node:zlib');
const { assertIndexedCopy } = require('./png-pixels.cjs');
const P = require('../js/parity.js');

const root = path.resolve(__dirname, '../..');
const web = path.join(root, 'web/assets/hd/characters');
const native = path.join(root, 'flutter/assets/hd/characters');
const bytes = fs.readFileSync(path.join(web, 'manifest.json'));
const pack = JSON.parse(bytes);
const originals = P.CAST.kids.filter(frame => frame.name !== 'shadow');
const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

// Decode the shipped RGBA PNG alpha independently of exporter metadata: a valid
// canvas size/hash alone cannot detect a character accidentally shrunk inside it.
function pixelMetrics(png, red = true) {
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    assert.equal(png[24], 8);
    assert.equal(png[25], 6);
    const chunks = [];
    for (let offset = 8; offset < png.length;) {
        const size = png.readUInt32BE(offset);
        if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + size));
        offset += size + 12;
    }
    const raw = inflateSync(Buffer.concat(chunks)), stride = w * 4;
    const pixels = Buffer.alloc(stride * h);
    const paeth = (a, b, c) => {
        const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
        return da <= db && da <= dc ? a : db <= dc ? b : c;
    };
    let left = w, top = h, right = -1, bottom = -1;
    let bodyPixels = 0, skinX = 0, skinPixels = 0, teamX = 0, teamPixels = 0;
    const alphaValues = new Set();
    let maxAlpha = 0, edgeAlpha = 0;
    for (let y = 0; y < h; y++) {
        const filter = raw[y * (stride + 1)];
        assert.ok(filter <= 4);
        for (let x = 0; x < stride; x++) {
            const i = y * stride + x;
            const a = x >= 4 ? pixels[i - 4] : 0, b = y ? pixels[i - stride] : 0, c = y && x >= 4 ? pixels[i - stride - 4] : 0;
            const prediction = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
            pixels[i] = (raw[y * (stride + 1) + x + 1] + prediction) & 255;
            if (x % 4 === 3) {
                const px = (x - 3) / 4;
                alphaValues.add(pixels[i]);
                maxAlpha = Math.max(maxAlpha, pixels[i]);
                if (!px || !y || px === w - 1 || y === h - 1) edgeAlpha = Math.max(edgeAlpha, pixels[i]);
            }
            if (x % 4 === 3 && pixels[i] > 16) {
                const px = (x - 3) / 4;
                left = Math.min(left, px); right = Math.max(right, px);
                top = Math.min(top, y); bottom = Math.max(bottom, y);
                if (pixels[i] >= 160) {
                    const r = pixels[i - 3], g = pixels[i - 2], b = pixels[i - 1];
                    const blue = b > 45 && b > r * 1.15 && b > g * 1.3;
                    const team = red ? r > 45 && r > g * 1.25 && r > b * 1.1 : g > 45 && g > r * 1.25 && g > b * 1.1;
                    if (team || blue) bodyPixels++;
                    if (team) { teamX += px; teamPixels++; }
                    if (r > 160 && g > 100 && b > 75 && r > g * 1.08 && g > b * 1.03 && r < g * 1.7) {
                        skinX += px; skinPixels++;
                    }
                }
            }
        }
    }
    assert.ok(right >= left && bottom >= top, 'nonempty PNG');
    return { width: right - left + 1, height: bottom - top + 1, bodyPixels, faceX: skinX / skinPixels, teamX: teamX / teamPixels,
        maxAlpha, edgeAlpha, alphaLevels: alphaValues.size };
}

test('HD pack covers every character pose/variant and is byte-identical in web and Flutter', () => {
    assert.equal(pack.frames.length, 35);
    assert.equal(pack.frames.filter(f => f.name.startsWith('R ')).length, 15);
    assert.equal(pack.frames.filter(f => f.name.startsWith('G ')).length, 20);
    assert.equal(pack.pixelScale, 8);
    assert.equal(pack.selectionRing, 'renderer');
    assert.deepEqual(fs.readFileSync(path.join(native, 'manifest.json')), bytes);
    assert.deepEqual(pack.frames.map(f => f.key).sort(), originals.map(f => f.key).sort());
    for (const frame of pack.frames) {
        const png = fs.readFileSync(path.join(web, frame.file));
        assert.deepEqual(fs.readFileSync(path.join(native, frame.file)), png, frame.file);
        assert.equal(sha(png), frame.sha256);
        assert.equal(png.readUInt32BE(16), frame.w * 8);
        assert.equal(png.readUInt32BE(20), frame.h * 8);
        assert.equal(png[25], 6, 'RGBA transparency: ' + frame.file);
        assert.ok(frame.corners.every(a => a <= 2), 'transparent canvas corners: ' + frame.file);
    }
});

test('HD export retains original dimensions, unusual registrations, and placement anchors without changing original bytes', () => {
    for (const frame of pack.frames) {
        const original = originals.find(f => f.key === frame.key);
        assert.equal(frame.w, original.w);
        assert.equal(frame.h, original.h);
        assert.deepEqual(frame.reg, original.reg, frame.file);
        const old = fs.readFileSync(path.join(root, 'flutter/assets/art', frame.file));
        assert.equal(sha(old), frame.originalSha256);
        assertIndexedCopy(old, fs.readFileSync(path.join(root, 'web/assets/cast', frame.file)), frame.file);
        const master = fs.readFileSync(path.join(root, frame.masterFile));
        assert.equal(sha(master), frame.masterSha256);
        const { sourceAnchor, targetAnchor, offset, scale, sourceCrop } = frame.placement;
        for (const axis of [0, 1]) {
            assert.ok(Math.abs(sourceAnchor[axis] * scale + offset[axis] - targetAnchor[axis]) < 1e-8, frame.file + ' placement anchor');
        }
        assert.ok(sourceCrop[0] * scale + offset[0] >= -0.15, frame.file + ' left');
        assert.ok(sourceCrop[1] * scale + offset[1] >= -0.15, frame.file + ' top');
        assert.ok(sourceCrop[2] * scale + offset[0] <= frame.w + 0.15, frame.file + ' right');
        assert.ok(sourceCrop[3] * scale + offset[1] <= frame.h + 0.15, frame.file + ' bottom');
    }
});

test('fallen bodies stay the size of their standing teammates instead of filling scattered-prop bounds', () => {
    const falling = new Set([9, 10, 14, 15, 16, 32, 33, 34, 35, 36]);
    for (const frame of pack.frames.filter(frame => falling.has(frame.num))) {
        const red = frame.name.startsWith('R ');
        const standing = pack.frames.find(f => f.name === (red ? 'R ready' : 'G ready'));
        const ready = pixelMetrics(fs.readFileSync(path.join(web, standing.file)), red);
        const rendered = pixelMetrics(fs.readFileSync(path.join(web, frame.file)), red);
        const ratio = rendered.bodyPixels / ready.bodyPixels;
        // Compact hit frames may constrain the art, but cannot inflate it.
        assert.ok(ratio > 0.7 && ratio < 1.15, `${frame.file}: body area ratio ${ratio}`);
    }
});

test('HD Red standing faces left toward Green while Green continues facing right', () => {
    for (const [name, red] of [['R ready', true], ['R cock', true], ['R toss', true], ['G ready', false]]) {
        const frame = pack.frames.find(f => f.name === name);
        const metrics = pixelMetrics(fs.readFileSync(path.join(web, frame.file)), red);
        assert.ok(red ? metrics.faceX < metrics.teamX : metrics.faceX > metrics.teamX, name);
    }
});

test('redrawn snowfield is shared by both platforms at 4x original geometry', () => {
    const file = path.join(root, 'web/assets/hd/scenery/ground.png');
    const png = fs.readFileSync(file);
    assert.deepEqual(png, fs.readFileSync(path.join(root, 'flutter/assets/hd/scenery/ground.png')));
    assert.equal(png.readUInt32BE(16), P.CAST.ground.w * 4);
    assert.equal(png.readUInt32BE(20), P.CAST.ground.h * 4);
    assert.notEqual(sha(png), sha(fs.readFileSync(path.join(root, 'web/assets/cast', P.CAST.ground.file))));
});

test('all HD poses have shared, softly feathered translucent shadows without clipped edges', () => {
    for (const frame of pack.frames) {
        const shadow = frame.shadow;
        assert.equal(shadow.key, 'hd_shadow_' + frame.key);
        const png = fs.readFileSync(path.join(web, shadow.file));
        assert.deepEqual(png, fs.readFileSync(path.join(native, shadow.file)));
        assert.equal(sha(png), shadow.sha256);
        assert.equal(png.readUInt32BE(16), shadow.w * 8);
        assert.equal(png.readUInt32BE(20), shadow.h * 8);
        const metrics = pixelMetrics(png);
        assert.ok(metrics.maxAlpha > 20 && metrics.maxAlpha < 140, frame.file + ' translucent shadow');
        assert.ok(metrics.alphaLevels > 25, frame.file + ' soft penumbra');
        assert.ok(metrics.edgeAlpha <= 2, frame.file + ' unclipped blur');
        assert.equal(shadow.kind, frame.placement.mode === 'body-area' ? 'grounded' : 'standing');
    }
});
