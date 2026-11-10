import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { indexedPng } from './indexed-png.mjs';

// Register the cleaned snowfield and retained grove without changing recovered art.
const repo = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('playwright');
const original = await readFile(path.join(repo, 'web/assets/cast/069_ground.png'));
const field = await readFile(path.join(repo, 'artwork/classic-polish/snowfield-source.png'));
const palette = JSON.parse(await readFile(path.join(repo, 'artwork/classic-polish/palette.json'), 'utf8'));
const trees = await readFile(path.join(repo, 'artwork/classic-christmas-grove/trees-source.png'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(async ({ original, field, trees, palette }) => {
    async function image(bytes) { const img = new Image(); img.src = 'data:image/png;base64,' + bytes; await img.decode(); return img; }
    const [recovered, base, grove] = await Promise.all([image(original), image(field), image(trees)]);
    const source = document.createElement('canvas'); source.width = grove.width; source.height = grove.height;
    const src = source.getContext('2d'); src.drawImage(grove, 0, 0);
    const pixels = src.getImageData(0, 0, source.width, source.height).data;
    const bounds = [source.width, source.height, -1, -1];
    let transparent = 0;
    for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
      const alpha = pixels[(y * source.width + x) * 4 + 3];
      if (!alpha) transparent++;
      if (alpha <= 16) continue;
      bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
      bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
    }
    if (!transparent || bounds[2] < bounds[0]) throw Error('Grove must have a real transparent background');
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 320;
    if (recovered.width !== canvas.width || recovered.height !== canvas.height) throw Error('Unexpected recovered ground dimensions');
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(base, 0, 0, 600, 320);
    const registered = document.createElement('canvas'); registered.width = 600; registered.height = 320;
    const reference = registered.getContext('2d'); reference.drawImage(recovered, 0, 0);
    const referencePixels = reference.getImageData(0, 0, 600, 320).data;
    const generated = document.createElement('canvas'); generated.width = 600; generated.height = 320;
    generated.getContext('2d').drawImage(canvas, 0, 0);
    const generatedPixels = ctx.getImageData(0, 0, 600, 320).data;
    function fortBounds(pixels, [x, y, w, h]) {
      const box = [600, 320, -1, -1];
      for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
        const i = (py * 600 + px) * 4;
        if (pixels[i + 3] < 160 || pixels[i] > 235 || pixels[i + 2] - pixels[i] < 12) continue;
        box[0] = Math.min(box[0], px); box[1] = Math.min(box[1], py);
        box[2] = Math.max(box[2], px); box[3] = Math.max(box[3], py);
      }
      if (box[2] < box[0]) throw Error('Missing opposing snow fort');
      return box;
    }
    const forts = [[125, 65, 110, 75], [345, 175, 115, 75]].map(region => {
      const target = fortBounds(referencePixels, region), source = fortBounds(generatedPixels, region);
      const sx = (target[2] - target[0] + 1) / (source[2] - source[0] + 1), sy = (target[3] - target[1] + 1) / (source[3] - source[1] + 1);
      if (Math.abs(sx - 1) > .2 || Math.abs(sy - 1) > .2) throw Error('Generated fort changed shape/size too far');
      ctx.save(); ctx.beginPath(); ctx.rect(...region); ctx.clip();
      ctx.setTransform(sx, 0, 0, sy, target[0] - source[0] * sx, target[1] - source[1] * sy);
      ctx.drawImage(generated, 0, 0); ctx.restore();
      return { region, originalBounds: target, sourceBounds: source, scale: [sx, sy] };
    });
    const before = ctx.getImageData(0, 0, 600, 320).data;
    const sw = bounds[2] - bounds[0] + 1, sh = bounds[3] - bounds[1] + 1;
    const fit = Math.min(140 / sw, 100 / sh);
    const w = Math.round(sw * fit), h = Math.round(sh * fit), x = 600 - w;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(grove, bounds[0], bounds[1], sw, sh, x, 0, w, h);
    const after = ctx.getImageData(0, 0, 600, 320).data;
    let changedPixels = 0;
    for (let y = 0; y < 320; y++) for (let x = 0; x < 600; x++) {
      const i = (y * 600 + x) * 4;
      if ([0, 1, 2, 3].some(c => before[i + c] !== after[i + c])) {
        if (x < 460 || y >= 100) throw Error('Changed pixels outside the top-right grove');
        changedPixels++;
      }
    }
    if (!changedPixels) throw Error('Missing grove');
    // Palette encoding is a deterministic export step, with no new dithering.
    const indices = new Uint8Array(600 * 320), colourCache = new Map();
    for (let i = 0; i < after.length; i += 4) {
      const key = after[i] << 16 | after[i + 1] << 8 | after[i + 2];
      let nearest = colourCache.get(key);
      if (nearest === undefined) {
        let distance = Infinity;
        for (let n = 0; n < palette.length; n++) {
          const c = palette[n], d = (after[i] - c[0]) ** 2 + (after[i + 1] - c[1]) ** 2 + (after[i + 2] - c[2]) ** 2;
          if (d < distance) { nearest = n; distance = d; }
        }
        colourCache.set(key, nearest);
      }
      indices[i / 4] = nearest;
    }
    let binary = ''; for (let i = 0; i < indices.length; i += 32768) binary += String.fromCharCode(...indices.subarray(i, i + 32768));
    return { indices: btoa(binary), bounds, placement: { x, y: 0, w, h }, changedPixels, forts,
      bitDepth: 8, paletteColours: palette.length, dither: false };
  }, { original: original.toString('base64'), field: field.toString('base64'), trees: trees.toString('base64'), palette });
  const png = indexedPng(600, 320, Buffer.from(result.indices, 'base64'), palette);
  const output = path.join(repo, 'web/assets/classic'); await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'ground.png'), png);
  const { indices: _, ...receipt } = result;
  await writeFile(path.join(repo, 'artwork/classic-christmas-grove/export.json'), JSON.stringify({
    source: 'trees-source.png', sourceSha256: hash(trees), originalSha256: hash(original),
    snowfieldSource: 'artwork/classic-polish/snowfield-source.png', snowfieldSourceSha256: hash(field),
    output: 'web/assets/classic/ground.png', sha256: hash(png), width: 600, height: 320, ...receipt
  }, null, 2) + '\n');
  console.log(JSON.stringify({ output: 'web/assets/classic/ground.png', ...receipt }));
} finally { await browser.close(); }
