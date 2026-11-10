const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');

// Independently decode RGBA8 originals and indexed8 exports, including PNG filters.
function decode(png) {
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20), type = png[25];
    assert.equal(png[24], 8);
    assert.ok(type === 6 || type === 3);
    assert.deepEqual([...png.subarray(26, 29)], [0, 0, 0], 'standard noninterlaced PNG');
    const chunks = [];
    let palette, alpha;
    for (let offset = 8; offset < png.length;) {
        const size = png.readUInt32BE(offset), name = png.toString('ascii', offset + 4, offset + 8);
        const data = png.subarray(offset + 8, offset + 8 + size);
        if (name === 'IDAT') chunks.push(data);
        if (name === 'PLTE') palette = data;
        if (name === 'tRNS') alpha = data;
        offset += size + 12;
    }
    const channels = type === 6 ? 4 : 1, stride = width * channels;
    const raw = inflateSync(Buffer.concat(chunks)), scan = Buffer.alloc(stride * height);
    assert.equal(raw.length, (stride + 1) * height);
    const paeth = (a, b, c) => {
        const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
        return da <= db && da <= dc ? a : db <= dc ? b : c;
    };
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        assert.ok(filter <= 4);
        for (let x = 0; x < stride; x++) {
            const i = y * stride + x;
            const a = x >= channels ? scan[i - channels] : 0;
            const b = y ? scan[i - stride] : 0, c = y && x >= channels ? scan[i - stride - channels] : 0;
            scan[i] = raw[y * (stride + 1) + x + 1] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
        }
    }
    const pixels = type === 6 ? scan : Buffer.alloc(width * height * 4);
    if (type === 3) {
        assert.ok(palette?.length && palette.length % 3 === 0 && palette.length <= 768);
        scan.forEach((index, i) => {
            assert.ok(index * 3 < palette.length, 'palette index exists');
            palette.copy(pixels, i * 4, index * 3, index * 3 + 3);
            pixels[i * 4 + 3] = alpha?.[index] ?? 255;
        });
    }
    // Canvas conversion discards hidden RGB; alpha and every visible RGB stay exact.
    for (let i = 0; i < pixels.length; i += 4) if (!pixels[i + 3]) pixels.fill(0, i, i + 3);
    return { width, height, pixels };
}

function assertIndexedCopy(original, exported, name) {
    assert.equal(exported[25], 3, name + ' indexed format');
    assert.deepEqual(decode(exported), decode(original), name + ' visible RGBA pixels and dimensions');
}

module.exports = { assertIndexedCopy };
