import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderShadow } from './render-shadow.mjs';
import { renderSantaFrame } from './render-santa-frame.mjs';
import { indexedPng, indexImage } from './indexed-png.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('playwright');
const Santa = require(path.join(repo, 'web/js/santa.js'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:image/png;base64,' + bytes.toString('base64');
const classicPalette = [[23, 27, 45], [216, 40, 40], [140, 32, 48], [255, 244, 220],
  [184, 184, 200], [244, 172, 120], [228, 120, 88], [232, 184, 64]];
const manifest = { version: 4, timing: Santa.TIMING, points: Santa.POINTS,
  cycles: { run: Santa.RUN_CYCLE, wave: Santa.WAVE_CYCLE, nose: Santa.NOSE_CYCLE }, frames: [], grove: {} };
const atlases = new Map();
for (let i = 0; i < 8; i++) atlases.set('run_' + i, { file: 'run-cycle.png', cols: 4, rows: 2, index: i, airborne: [3, 7] });
for (let i = 0; i < 4; i++) {
  atlases.set('turn_quarter_' + i, { file: 'turn-cycle.png', cols: 4, rows: 2, index: i });
  atlases.set('turn_front_' + i, { file: 'turn-cycle.png', cols: 4, rows: 2, index: i + 4 });
}
['wave_a', 'wave_b', 'wave_c'].forEach((id, index) => atlases.set(id, { file: 'wave-cycle.png', cols: 3, rows: 1, index }));
['nose_left', 'nose_center', 'nose_right'].forEach((id, index) => atlases.set(id, { file: 'nose-cycle.png', version: 'v3', cols: 3, rows: 1, index }));
// Original mode uses one model sheet, including the greeting and nose poses.
// A single reference scale avoids changing Santa's proportions between actions.
const classicOrder = [...Santa.RUN_CYCLE,
  ...Array.from({ length: 4 }, (_, i) => 'turn_quarter_' + i),
  ...Array.from({ length: 4 }, (_, i) => 'turn_front_' + i),
  'peek', 'wink', 'wave_a', 'wave_b', 'wave_c', 'nose_left', 'nose_center', 'nose_right'];
const classicAtlases = new Map(classicOrder.map((id, index) => [id, {
  file: 'all-poses.png', version: 'v4', cols: 6, rows: 4, index,
  airborne: [3, 7], referenceIndex: 16
}]));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  async function pngBytes(png, style) {
    if (style === 'hd') return Buffer.from(png, 'base64');
    const image = await page.evaluate(indexImage, 'data:image/png;base64,' + png);
    return indexedPng(image.width, image.height, Buffer.from(image.indices, 'base64'), image.palette, image.alpha);
  }
  for (const id of Santa.FRAMES) {
    const atlas = atlases.get(id), w = atlas ? 72 : 64;
    const entry = { id, key: 'santa_' + id, file: id + '.png', w, h: 64, reg: [w / 2, 58], versions: {} };
    for (const style of ['classic', 'hd']) {
      const sourceAtlas = style === 'classic' ? classicAtlases.get(id) : atlas;
      const source = 'artwork/santa-comes-to-town/' + (sourceAtlas ? (sourceAtlas.version || 'v2') + '/' + style + '/' + sourceAtlas.file : style + '/' + id + '.png');
      const master = await readFile(path.join(repo, source));
      const scale = style === 'hd' ? 8 : 1;
      const result = await page.evaluate(renderSantaFrame, { url: uri(master), entry, scale, atlas: sourceAtlas,
        palette: style === 'classic' ? classicPalette : null });
      const bytes = result.indices ? indexedPng(entry.w, entry.h, Buffer.from(result.indices, 'base64'), [[0, 0, 0], ...classicPalette], true)
        : Buffer.from(result.png, 'base64');
      const directory = path.join(repo, 'web/assets/santa', style); await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, entry.file), bytes);
      const { png, indices, ...placement } = result;
      entry.versions[style] = { pixelScale: scale, sha256: hash(bytes), masterFile: source, masterSha256: hash(master), placement };
      if (style === 'classic') entry.versions[style].pixelArt = { bitDepth: 8, palette: classicPalette, alpha: 'binary', dither: false };
      const shadowFrame = { ...entry, reg: [entry.reg[0], entry.reg[1] + result.groundOffset], shadowFoot: result.contactFoot, noContact: true,
        indexed: style === 'classic' };
      const { png: shadowPng, ...shadow } = await page.evaluate(renderShadow, { frame: shadowFrame, png: result.png, scale });
      const shadowBytes = await pngBytes(shadowPng, style);
      await writeFile(path.join(directory, shadow.file), shadowBytes);
      entry.versions[style].shadow = { ...shadow, key: 'santa_shadow_' + style + '_' + id, sha256: hash(shadowBytes) };
      if (id.startsWith('run_') || id.startsWith('turn_quarter_')) {
        const flipped = await page.evaluate(async png => {
          const image = new Image(); image.src = 'data:image/png;base64,' + png; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const ctx = canvas.getContext('2d'); ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(image, 0, 0);
          return canvas.toDataURL('image/png').split(',')[1];
        }, result.png);
        const { png: leftPng, ...leftShadow } = await page.evaluate(renderShadow, {
          frame: { ...shadowFrame, key: entry.key + '_left', file: id + '_left.png', reg: [entry.w - entry.reg[0], shadowFrame.reg[1]],
            shadowFoot: [-result.contactFoot[0], 0, result.contactFoot[2]] }, png: flipped, scale
        });
        const leftBytes = await pngBytes(leftPng, style);
        await writeFile(path.join(directory, leftShadow.file), leftBytes);
        entry.versions[style].shadowFlipped = { ...leftShadow, key: 'santa_shadow_' + style + '_' + id + '_left', sha256: hash(leftBytes) };
      }
    }
    manifest.frames.push(entry);
  }

  // Use a continuous outer grove silhouette. Colour-only row scans missed white
  // boughs and let Santa show through them as horizontal strips.
  const outline = [[512, 0], [600, 0], [600, 100], [524, 100], [522, 95], [508, 91], [505, 85],
    [499, 81], [482, 80], [475, 76], [471, 72], [470, 68], [474, 62], [476, 56],
    [480, 50], [481, 45], [486, 40], [487, 35], [486, 32], [491, 29], [499, 27], [508, 20]];
  const classicSource = await readFile(path.join(repo, 'artwork/classic-christmas-grove/trees-source.png'));
  const classicPlacement = JSON.parse(await readFile(path.join(repo, 'artwork/classic-christmas-grove/export.json'), 'utf8'));
  for (const style of ['classic', 'hd']) {
    const file = style === 'hd' ? 'web/assets/hd/scenery/ground.png' : 'web/assets/classic/ground.png';
    const ground = await readFile(path.join(repo, file));
    const scale = style === 'hd' ? 4 : 1;
    const result = await page.evaluate(async ({ url, scale, style, outline, groveUrl, placement }) => {
      async function image(url) { const img = new Image(); img.src = url; await img.decode(); return img; }
      const ground = await image(url);
      const canvas = document.createElement('canvas'); canvas.width = ground.width; canvas.height = ground.height;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(ground, 0, 0);
      const original = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const mask = document.createElement('canvas'); mask.width = canvas.width; mask.height = canvas.height;
      const maskContext = mask.getContext('2d');
      if (style === 'classic') {
        const grove = await image(groveUrl), b = placement.bounds, p = placement.placement;
        maskContext.imageSmoothingEnabled = false;
        maskContext.drawImage(grove, b[0], b[1], b[2] - b[0] + 1, b[3] - b[1] + 1, p.x, p.y, p.w, p.h);
        const sourceAlpha = maskContext.getImageData(0, 0, mask.width, mask.height).data;
        const left = Array.from({ length: 101 }, () => mask.width);
        for (let y = 0; y < left.length; y++) for (let x = 450; x < mask.width; x++) {
          if (sourceAlpha[(y * mask.width + x) * 4 + 3] > 64) { left[y] = x; break; }
        }
        maskContext.clearRect(0, 0, mask.width, mask.height);
        for (let y = 0; y < left.length; y++) {
          const edge = Math.min(...left.slice(Math.max(0, y - 1), y + 2));
          if (edge < mask.width) maskContext.fillRect(edge - 1, y, mask.width - edge + 1, 1);
        }
      } else {
        maskContext.beginPath();
        outline.forEach(([x, y], i) => i ? maskContext.lineTo(x * scale, y * scale) : maskContext.moveTo(x * scale, y * scale));
        maskContext.closePath(); maskContext.fill();
      }
      const pixels = original.data, alpha = maskContext.getImageData(0, 0, mask.width, mask.height).data;
      const output = ctx.createImageData(canvas.width, canvas.height);
      let maskedPixels = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (!alpha[i + 3]) continue;
        output.data[i] = pixels[i]; output.data[i + 1] = pixels[i + 1]; output.data[i + 2] = pixels[i + 2]; output.data[i + 3] = 255; maskedPixels++;
      }
      ctx.putImageData(output, 0, 0);
      const png = canvas.toDataURL('image/png').split(',')[1];
      // The opaque patch must look identical to the underlying composed scene.
      const verify = document.createElement('canvas'); verify.width = canvas.width; verify.height = canvas.height;
      const v = verify.getContext('2d'); v.putImageData(original, 0, 0); v.drawImage(canvas, 0, 0);
      const after = v.getImageData(0, 0, canvas.width, canvas.height).data;
      if (after.some((value, i) => value !== original.data[i])) throw Error('Grove overlay changes the background');
      return { png, maskedPixels };
    }, { url: uri(ground), scale, style, outline, groveUrl: uri(classicSource), placement: classicPlacement });
    const bytes = await pngBytes(result.png, style);
    await writeFile(path.join(repo, 'web/assets/santa', style, 'grove.png'), bytes);
    manifest.grove[style] = { file: 'grove.png', w: 600, h: 320, pixelScale: scale, sha256: hash(bytes), sourceSha256: hash(ground), maskedPixels: result.maskedPixels,
      outline: style === 'hd' ? outline : undefined, silhouetteSource: style === 'classic' ? 'classic grove alpha, filled row spans' : 'continuous traced outer boughs' };
  }
  await writeFile(path.join(repo, 'web/assets/santa/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ frames: manifest.frames.length, styles: ['classic', 'hd'], grove: manifest.grove }));
} finally { await browser.close(); }
