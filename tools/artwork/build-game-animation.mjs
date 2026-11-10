import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderGameFrame } from './render-game-frame.mjs';
import { renderShadow } from './render-shadow.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('playwright');
const P = require(path.join(root, 'web/js/parity.js'));
const legacy = JSON.parse(await readFile(path.join(root, 'web/assets/hd/characters/manifest.json')));
const hash = b => createHash('sha256').update(b).digest('hex');
const uri = b => 'data:image/png;base64,' + b.toString('base64');
const roles = ['gather', 'cock', 'release', 'follow', 'recoil', 'fall', 'kneel', 'rise', 'ready', 'blink', 'shift', 'settle'];
const scale = 4, output = path.join(root, 'web/assets/hd/motion');
await mkdir(output, { recursive: true });
const manifest = { version: 1, pixelScale: scale, teams: {}, frames: {}, legacy: {} };
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const team of ['R', 'G']) {
    const ref = legacy.frames.find(f => f.name === team + ' ready');
    const reference = await readFile(path.join(root, 'web/assets/hd/characters', ref.file));
    manifest.teams[team] = {};
    for (const group of ['walk', 'strafe', 'actions']) {
      const masterFile = 'artwork/hd-game-animation/' + team + '/' + group + '.png';
      const master = await readFile(path.join(root, masterFile));
      const count = group === 'actions' ? 12 : 8;
      for (let index = 0; index < count; index++) {
        const id = team + '_' + (group === 'actions' ? roles[index] : group + '_' + index);
        const result = await page.evaluate(renderGameFrame, { url: uri(master), referenceUrl: uri(reference), reference: ref, team, group, index, scale });
        const bytes = Buffer.from(result.png, 'base64'), file = id + '.png', key = 'motion_' + id;
        await writeFile(path.join(output, file), bytes);
        const groundReg = [result.reg[0], result.reg[1] + result.groundOffset];
        const { png: shadowPng, ...shadow } = await page.evaluate(renderShadow, {
          frame: { key, file, w: result.w, h: result.h, reg: groundReg, shadowFoot: [result.contactPoints[0]?.x || 0, 0, 4], noContact: true }, png: result.png, scale
        });
        const shadowBytes = Buffer.from(shadowPng, 'base64'); await writeFile(path.join(output, shadow.file), shadowBytes);
        const { png, referenceFoot, ...placement } = result;
        manifest.frames[id] = { id, key, file, team, group, index, pixelScale: scale, ...placement, masterFile, masterSha256: hash(master), sha256: hash(bytes),
          shadow: { ...shadow, sha256: hash(shadowBytes) } };
        manifest.teams[team].foot = referenceFoot;
      }
    }
  }
  // Read-only contact records for the existing 35-pose pack; its art and mattes
  // remain untouched, including the body-area registration of fallen poses.
  for (const frame of legacy.frames) {
    const bytes = await readFile(path.join(root, 'web/assets/hd/characters', frame.file));
    const geometry = await page.evaluate(async ({ url, frame }) => {
      const i = new Image(); i.src = url; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      const x = c.getContext('2d'); x.drawImage(i, 0, 0); const p = x.getImageData(0, 0, c.width, c.height).data, s = frame.pixelScale;
      const blue = n => p[n + 3] >= 160 && p[n + 2] > 45 && p[n + 2] > p[n] * 1.15 && p[n + 2] > p[n + 1] * 1.15;
      let bodyPixels = 0, bodyX = 0, bodyY = 0;
      for (let y = 0; y < c.height; y++) for (let px = 0; px < c.width; px++) {
        const i = (y * c.width + px) * 4, [r, g, b, a] = p.slice(i, i + 4);
        if (a < 160) continue;
        const coat = frame.name.startsWith('R ') ? r > 45 && r > g * 1.25 && r > b * 1.1 : g > 45 && g > r * 1.25 && g > b * 1.1;
        if (coat || b > 45 && b > r * 1.15 && b > g * 1.3) { bodyPixels++; bodyX += px; bodyY += y; }
      }
      const body = { bodyArea: bodyPixels / (s * s), bodyCentre: [bodyX / bodyPixels / s - frame.reg[0], bodyY / bodyPixels / s - frame.reg[1]] };
      if (['R hit', 'R hit2', 'R dead', 'G down', 'G dead'].includes(frame.name)) return { ...body, contactPoints: [] };
      let sole = -1; for (let y = Math.floor(c.height * 0.6); y < c.height; y++) { let n = 0; for (let px = 0; px < c.width; px++) if (blue((y * c.width + px) * 4)) n++; if (n >= s * 0.4) sole = y; }
      if (sole < 0) return { ...body, contactPoints: [] };
      const result = []; let start = -1;
      for (let px = 0; px <= c.width; px++) { let solid = false; for (let y = Math.max(0, sole - s); y <= sole && px < c.width; y++) if (blue((y * c.width + px) * 4)) solid = true;
        if (solid && start < 0) start = px;
        if (!solid && start >= 0) {
          if (px - start >= s) {
            const centre = (start + px - 1) / 2; let anchor = null;
            for (let y = sole; y >= Math.max(0, sole - s) && !anchor; y--) for (let bx = start; bx < px; bx++) {
              if (blue((y * c.width + bx) * 4) && (!anchor || Math.abs(bx - centre) < Math.abs(anchor.x - centre))) anchor = { x: bx, y };
            }
            result.push({ x: anchor.x / s - frame.reg[0], y: anchor.y / s - frame.reg[1], width: (px - start) / s });
          }
          start = -1;
        }
      } return { ...body, contactPoints: result.sort((a, b) => b.width - a.width).slice(0, 2) };
    }, { url: uri(bytes), frame });
    manifest.legacy[frame.key] = geometry;
  }
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ poses: Object.keys(manifest.frames).length, legacyContacts: Object.keys(manifest.legacy).length, teams: manifest.teams }));
} finally { await browser.close(); }
