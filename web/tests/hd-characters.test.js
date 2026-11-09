const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { inflateSync } = require('node:zlib');
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
function alphaBounds(png) {
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
    for (let y = 0; y < h; y++) {
        const filter = raw[y * (stride + 1)];
        assert.ok(filter <= 4);
        for (let x = 0; x < stride; x++) {
            const i = y * stride + x;
            const a = x >= 4 ? pixels[i - 4] : 0, b = y ? pixels[i - stride] : 0, c = y && x >= 4 ? pixels[i - stride - 4] : 0;
            const prediction = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
            pixels[i] = (raw[y * (stride + 1) + x + 1] + prediction) & 255;
            if (x % 4 === 3 && pixels[i] > 16) {
                const px = (x - 3) / 4;
                left = Math.min(left, px); right = Math.max(right, px);
                top = Math.min(top, y); bottom = Math.max(bottom, y);
            }
        }
    }
    assert.ok(right >= left && bottom >= top, 'nonempty PNG');
    return { width: right - left + 1, height: bottom - top + 1 };
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
        const old = fs.readFileSync(path.join(root, 'web/assets/cast', frame.file));
        assert.equal(sha(old), frame.originalSha256);
        const master = fs.readFileSync(path.join(root, 'artwork/hd-character-preview/animation-sources', frame.file));
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

test('hit and falling poses retain visible size instead of shrinking around a standing boot anchor', () => {
    const falling = new Set([9, 10, 14, 15, 16, 32, 33, 34, 35, 36]);
    for (const frame of pack.frames.filter(frame => falling.has(frame.num))) {
        const original = alphaBounds(fs.readFileSync(path.join(root, 'web/assets/cast', frame.file)));
        const rendered = alphaBounds(fs.readFileSync(path.join(web, frame.file)));
        const expectedExtent = Math.max(original.width, original.height);
        const actualExtent = Math.max(rendered.width, rendered.height) / pack.pixelScale;
        assert.ok(actualExtent >= expectedExtent * 0.75,
            `${frame.file}: visible extent ${actualExtent} is too small for original extent ${expectedExtent}`);
    }
});
