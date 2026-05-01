#!/usr/bin/env node
// Icon generator for Auditera.Mobile
// Produces: icon.png, adaptive-icon.png, splash-icon.png, favicon.png
// Design: Letter "A" inside a 4-corner scan/viewfinder frame on #1a1a2e background

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const BRAND_BG = '#1a1a2e';
const WHITE = '#ffffff';

/**
 * Builds the SVG markup for the icon.
 * @param {number} size - Canvas size in px
 * @param {boolean} transparentBg - Whether background is transparent (for splash)
 */
function buildIconSvg(size, transparentBg = false) {
  const S = size;
  const pad = Math.round(S * 0.08);           // 8% edge padding
  const cornerLen = Math.round(S * 0.26);     // Length of each corner arm
  const strokeW = Math.round(S * 0.051);      // Stroke width (~52px at 1024)
  const r = Math.round(S * 0.045);            // Corner radius
  const half = strokeW / 2;

  // Corner coordinates (inner corner point of each L-bracket)
  const tl = { x: pad, y: pad };
  const tr = { x: S - pad, y: pad };
  const bl = { x: pad, y: S - pad };
  const br = { x: S - pad, y: S - pad };

  const corners = `
    <!-- Top-left corner -->
    <path d="M ${tl.x + cornerLen} ${tl.y} L ${tl.x} ${tl.y} L ${tl.x} ${tl.y + cornerLen}"
      fill="none" stroke="${WHITE}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Top-right corner -->
    <path d="M ${tr.x - cornerLen} ${tr.y} L ${tr.x} ${tr.y} L ${tr.x} ${tr.y + cornerLen}"
      fill="none" stroke="${WHITE}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Bottom-left corner -->
    <path d="M ${bl.x} ${bl.y - cornerLen} L ${bl.x} ${bl.y} L ${bl.x + cornerLen} ${bl.y}"
      fill="none" stroke="${WHITE}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Bottom-right corner -->
    <path d="M ${br.x - cornerLen} ${br.y} L ${br.x} ${br.y} L ${br.x} ${br.y - cornerLen}"
      fill="none" stroke="${WHITE}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>
  `;

  // Letter A — positioned center, bold weight, ~37% of canvas height
  const fontSize = Math.round(S * 0.42);
  // Nudge slightly up to account for font descender space
  const textY = Math.round(S * 0.695);

  const bg = transparentBg
    ? ''
    : `<rect width="${S}" height="${S}" fill="${BRAND_BG}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  ${bg}
  ${corners}
  <text
    x="${S / 2}"
    y="${textY}"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="800"
    text-anchor="middle"
    fill="${WHITE}"
    letter-spacing="-2"
  >A</text>
</svg>`;
}

/**
 * Renders an SVG string to a PNG file via sharp.
 */
async function renderSvgToPng(svgString, outputPath, size) {
  await sharp(Buffer.from(svgString))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
  const stat = fs.statSync(outputPath);
  console.log(`  ✓ ${path.basename(outputPath)} (${size}×${size}, ${Math.round(stat.size / 1024)} KB)`);
}

async function main() {
  console.log('Generating Auditera icons...\n');

  // icon.png — full background, used by iOS App Store + Android legacy
  await renderSvgToPng(
    buildIconSvg(1024, false),
    path.join(ASSETS_DIR, 'icon.png'),
    1024
  );

  // adaptive-icon.png — Android adaptive icon foreground
  // Background is set separately in app.json (#1a1a2e), so we include it here too
  // for consistency (safe zone ensures it looks good even when clipped)
  await renderSvgToPng(
    buildIconSvg(1024, false),
    path.join(ASSETS_DIR, 'adaptive-icon.png'),
    1024
  );

  // splash-icon.png — shown on splash screen on top of #1a1a2e background
  // Using opaque background variant so it blends seamlessly
  await renderSvgToPng(
    buildIconSvg(1024, false),
    path.join(ASSETS_DIR, 'splash-icon.png'),
    1024
  );

  // favicon.png — browser/web favicon at 48×48
  await renderSvgToPng(
    buildIconSvg(48, false),
    path.join(ASSETS_DIR, 'favicon.png'),
    48
  );

  console.log('\nDone. Run `npx expo prebuild --clean` to bake icons into native projects.');
}

main().catch((err) => {
  console.error('Icon generation failed:', err.message);
  process.exit(1);
});
