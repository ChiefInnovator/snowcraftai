import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Review every exported pose at the same logical scale as its original.
// No game engine, network requests or original executable is required.
const repo = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require(process.env.SNOWCRAFT_PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve(process.argv[2] || '/tmp/snowcraft-hd-pack');
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(repo, 'web/assets/hd/characters/manifest.json'), 'utf8'));
const frames = await Promise.all(manifest.frames.map(async frame => ({
  ...frame,
  original: 'data:image/png;base64,' + (await readFile(path.join(repo, 'web/assets/cast', frame.file))).toString('base64'),
  hd: 'data:image/png;base64,' + (await readFile(path.join(repo, 'web/assets/hd/characters', frame.file))).toString('base64'),
})));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.setContent(`<!doctype html><meta charset="utf-8"><title>HD character pack review</title>
    <style>
      body{margin:20px;background:#e7ebf1;color:#172130;font:14px system-ui}
      h1{font-size:22px;margin:0 0 8px}p{margin:0 0 16px}
      main{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
      section{border:1px solid #aebac9;padding:8px;min-width:0}
      h2{font:12px monospace;margin:0 0 6px;overflow-wrap:anywhere}
      .pair{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      figure{margin:0;min-width:0}figcaption{text-align:center;font-size:12px;margin-bottom:4px}
      .slot{height:120px;display:flex;align-items:center;justify-content:center;
        background-color:#fff;background-image:conic-gradient(#dbe2ec 25%,transparent 0 50%,#dbe2ec 0 75%,transparent 0);background-size:12px 12px}
      img{object-fit:contain}.original{image-rendering:pixelated}
      body.dark{background:#18202c;color:#f4f6fa}.dark section{border-color:#647080}
      .dark .slot{background-color:#263445;background-image:conic-gradient(#35465c 25%,transparent 0 50%,#35465c 0 75%,transparent 0)}
    </style><h1>All 35 HD character frames</h1><p>Original and HD shown at the same 2× logical scale; registration and canvas sizes are unchanged.</p><main></main>`);
  await page.evaluate(async frames => {
    const grid = document.querySelector('main');
    for (const frame of frames) {
      const section = document.createElement('section');
      const title = document.createElement('h2'); title.textContent = frame.file;
      const pair = document.createElement('div'); pair.className = 'pair';
      for (const [label, url] of [['Original', frame.original], ['HD', frame.hd]]) {
        const figure = document.createElement('figure');
        const caption = document.createElement('figcaption'); caption.textContent = label;
        const slot = document.createElement('div'); slot.className = 'slot';
        const img = new Image(); img.src = url; img.className = label === 'Original' ? 'original' : 'hd';
        img.width = frame.w * 2; img.height = frame.h * 2; await img.decode();
        slot.append(img); figure.append(caption, slot); pair.append(figure);
      }
      section.append(title, pair); grid.append(section);
    }
  }, frames);
  await page.screenshot({ path: path.join(output, 'character-sheet-light.png'), fullPage: true });
  await page.evaluate(() => document.body.classList.add('dark'));
  await page.screenshot({ path: path.join(output, 'character-sheet-dark.png'), fullPage: true });
  if (errors.length) throw Error(errors.join('\n'));
  const receipt = { frames: frames.length, pixelScale: manifest.pixelScale, displayScale: 2, errors };
  await writeFile(path.join(output, 'contact-sheet-validation.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ ...receipt, output }));
} finally {
  await browser.close();
}
