// Erzeugt die PNG-App-Icons aus public/favicon.svg.  Aufruf: ./dc npm run icons
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile('public/favicon.svg');
await mkdir('public/icons', { recursive: true });

for (const size of [192, 512]) {
  await sharp(svg, { density: 600 }).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
}

// iOS rundet selbst ab → volle Fläche ohne transparente Ecken
const square = Buffer.from(svg.toString().replace('rx="14"', 'rx="0"'));
await sharp(square, { density: 600 }).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');

// Maskable: Motiv mit Rand, damit Android es beliebig zuschneiden kann
const inner = await sharp(square, { density: 600 }).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#2f5e3a' } })
  .composite([{ input: inner, top: 56, left: 56 }])
  .png()
  .toFile('public/icons/icon-maskable-512.png');

console.log('Icons erzeugt in public/icons/');
