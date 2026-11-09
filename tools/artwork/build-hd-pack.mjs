import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Registration/export only. All character illustration comes from the approved
// image_gen masters; this never redraws or interpolates the original characters.
const repo = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require(process.env.SNOWCRAFT_PLAYWRIGHT_MODULE || 'playwright');
const scale = 8;
const data = JSON.parse(await readFile(path.join(repo, 'flutter/assets/data/game.json'), 'utf8'));
const frames = data.kids.filter(frame => frame.name !== 'shadow');
if (frames.length !== 35) throw Error('Expected the complete 35-frame character inventory');
const output = path.join(repo, 'web/assets/hd/characters');
const native = path.join(repo, 'flutter/assets/hd/characters');
await mkdir(output, { recursive: true });
await mkdir(native, { recursive: true });
const types = { '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { return response.writeHead(400).end(); }
  if (pathname === '/') return response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>HD sprite export</title>');
  const file = path.resolve(repo, '.' + pathname);
  if (file !== repo && !file.startsWith(repo + path.sep)) return response.writeHead(403).end();
  try {
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(bytes);
  }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const manifest = { version: 1, pixelScale: scale, approval: 'Red and Green reference designs approved by Rich on 2026-11-09', selectionRing: 'renderer', frames: [] };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + server.address().port);
  for (const frame of frames) {
    const source = 'artwork/hd-character-preview/animation-sources/' + frame.file;
    const original = 'web/assets/cast/' + frame.file;
    const result = await page.evaluate(async ({ frame, source, original, scale }) => {
      async function image(url) { const img = new Image(); img.src = '/' + url; await img.decode(); return img; }
      function inspect(img, isOriginal) {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
        const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
        const full = [c.width, c.height, -1, -1], body = [...full], boots = [...full];
        let transparent = 0, solid = 0, bootPixels = 0;
        const add = (box, x, y) => { box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); };
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4, r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
          if (!a) transparent++;
          if (a >= 250) solid++;
          if (a > 16) add(full, x, y);
          if (a < 160) continue;
          const cyanRing = isOriginal && [6, 7, 8].includes(frame.num) && g > 65 && b > r + 35 && g > r + 25;
          if (cyanRing) continue;
          const blue = b > 45 && b > r * 1.15 && b > g * 1.3;
          const team = frame.name.startsWith('R ')
            ? r > 45 && r > g * 1.25 && r > b * 1.1
            : g > 45 && g > r * 1.25 && g > b * 1.1;
          if (team || blue) add(body, x, y);
          if (blue) { add(boots, x, y); bootPixels++; }
        }
        if (full[2] < full[0]) throw Error('Empty image: ' + frame.file);
        if (body[2] < body[0]) throw Error('No character-colour anchor: ' + frame.file);
        if (bootPixels < 2) throw Error('No blue boot anchor: ' + frame.file);
        return { full, body, boots, transparent, solid, width: c.width, height: c.height };
      }
      const [master, old] = await Promise.all([image(source), image(original)]);
      const src = inspect(master, false), dst = inspect(old, true);
      if (!src.transparent || master.width < frame.w * 4 || master.height < frame.h * 4) throw Error('Master lacks HD resolution or transparency: ' + frame.file);
      const margin = 1 / scale;
      const crop = [Math.max(0, src.full[0] - 2), Math.max(0, src.full[1] - 2), Math.min(master.width - 1, src.full[2] + 2), Math.min(master.height - 1, src.full[3] + 2)];
      // A boot-colour anchor is meaningful for upright poses. During a fall the
      // original blue pixels can be a detached boot on the opposite frame edge;
      // forcing the entire illustration around it shrinks the character away.
      const mode = [9, 10, 14, 15, 16, 32, 33, 34, 35, 36].includes(frame.num) ? 'bounds' : 'boots';
      const sourceAnchor = mode === 'bounds'
        ? [(crop[0] + crop[2] + 1) / 2, crop[3] + 1]
        : [(src.boots[0] + src.boots[2]) / 2, src.boots[3]];
      const targetAnchor = mode === 'bounds'
        ? [(dst.full[0] + dst.full[2] + 1) / 2, dst.full[3] + 1 - margin]
        : [(dst.boots[0] + dst.boots[2]) / 2, dst.boots[3]];
      const referenceAnchor = [...targetAnchor];
      let fit = mode === 'bounds'
        ? Math.min((dst.full[2] - dst.full[0] + 1 - margin * 2) / (crop[2] - crop[0] + 1), (dst.full[3] - dst.full[1] + 1 - margin * 2) / (crop[3] - crop[1] + 1))
        : (targetAnchor[1] - dst.body[1] + 1) / (sourceAnchor[1] - src.body[1] + 1);
      // Fit all illustrated limbs, snow flecks and loose caps inside the
      // unchanged logical frame without stretching either placement mode.
      const limits = [fit];
      if (mode === 'bounds') {
        if (sourceAnchor[0] > crop[0]) limits.push((targetAnchor[0] - margin) / (sourceAnchor[0] - crop[0]));
        if (crop[2] > sourceAnchor[0]) limits.push((frame.w - margin - targetAnchor[0]) / (crop[2] - sourceAnchor[0]));
      } else {
        // Upright heads and mittens can be wider than the recovered silhouette.
        // Translate within the frame before reducing the whole character's size.
        limits.push((frame.w - margin * 2) / (crop[2] - crop[0] + 1));
      }
      if (sourceAnchor[1] > crop[1]) limits.push((targetAnchor[1] - margin) / (sourceAnchor[1] - crop[1]));
      if (crop[3] > sourceAnchor[1]) limits.push((frame.h - margin - targetAnchor[1]) / (crop[3] - sourceAnchor[1]));
      fit = Math.min(...limits.filter(n => n > 0));
      if (!Number.isFinite(fit) || fit <= 0) throw Error('Invalid anchor transform: ' + frame.file);
      let dx = targetAnchor[0] - sourceAnchor[0] * fit;
      const dy = targetAnchor[1] - sourceAnchor[1] * fit;
      if (mode === 'boots') {
        dx = Math.max(margin - crop[0] * fit, Math.min(frame.w - margin - (crop[2] + 1) * fit, dx));
        targetAnchor[0] = sourceAnchor[0] * fit + dx;
      }
      const canvas = document.createElement('canvas'); canvas.width = frame.w * scale; canvas.height = frame.h * scale;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const cw = crop[2] - crop[0] + 1, ch = crop[3] - crop[1] + 1;
      ctx.drawImage(master, crop[0], crop[1], cw, ch, (dx + crop[0] * fit) * scale, (dy + crop[1] * fit) * scale, cw * fit * scale, ch * fit * scale);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const corners = [pixels[3], pixels[(canvas.width - 1) * 4 + 3], pixels[((canvas.height - 1) * canvas.width) * 4 + 3], pixels[pixels.length - 1]];
      if (corners.some(a => a > 2)) throw Error('Opaque frame corner: ' + frame.file);
      return { png: canvas.toDataURL('image/png').split(',')[1], placement: { mode, sourceAnchor, referenceAnchor, targetAnchor, scale: fit, offset: [dx, dy], sourceBounds: src.full, sourceCrop: crop }, corners, sourceSize: [master.width, master.height] };
    }, { frame, source, original, scale });
    const bytes = Buffer.from(result.png, 'base64');
    await writeFile(path.join(output, frame.file), bytes);
    await copyFile(path.join(output, frame.file), path.join(native, frame.file));
    manifest.frames.push({ key: frame.key, file: frame.file, name: frame.name, num: frame.num, w: frame.w, h: frame.h, reg: frame.reg, pixelScale: scale, sha256: hash(bytes), originalSha256: hash(await readFile(path.join(repo, original))), masterSha256: hash(await readFile(path.join(repo, source))), sourceSize: result.sourceSize, placement: result.placement, corners: result.corners });
  }
  const json = JSON.stringify(manifest, null, 2) + '\n';
  await writeFile(path.join(output, 'manifest.json'), json);
  await writeFile(path.join(native, 'manifest.json'), json);
  console.log(JSON.stringify({ frames: manifest.frames.length, red: manifest.frames.filter(f => f.name.startsWith('R ')).length, green: manifest.frames.filter(f => f.name.startsWith('G ')).length, pixelScale: scale, bytes: manifest.frames.length && (await Promise.all(manifest.frames.map(f => readFile(path.join(output, f.file))))).reduce((n, b) => n + b.length, 0) }));
} finally {
  try { await browser?.close(); }
  finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
