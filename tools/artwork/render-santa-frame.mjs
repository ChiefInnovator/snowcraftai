// Browser-side atlas registration. One torso scale and one ground calibration
// keep the character steady throughout each generated animation sheet.
export async function renderSantaFrame({ url, entry, scale, atlas, palette }) {
  const cache = globalThis.santaAtlasCache || (globalThis.santaAtlasCache = new Map());
  let sheet = cache.get(url);
  if (!sheet) {
    const image = new Image(); image.src = url; await image.decode();
    const cols = atlas?.cols || 1, rows = atlas?.rows || 1, cells = [];
    for (let n = 0; n < cols * rows; n++) {
      const x = Math.round(n % cols * image.width / cols), y = Math.round(Math.floor(n / cols) * image.height / rows);
      const w = Math.round((n % cols + 1) * image.width / cols) - x;
      const h = Math.round((Math.floor(n / cols) + 1) * image.height / rows) - y;
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h).data, bounds = [w, h, -1, -1];
      const reds = new Uint32Array(h), boots = new Uint32Array(h);
      let clear = 0;
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4, a = pixels[i + 3];
        if (!a) clear++;
        if (a <= 16) continue;
        bounds[0] = Math.min(bounds[0], px); bounds[1] = Math.min(bounds[1], py);
        bounds[2] = Math.max(bounds[2], px); bounds[3] = Math.max(bounds[3], py);
        if (a >= 160 && pixels[i] > 60 && pixels[i] > pixels[i + 1] * 1.3 && pixels[i] > pixels[i + 2] * 1.2) reds[py]++;
      }
      const redTop = reds.findIndex(count => count >= Math.max(2, w * 0.012));
      if (!clear || redTop < 0 || bounds[2] < bounds[0]) throw Error('Santa cell lacks a transparent background or character: ' + n);
      let bootX = 0, bootCount = 0, footY = -1;
      for (let py = bounds[3] - Math.floor((bounds[3] - bounds[1]) * 0.2); py <= bounds[3]; py++) {
        for (let px = bounds[0]; px <= bounds[2]; px++) {
          const i = (py * w + px) * 4;
          if (pixels[i + 3] >= 160 && pixels[i] < 110 && pixels[i + 1] < 110 && pixels[i + 2] < 110) {
            boots[py]++; bootX += px; bootCount++;
          }
        }
      }
      for (let py = 0; py < h; py++) if (boots[py] >= Math.max(2, w * 0.012)) footY = py;
      if (!bootCount || footY < 0) throw Error('Santa cell lacks solid boot soles: ' + n);
      bootX /= bootCount;
      let beltX = 0, beltY = 0, beltCount = 0;
      for (let py = Math.floor(redTop + (footY - redTop) * 0.5); py < redTop + (footY - redTop) * 0.83; py++) {
        for (let px = bounds[0]; px <= bounds[2]; px++) {
          const i = (py * w + px) * 4;
          if (pixels[i + 3] >= 160 && pixels[i] > 120 && pixels[i + 1] > 80 && pixels[i + 2] < pixels[i + 1] * 0.7) {
            beltX += px; beltY += py; beltCount++;
          }
        }
      }
      if (atlas && !beltCount) throw Error('Santa atlas cell lacks a belt anchor: ' + n);
      if (beltCount) { beltX /= beltCount; beltY /= beltCount; }
      cells.push({ canvas, bounds, redTop, footY, bootX, beltX, beltY, sourceRect: [x, y, w, h] });
    }
    const spans = cells.filter((_, i) => !atlas?.airborne?.includes(i)).map(c => (c.footY - c.beltY) * 26 / (c.beltY - c.redTop)).sort((a, b) => a - b);
    const reference = atlas?.referenceIndex === undefined ? null : cells[atlas.referenceIndex];
    const sharedFit = reference ? 40 / (reference.footY - reference.redTop) : null;
    sheet = { cells, sharedFit, beltTarget: entry.reg[1] - (reference
      ? (reference.footY - reference.beltY) * sharedFit : spans[Math.floor(spans.length / 2)]) };
    cache.set(url, sheet);
  }
  const cell = sheet.cells[atlas?.index || 0], { bounds, redTop, footY } = cell;
  const airborne = !!atlas?.airborne?.includes(atlas.index);
  const anchorX = atlas ? cell.beltX : cell.bootX;
  let fit = sheet.sharedFit ?? (atlas ? 26 / (cell.beltY - redTop) : 40 / (footY - redTop));
  if (!atlas) {
    fit = Math.min(fit, (entry.reg[0] - 0.5) / Math.max(1, anchorX - bounds[0]),
      (entry.w - entry.reg[0] - 0.5) / Math.max(1, bounds[2] - anchorX),
      (entry.reg[1] - 0.5) / (footY - bounds[1]));
  }
  const snap = value => sheet.sharedFit && scale === 1 ? Math.round(value) : value;
  const dx = snap(entry.reg[0] - anchorX * fit);
  const dy = snap(atlas ? sheet.beltTarget - cell.beltY * fit : entry.reg[1] - footY * fit);
  const canvas = document.createElement('canvas'); canvas.width = entry.w * scale; canvas.height = entry.h * scale;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = scale > 1; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cell.canvas, dx * scale, dy * scale, cell.canvas.width * fit * scale, cell.canvas.height * fit * scale);
  const exported = ctx.getImageData(0, 0, canvas.width, canvas.height), data = exported.data;
  // Mechanical 8-bit export of the image_gen master: one palette, no dithering,
  // binary alpha. Do this before deriving sole/contact geometry.
  let indices = null;
  if (palette) {
    indices = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 160) { data.fill(0, i, i + 4); continue; }
      let nearest = 0, distance = Infinity;
      for (let n = 0; n < palette.length; n++) {
        const c = palette[n], d = (data[i] - c[0]) ** 2 + (data[i + 1] - c[1]) ** 2 + (data[i + 2] - c[2]) ** 2;
        if (d < distance) { nearest = n; distance = d; }
      }
      data.set([...palette[nearest], 255], i); indices[i / 4] = nearest + 1;
    }
    ctx.putImageData(exported, 0, 0);
  }
  let soleRow = -1;
  const black = i => data[i + 3] >= 160 && data[i] < 110 && data[i + 1] < 110 && data[i + 2] < 110;
  for (let y = 42 * scale; y < Math.min(canvas.height, 62 * scale); y++) {
    let count = 0; for (let x = 0; x < canvas.width; x++) if (black((y * canvas.width + x) * 4)) count++;
    if (count >= Math.max(1, scale * 0.4)) soleRow = y;
  }
  if (soleRow < 0) throw Error('Exported Santa has no boots: ' + entry.id);
  const groundOffset = airborne ? 1 : soleRow / scale - entry.reg[1];
  const contactPoints = [], occupied = [];
  if (!airborne) {
    for (let x = 0; x < canvas.width; x++) {
      let count = 0;
      for (let y = palette ? soleRow : Math.max(0, soleRow - Math.ceil(1.1 * scale)); y <= soleRow; y++) if (black((y * canvas.width + x) * 4)) count++;
      occupied[x] = count > 0;
    }
    let start = -1;
    for (let x = 0; x <= occupied.length; x++) {
      if (occupied[x] && start < 0) start = x;
      if (!occupied[x] && start >= 0) {
        if ((x - start) / scale >= 1) {
          if (!palette) {
            contactPoints.push({ x: (start + x - 1) / (2 * scale) - entry.reg[0], y: groundOffset, width: (x - start) / scale });
            start = -1; continue;
          }
          const centre = (start + x - 1) / 2;
          let support = null;
          for (let y = soleRow; y >= soleRow - Math.ceil(1.1 * scale) && !support; y--) {
            for (let px = start; px < x; px++) if (black((y * canvas.width + px) * 4)
              && (!support || Math.abs(px - centre) < Math.abs(support.x - centre))) support = { x: px, y };
          }
          contactPoints.push({ x: support.x / scale - entry.reg[0], y: support.y / scale - entry.reg[1], width: (x - start) / scale });
        }
        start = -1;
      }
    }
    contactPoints.sort((a, b) => b.width - a.width); contactPoints.splice(2);
    if (!contactPoints.length) throw Error('Grounded Santa lacks a supporting sole: ' + entry.id);
    if ((entry.id === 'peek' || entry.id === 'wink' || entry.id.startsWith('wave_') || entry.id.startsWith('nose_')) && contactPoints.length === 1 && contactPoints[0].width > 8) {
      const point = contactPoints.pop();
      contactPoints.push({ x: point.x - point.width / 4, y: point.y, width: point.width / 2 },
        { x: point.x + point.width / 4, y: point.y, width: point.width / 2 });
    }
  }
  const corners = [data[3], data[(canvas.width - 1) * 4 + 3], data[(canvas.height - 1) * canvas.width * 4 + 3], data[data.length - 1]];
  if (corners.some(a => a > 2)) throw Error('Clipped Santa cell: ' + entry.id);
  // Test the entire frame edge, so no raised glove or extended boot gets cut.
  for (let x = 0; x < canvas.width; x++) if (data[x * 4 + 3] > 16 || data[((canvas.height - 1) * canvas.width + x) * 4 + 3] > 16) throw Error('Santa crosses vertical cell edge: ' + entry.id);
  for (let y = 0; y < canvas.height; y++) if (data[(y * canvas.width) * 4 + 3] > 16 || data[(y * canvas.width + canvas.width - 1) * 4 + 3] > 16) throw Error('Santa crosses horizontal cell edge: ' + entry.id);
  const contactFoot = [contactPoints.length ? contactPoints[0].x : 0, 0, 4];
  return { png: canvas.toDataURL('image/png').split(',')[1], indices: indices ? btoa(String.fromCharCode(...indices)) : null,
    bounds, sourceSize: [cell.canvas.width, cell.canvas.height], sourceRect: cell.sourceRect,
    fit, offset: [dx, dy], sourceFoot: [anchorX, footY], bodyCore: { span: atlas ? (sheet.sharedFit ? (cell.beltY - redTop) * fit : 26) : null, beltY: atlas ? sheet.beltTarget : null },
    groundOffset, contactPoints, contactFoot, airborne, corners };
}
