import { deflateSync } from 'node:zlib';

// Encode the exporter's existing palette indices as an actual 8-bit PNG.
// No dithering, resampling or illustration happens in this format writer.
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1;
  return n >>> 0;
});
function chunk(name, bytes) {
  const type = Buffer.from(name), body = Buffer.concat([type, bytes]);
  let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
  const head = Buffer.alloc(4), tail = Buffer.alloc(4);
  head.writeUInt32BE(bytes.length); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([head, body, tail]);
}
export function indexedPng(width, height, indices, palette, transparent = false) {
  if (indices.length !== width * height || !palette.length || palette.length > 256
    || indices.some(index => index >= palette.length)) throw Error('Invalid indexed PNG geometry or palette');
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 3;
  const rows = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) indices.copy(rows, y * (width + 1) + 1, y * width, (y + 1) * width);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('PLTE', Buffer.from(palette.flat())), ...(transparent ? [chunk('tRNS', Buffer.from(Array.isArray(transparent) ? transparent : [0]))] : []),
    chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Browser-side lossless format conversion, including existing alpha entries.
// Throw rather than silently reduce colors or change an original pixel.
export async function indexImage(url) {
  const image = new Image(); image.src = url; await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const palette = [], alpha = [], colours = new Map(), indices = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < data.length; i += 4) {
    const key = [...data.subarray(i, i + 4)].join(',');
    let n = colours.get(key);
    if (n === undefined) {
      n = palette.length;
      if (n === 256) throw Error('Lossless 8-bit export exceeds 256 RGBA palette entries');
      palette.push([...data.subarray(i, i + 3)]); alpha.push(data[i + 3]); colours.set(key, n);
    }
    indices[i / 4] = n;
  }
  let binary = ''; for (let i = 0; i < indices.length; i += 32768) binary += String.fromCharCode(...indices.subarray(i, i + 32768));
  return { width: canvas.width, height: canvas.height, palette, alpha, indices: btoa(binary) };
}
