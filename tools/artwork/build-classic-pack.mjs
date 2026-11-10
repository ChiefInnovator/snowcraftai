import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { indexedPng, indexImage } from './indexed-png.mjs';

// Lossless format conversion only: preserve every recovered sprite/effect pixel.
const repo = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('playwright');
const P = require(path.join(repo, 'web/js/parity.js'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const uri = bytes => 'data:image/png;base64,' + bytes.toString('base64');
const sources = ['player.png', 'enemy.png', ...Array.from({ length: 9 }, (_, i) => 'cast/power_' + i + '.png'),
  'cast/snowball.png', ...Array.from({ length: 4 }, (_, i) => 'cast/drop_' + i + '.png'), 'cast/splat.png',
  ...Array.from({ length: 4 }, (_, i) => 'cast/melt_' + i + '.png'), ...P.CAST.kids.map(m => 'cast/' + m.file)];
const manifestPath = path.join(repo, 'web/assets/classic/manifest.json');
const previous = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => '{"frames":[]}'));
const manifest = { version: 1, format: '8-bit indexed PNG', dither: false, sourcePixels: 'unchanged', frames: [] };
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const source of sources) {
    const input = await readFile(path.join(repo, 'web/assets', source));
    const image = await page.evaluate(indexImage, uri(input));
    const indices = Buffer.from(image.indices, 'base64');
    const rgba = Buffer.alloc(indices.length * 4);
    indices.forEach((n, i) => rgba.set([...image.palette[n], image.alpha[n]], i * 4));
    const bytes = indexedPng(image.width, image.height, indices, image.palette, image.alpha);
    const changedPixels = await page.evaluate(async urls => {
      const pixels = await Promise.all(urls.map(async url => {
        const i = new Image(); i.src = url; await i.decode();
        const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
        const ctx = c.getContext('2d'); ctx.drawImage(i, 0, 0); return ctx.getImageData(0, 0, c.width, c.height).data;
      }));
      let changes = 0;
      for (let i = 0; i < pixels[0].length; i += 4) if ([0, 1, 2, 3].some(c => pixels[0][i + c] !== pixels[1][i + c])) changes++;
      return changes;
    }, [uri(input), uri(bytes)]);
    if (changedPixels) throw Error('8-bit conversion changed source pixels: ' + source);
    const prior = previous.frames.find(f => f.source === 'web/assets/' + source);
    const sourceSha256 = prior?.sha256 === hash(input) ? prior.sourceSha256 : hash(input);
    await writeFile(path.join(repo, 'web/assets', source), bytes);
    manifest.frames.push({ file: source, source: 'web/assets/' + source, sourceSha256, sha256: hash(bytes), pixelSha256: hash(rgba),
      width: image.width, height: image.height, bitDepth: 8, colourType: 3, paletteEntries: image.palette.length, changedPixels });
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ images: manifest.frames.length, changedPixels: 0, format: manifest.format }));
} finally { await browser.close(); }
