// Browser-side registration for the HD-only child animation layer.
export async function renderGameFrame({ url, referenceUrl, reference, team, group, index, scale }) {
  const cache = globalThis.gameAnimationSources || (globalThis.gameAnimationSources = new Map());
  const blue = (p, i) => p[i + 3] >= 160 && p[i + 2] > 40 && p[i + 2] > p[i] * 1.15 && p[i + 2] > p[i + 1] * 1.15;
  const colour = (p, i) => p[i + 3] >= 160 && (team === 'R'
    ? p[i] > 40 && p[i] > p[i + 1] * 1.2 && p[i] > p[i + 2] * 1.1
    : p[i + 1] > 40 && p[i + 1] > p[i] * 1.2 && p[i + 1] > p[i + 2] * 1.1);
  async function load(url) { const image = new Image(); image.src = url; await image.decode(); return image; }
  function inspect(canvas) {
    const w = canvas.width, h = canvas.height, p = canvas.getContext('2d').getImageData(0, 0, w, h).data;
    const bounds = [w, h, -1, -1], rows = new Uint32Array(h);
    let clear = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!p[i + 3]) clear++;
      if (p[i + 3] >= 160) {
        bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
        bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
      }
      if (colour(p, i)) rows[y]++;
    }
    if (!clear || bounds[2] < bounds[0]) throw Error('Child atlas needs true transparency');
    const top = rows.findIndex(n => n >= Math.max(2, w * 0.012));
    let sole = -1, bootX = 0, bootCount = 0;
    for (let y = Math.max(0, Math.floor(bounds[1] + (bounds[3] - bounds[1]) * 0.6)); y <= bounds[3]; y++) {
      let count = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (blue(p, i)) { count++; bootX += x; bootCount++; }
      }
      if (count >= Math.max(2, w * 0.01)) sole = y;
    }
    if (top < 0 || sole < 0 || !bootCount) throw Error('Child atlas lacks cap/blue boot anchors');
    let waist = -1;
    const lo = Math.floor(top + (sole - top) * 0.45), hi = Math.floor(top + (sole - top) * 0.8);
    for (let y = lo; y <= hi; y++) if (rows[y] >= Math.max(3, w * 0.035)) waist = y;
    if (waist < 0) throw Error('Child atlas lacks a jacket anchor');
    let waistX = 0, count = 0;
    for (let y = Math.max(lo, waist - Math.ceil((sole - top) * 0.04)); y <= waist; y++) for (let x = 0; x < w; x++) {
      if (colour(p, (y * w + x) * 4)) { waistX += x; count++; }
    }
    return { canvas, bounds, top, sole, bootX: bootX / bootCount, waist, waistX: waistX / count };
  }
  let ref = cache.get(referenceUrl);
  if (!ref) {
    const image = await load(referenceUrl), canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0); ref = inspect(canvas); cache.set(referenceUrl, ref);
  }
  let sheet = cache.get(url);
  if (!sheet) {
    const image = await load(url), rows = group === 'actions' ? 3 : 2, cells = [];
    for (let n = 0; n < rows * 4; n++) {
      const x = Math.round(n % 4 * image.width / 4), y = Math.round(Math.floor(n / 4) * image.height / rows);
      const w = Math.round((n % 4 + 1) * image.width / 4) - x, h = Math.round((Math.floor(n / 4) + 1) * image.height / rows) - y;
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(image, x, y, w, h, 0, 0, w, h);
      cells.push({ ...inspect(canvas), sourceRect: [x, y, w, h] });
    }
    const baseline = group === 'actions' ? cells[8] : cells[0];
    const fit = (ref.sole - ref.top) / reference.pixelScale / (baseline.sole - baseline.top);
    const coreY = 48 - (baseline.sole - baseline.waist) * fit;
    sheet = { cells, fit, coreY }; cache.set(url, sheet);
  }
  const cell = sheet.cells[index], w = 64, h = 56, reg = [32, 48];
  const noContact = group === 'actions' && index === 5;
  const dx = reg[0] - cell.waistX * sheet.fit, dy = sheet.coreY - cell.waist * sheet.fit;
  const canvas = document.createElement('canvas'); canvas.width = w * scale; canvas.height = h * scale;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cell.canvas, dx * scale, dy * scale, cell.canvas.width * sheet.fit * scale, cell.canvas.height * sheet.fit * scale);
  const p = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let sole = -1;
  for (let y = 30 * scale; y < canvas.height - scale; y++) {
    let count = 0; for (let x = 0; x < canvas.width; x++) if (blue(p, (y * canvas.width + x) * 4)) count++;
    if (count >= scale * 0.4) sole = y;
  }
  if (sole < 0) throw Error('Exported child has no blue soles');
  const groundOffset = noContact ? 0 : sole / scale - reg[1], contactPoints = [];
  if (!noContact) {
    let start = -1;
    for (let x = 0; x <= canvas.width; x++) {
      let solid = false;
      for (let y = Math.max(0, sole - Math.ceil(scale)); y <= sole && x < canvas.width; y++) if (blue(p, (y * canvas.width + x) * 4)) solid = true;
      if (solid && start < 0) start = x;
      if (!solid && start >= 0) {
        if (x - start >= scale) {
          const centre = (start + x - 1) / 2;
          let anchor = null;
          for (let y = sole; y >= Math.max(0, sole - Math.ceil(scale)) && !anchor; y--) {
            for (let px = start; px < x; px++) if (blue(p, (y * canvas.width + px) * 4)
              && (!anchor || Math.abs(px - centre) < Math.abs(anchor.x - centre))) anchor = { x: px, y };
          }
          contactPoints.push({ x: anchor.x / scale - reg[0], y: anchor.y / scale - reg[1], width: (x - start) / scale });
        }
        start = -1;
      }
    }
    contactPoints.sort((a, b) => b.width - a.width); contactPoints.splice(2);
    if (!contactPoints.length) throw Error('Child contact pose lacks a supporting boot');
  }
  for (let x = 0; x < canvas.width; x++) if (p[x * 4 + 3] > 16 || p[((canvas.height - 1) * canvas.width + x) * 4 + 3] > 16) throw Error('Child atlas crosses top/bottom frame');
  for (let y = 0; y < canvas.height; y++) if (p[y * canvas.width * 4 + 3] > 16 || p[(y * canvas.width + canvas.width - 1) * 4 + 3] > 16) throw Error('Child atlas crosses side frame');
  const referenceFoot = { x: ref.bootX / reference.pixelScale - reference.reg[0], y: ref.sole / reference.pixelScale - reference.reg[1] };
  let bodyPixels = 0, bodyX = 0, bodyY = 0;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const i = (y * canvas.width + x) * 4, [r, g, b, a] = p.slice(i, i + 4);
    if (a < 160) continue;
    const coat = team === 'R' ? r > 45 && r > g * 1.25 && r > b * 1.1 : g > 45 && g > r * 1.25 && g > b * 1.1;
    if (coat || b > 45 && b > r * 1.15 && b > g * 1.3) { bodyPixels++; bodyX += x; bodyY += y; }
  }
  const bodyArea = bodyPixels / (scale * scale), bodyCentre = [bodyX / bodyPixels / scale - reg[0], bodyY / bodyPixels / scale - reg[1]];
  let releasePoint = null;
  if (group === 'actions' && index === 2) {
    const whites = [];
    for (let y = 12 * scale; y < 43 * scale; y++) for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4, [r, g, b, a] = p.slice(i, i + 4);
      if (a >= 160 && r > 120 && Math.max(r, g, b) - Math.min(r, g, b) < 22
        && (team === 'R' ? x < 26 * scale : x > 38 * scale)) whites.push({ x, y });
    }
    if (!whites.length) throw Error('Release pose lacks a forward mitten');
    const edge = (team === 'R' ? Math.min : Math.max)(...whites.map(p => p.x));
    const glove = whites.filter(p => Math.abs(p.x - edge) < 5 * scale);
    releasePoint = { x: glove.reduce((n, p) => n + p.x, 0) / glove.length / scale - reg[0],
      y: glove.reduce((n, p) => n + p.y, 0) / glove.length / scale - reg[1] };
  }
  return { png: canvas.toDataURL('image/png').split(',')[1], w, h, reg, groundOffset, contactPoints, noContact,
    bodyArea, bodyCentre, releasePoint, referenceFoot, sourceRect: cell.sourceRect, fit: sheet.fit, coreY: sheet.coreY, offset: [dx, dy] };
}
