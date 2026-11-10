import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require(process.env.SNOWCRAFT_PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('.', import.meta.url));
const repo = fileURLToPath(new URL('../../', import.meta.url));
const url = process.env.SNOWCRAFT_PREVIEW_URL || 'http://127.0.0.1:8018/artwork/hd-character-preview/';
const browser = await chromium.launch({ headless: true });
const errors = [];
let result;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.previewReady || window.previewError);
  result = await page.evaluate(() => ({
    ready: window.previewReady, error: window.previewError,
    frames: window.previewEvidence, canvases: document.querySelectorAll('canvas').length,
    desktopOverflow: document.documentElement.scrollWidth > innerWidth
  }));
  if (!result.ready || result.error || result.desktopOverflow || result.canvases !== 12) throw Error('Preview did not render all 12 comparisons');
  for (const frame of result.frames) {
    const { metrics } = frame;
    if (frame.type === 'Redrawn' && (!metrics.transparent || metrics.cornerAlpha.some(a => a !== 0) || metrics.width < frame.width * 4 || metrics.height < frame.height * 4)) {
      throw Error('Invalid HD size or transparency: ' + frame.team);
    }
    const file = frame.type === 'Redrawn'
      ? root + frame.url
      : repo + 'web/assets/cast/' + (frame.team === 'Red' ? '005_R_ready.png' : '024_G_ready.png');
    const bytes = await readFile(file);
    frame.sha256 = createHash('sha256').update(bytes).digest('hex');
    frame.bytes = bytes.length;
  }
  await page.screenshot({ path: root + 'comparison.png', fullPage: true });
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.screenshot({ path: root + 'comparison-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: root + 'comparison-phone.png', fullPage: true });
  result.phoneOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (result.phoneOverflow) throw Error('Phone comparison overflows horizontally');
} finally {
  await browser.close();
}
await writeFile(root + 'validation.json', JSON.stringify({ ...result, errors }, null, 2) + '\n');
console.log(JSON.stringify({
  frames: result.frames.map(f => ({ team: f.team, type: f.type, width: f.metrics.width, height: f.metrics.height, transparent: f.metrics.transparent, bounds: f.metrics.bounds })),
  comparisons: result.canvases, phoneOverflow: result.phoneOverflow, errors
}));
if (errors.length) process.exitCode = 1;
