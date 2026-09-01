import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const ICONS_DIR = path.resolve('public/icons');
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Simple CRC32 implementation for PNG chunks
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crcVal = crc32(typeAndData);
  chunk.writeUInt32BE(crcVal, 8 + len);
  return chunk;
}

function createPng(width, height, isMaskable = false) {
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  const cx = width / 2;
  const cy = height / 2;
  const radius = isMaskable ? width * 0.48 : width * 0.42;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // filter type: 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = (x - cx);
      const dy = (y - cy);
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background gradient (Dark purple to deep indigo)
      const gradT = (x + y) / (width + height);
      let r = Math.floor(13 + gradT * (109 - 13));
      let g = Math.floor(6 + gradT * (40 - 6));
      let b = Math.floor(26 + gradT * (217 - 26));
      let a = 255;

      if (!isMaskable) {
        // Rounded squircle corner
        const cornerR = width * 0.22;
        const cornerDx = Math.max(0, Math.abs(x - cx) - (cx - cornerR));
        const cornerDy = Math.max(0, Math.abs(y - cy) - (cy - cornerR));
        const cDist = Math.sqrt(cornerDx * cornerDx + cornerDy * cornerDy);
        if (cDist > cornerR) {
          a = 0; // transparent outside rounded container
        } else if (cDist > cornerR - 2) {
          a = Math.floor(255 * ((cornerR - cDist) / 2));
        }
      }

      if (a > 0) {
        // Draw stylized Glowing "Z" Logo in center
        const nx = (x - cx) / (width * 0.3); // normalized -1 to 1
        const ny = (y - cy) / (height * 0.3); // normalized -1 to 1

        let isZ = false;
        // Top bar of Z: y in [-0.8, -0.4], x in [-0.75, 0.75]
        if (ny >= -0.85 && ny <= -0.45 && nx >= -0.75 && nx <= 0.75) isZ = true;
        // Bottom bar of Z: y in [0.45, 0.85], x in [-0.75, 0.75]
        if (ny >= 0.45 && ny <= 0.85 && nx >= -0.75 && nx <= 0.75) isZ = true;
        // Diagonal of Z: line connecting (0.75, -0.65) to (-0.75, 0.65)
        const diagPos = (nx + ny * 1.15); // near 0
        if (Math.abs(diagPos) < 0.42 && ny >= -0.65 && ny <= 0.65 && nx >= -0.8 && nx <= 0.8) {
          isZ = true;
        }

        // Inner glowing dot / star accent in center
        const centerDist = Math.sqrt(nx * nx + ny * ny);
        if (centerDist < 0.2) {
          isZ = true;
        }

        if (isZ) {
          // Vibrant Violet-Cyan gradient for the Z logo
          const zT = (nx + 1) / 2;
          r = Math.floor(240 - zT * 60);
          g = Math.floor(180 + zT * 60);
          b = 255;
        } else {
          // Subtle circular halo / ring
          const ringDist = Math.abs(dist - radius * 0.8);
          if (ringDist < width * 0.015) {
            r = Math.min(255, r + 70);
            g = Math.min(255, g + 50);
            b = Math.min(255, b + 100);
          }
        }
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit depth
  ihdr[9] = 6; // Color type 6: RGBA
  ihdr[10] = 0; // Compression method (deflate)
  ihdr[11] = 0; // Filter method
  ihdr[12] = 0; // Interlace (none)

  const compressed = zlib.deflateSync(rawData);

  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate Icons
console.log('Generating PNG icons for PWA...');
fs.writeFileSync(path.join(ICONS_DIR, 'icon-192x192.png'), createPng(192, 192, false));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-512x512.png'), createPng(512, 512, false));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-maskable-192x192.png'), createPng(192, 192, true));
fs.writeFileSync(path.join(ICONS_DIR, 'icon-maskable-512x512.png'), createPng(512, 512, true));
fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.png'), createPng(180, 180, false));

// Also generate SVG version
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c051a" />
      <stop offset="50%" stop-color="#3b0764" />
      <stop offset="100%" stop-color="#4f46e5" />
    </linearGradient>
    <linearGradient id="zGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c084fc" />
      <stop offset="50%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#38bdf8" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="115" fill="url(#bgGrad)" />
  <circle cx="256" cy="256" r="200" fill="none" stroke="#a855f7" stroke-width="3" stroke-opacity="0.3" stroke-dasharray="8 8" />
  <path d="M 140 145 L 372 145 L 372 195 L 210 325 L 372 325 L 372 375 L 140 375 L 140 325 L 302 195 L 140 195 Z" fill="url(#zGrad)" filter="url(#glow)" />
  <circle cx="256" cy="260" r="14" fill="#ffffff" filter="url(#glow)" />
</svg>`;

fs.writeFileSync(path.join(ICONS_DIR, 'icon.svg'), svgContent);
fs.writeFileSync(path.resolve('public/favicon.svg'), svgContent);

console.log('PWA Icons successfully generated in /public/icons and /public/favicon.svg');
