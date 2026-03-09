// scripts/svg-to-gif.mjs
// Converts animated SVG to GIF using Puppeteer + gif-encoder-2
// Usage: node scripts/svg-to-gif.mjs

import puppeteer from 'puppeteer';
import GIFEncoder from 'gif-encoder-2';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const INPUT = resolve(__dirname, '../public/email/robot-firma-pro-v2.svg');
const OUTPUT = resolve(__dirname, '../public/email/firma-robot.gif');
// SVG viewBox: 300x130 → scale to 200px wide, proportional height
const WIDTH = 200;
const HEIGHT = Math.round(200 * (130 / 300)); // 87
const FPS = 10;
const DURATION_MS = 10000; // 10s full cycle
const FRAME_DELAY = Math.round(1000 / FPS);
const TOTAL_FRAMES = Math.round(DURATION_MS / FRAME_DELAY);

async function main() {
  console.log(`Converting SVG to GIF: ${TOTAL_FRAMES} frames at ${FPS}fps`);
  console.log(`Size: ${WIDTH}x${HEIGHT}, Duration: ${DURATION_MS}ms`);

  const svgContent = readFileSync(INPUT, 'utf-8');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });

  const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; }
  body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: transparent; }
  svg { width: ${WIDTH}px; height: ${HEIGHT}px; }
</style></head>
<body>${svgContent}</body></html>`;

  await page.setContent(html, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // Use 2x capture for quality, then resize to 1x for GIF
  const capW = WIDTH * 2;
  const capH = HEIGHT * 2;

  const encoder = new GIFEncoder(WIDTH, HEIGHT, 'neuquant', true);
  encoder.setDelay(FRAME_DELAY);
  encoder.setRepeat(0);
  encoder.setTransparent(0x00000000);
  encoder.setQuality(8);
  encoder.start();

  console.log('Capturing frames...');

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const screenshot = await page.screenshot({
      type: 'png',
      omitBackground: true,
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });

    const { createCanvas: cc, loadImage } = await import('canvas');
    const img = await loadImage(screenshot);
    const canvas = cc(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
    const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);

    encoder.addFrame(imageData.data);

    if ((i + 1) % 20 === 0 || i === TOTAL_FRAMES - 1) {
      console.log(`  Frame ${i + 1}/${TOTAL_FRAMES}`);
    }

    await new Promise(r => setTimeout(r, FRAME_DELAY));
  }

  encoder.finish();

  const gifBuffer = encoder.out.getData();
  writeFileSync(OUTPUT, gifBuffer);

  console.log(`GIF saved: ${OUTPUT} (${(gifBuffer.length / 1024).toFixed(0)} KB)`);

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
