// Runs inside the export browser. Project the actual HD pose onto the snow;
// these are renderer-generated light masks, not new character illustrations.
export async function renderShadow({ frame, png, scale }) {
  const image = new Image(); image.src = 'data:image/png;base64,' + png; await image.decode();
  const mask = document.createElement('canvas'); mask.width = image.width; mask.height = image.height;
  const source = mask.getContext('2d'); source.drawImage(image, 0, 0);
  const pixels = source.getImageData(0, 0, mask.width, mask.height).data;
  const bounds = [mask.width, mask.height, 0, 0], boots = [...bounds];
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
    const i = (y * mask.width + x) * 4;
    if (pixels[i + 3] < 160) continue;
    bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
    bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    if (b > 45 && b > r * 1.15 && b > g * 1.3) {
      boots[0] = Math.min(boots[0], x); boots[1] = Math.min(boots[1], y);
      boots[2] = Math.max(boots[2], x); boots[3] = Math.max(boots[3], y);
    }
  }
  source.globalCompositeOperation = 'source-in';
  source.fillStyle = '#49647c'; source.fillRect(0, 0, mask.width, mask.height);
  const grounded = [9, 10, 14, 15, 16, 32, 33, 34, 35, 36].includes(frame.num);
  const footX = (boots[0] + boots[2]) / (2 * scale) - frame.reg[0];
  const footY = boots[3] / scale - frame.reg[1];
  const radius = Math.max(5, Math.min(9, (boots[2] - boots[0]) / (2 * scale)));
  // Light comes from upper-left. Height projects right/down, with a darker
  // contact at the boots and a broad, faint penumbra farther from the body.
  const projection = grounded
    ? [1, 0, 0, 1, 0.7, 0.9]
    : [1, 0.06, -0.72, -0.32, 0.72 * footY, 1.32 * footY - 0.06 * footX];
  const project = (x, y) => [projection[0] * x + projection[2] * y + projection[4], projection[1] * x + projection[3] * y + projection[5]];
  const corners = [
    [bounds[0], bounds[1]], [bounds[2], bounds[1]],
    [bounds[0], bounds[3]], [bounds[2], bounds[3]]
  ].map(([x, y]) => project(x / scale - frame.reg[0], y / scale - frame.reg[1]));
  if (!grounded) corners.push([footX - radius, footY - 2], [footX + radius, footY + 2]);
  const left = Math.floor(Math.min(...corners.map(p => p[0])) - 6);
  const top = Math.floor(Math.min(...corners.map(p => p[1])) - 6);
  const w = Math.ceil(Math.max(...corners.map(p => p[0])) + 6) - left;
  const h = Math.ceil(Math.max(...corners.map(p => p[1])) + 6) - top;
  const canvas = document.createElement('canvas'); canvas.width = w * scale; canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale); ctx.translate(-left, -top);
  for (const [blur, alpha] of grounded ? [[1.2, 0.14], [0.45, 0.12]] : [[1.9, 0.14], [0.8, 0.16]]) {
    ctx.save(); ctx.filter = `blur(${blur * scale}px)`; ctx.globalAlpha = alpha;
    ctx.transform(...projection);
    ctx.drawImage(mask, -frame.reg[0], -frame.reg[1], frame.w, frame.h); ctx.restore();
  }
  if (!grounded) {
    ctx.save(); ctx.filter = `blur(${0.7 * scale}px)`; ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#334f67'; ctx.beginPath(); ctx.ellipse(footX, footY, radius, 1.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  return { png: canvas.toDataURL('image/png').split(',')[1], key: 'hd_shadow_' + frame.key,
    file: 'shadow_' + frame.file, w, h, reg: [-left, -top], pixelScale: scale, kind: grounded ? 'grounded' : 'standing' };
}
