// Render the hand-drawn character SVGs in svg/ to transparent PNGs
// at SCALE x the original frame size (png/<same file name>.png).
// Usage: node poc/hd-character-redraw-claude/render.js [--scale 8] [file.svg ...]
// Needs puppeteer-core and Google Chrome (CHROME env var overrides the path).
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '../..');
const SVG_DIR = path.join(__dirname, 'svg');
const OUT_DIR = path.join(__dirname, 'png');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const args = process.argv.slice(2);
let scale = 8;
const si = args.indexOf('--scale');
if (si >= 0) { scale = Number(args[si + 1]); args.splice(si, 2); }
const files = args.length ? args.map(f => path.basename(f)) : fs.readdirSync(SVG_DIR).filter(f => f.endsWith('.svg')).sort();

(async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
    const page = await browser.newPage();
    for (const file of files) {
        const src = fs.readFileSync(path.join(SVG_DIR, file), 'utf8');
        const [, w, h] = src.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
        const W = Math.round(w * scale), H = Math.round(h * scale);
        const svg = src.replace(/(<svg[^>]*?)\swidth="[^"]*"\s+height="[^"]*"/, `$1 width="${W}" height="${H}"`);
        await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
        await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`);
        const out = path.join(OUT_DIR, file.replace(/\.svg$/, '.png'));
        await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } });
        console.log(`${file} -> ${path.relative(ROOT, out)} (${W}x${H})`);
    }
    await browser.close();
})();
