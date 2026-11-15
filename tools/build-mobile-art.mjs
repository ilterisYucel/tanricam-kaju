/**
 * Builds native Android art from the same cleaned logo used in the menu:
 * splash screens for every drawable density and launcher icons.
 *
 * Run `npm run assets` first so public/assets/game/logo.png exists.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGO = path.join(ROOT, 'public', 'assets', 'game', 'logo.png');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

const BG = '#0d1b1e';
const BRAND = '#7fd6c1';

function escapeXml(value) {
  return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
}

async function logoBuffer(height) {
  return sharp(LOGO).resize({ height: Math.round(height), fit: 'inside' }).png().toBuffer();
}

async function splash(file) {
  const meta = await sharp(file).metadata();
  const { width, height } = meta;
  const short = Math.min(width, height);
  const logoHeight = Math.round(short * 0.52);
  const logoWidth = Math.round((logoHeight * 136) / 174);
  const centerY = height * 0.42;
  const logoTop = Math.round(centerY - logoHeight / 2);
  const titleY = Math.round(centerY + logoHeight / 2 + short * 0.11);
  const subtitleY = Math.round(titleY + short * 0.075);
  const titleSize = Math.max(14, Math.round(short * 0.073));
  const subtitleSize = Math.max(9, Math.round(short * 0.037));

  const background = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="42%" r="70%">
        <stop offset="0%" stop-color="#173a39"/>
        <stop offset="55%" stop-color="#0e2225"/>
        <stop offset="100%" stop-color="#081214"/>
      </radialGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#7fd6c1" stop-opacity="0.20"/>
        <stop offset="100%" stop-color="#7fd6c1" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <circle cx="${width / 2}" cy="${centerY}" r="${short * 0.43}" fill="url(#glow)"/>
    <text x="${width / 2}" y="${titleY}" text-anchor="middle"
      font-family="Noto Sans, DejaVu Sans, sans-serif" font-weight="700"
      font-size="${titleSize}" fill="#eff7f2">TANRIÇAM &amp; KAJU</text>
    <text x="${width / 2}" y="${subtitleY}" text-anchor="middle"
      font-family="Noto Sans, DejaVu Sans, sans-serif" font-weight="600"
      font-size="${subtitleSize}" letter-spacing="${Math.round(subtitleSize * 0.25)}"
      fill="${BRAND}">HASTANE NÖBETİ</text>
  </svg>`;

  const logo = await logoBuffer(logoHeight);
  await sharp(Buffer.from(background))
    .composite([{ input: logo, left: Math.round((width - logoWidth) / 2), top: logoTop }])
    .png()
    .toFile(file);
  console.log(`splash ${path.relative(ROOT, file)} ${width}x${height}`);
}

async function legacyIcon(file, round) {
  const meta = await sharp(file).metadata();
  const size = meta.width;
  const shape = round
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#bg)"/>`
    : `<rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="url(#bg)"/>`;
  const background = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1b4a45"/><stop offset="100%" stop-color="${BG}"/>
    </radialGradient></defs>
    ${shape}
  </svg>`;
  const logoHeight = Math.round(size * 0.7);
  const logoWidth = Math.round((logoHeight * 136) / 174);
  const logo = await logoBuffer(logoHeight);
  await sharp(Buffer.from(background))
    .composite([{ input: logo, left: Math.round((size - logoWidth) / 2), top: Math.round((size - logoHeight) / 2) }])
    .png()
    .toFile(file);
  console.log(`icon ${path.relative(ROOT, file)} ${size}x${size}${round ? ' round' : ''}`);
}

async function adaptiveForeground(file) {
  const meta = await sharp(file).metadata();
  const size = meta.width;
  const logoHeight = Math.round(size * 0.54);
  const logoWidth = Math.round((logoHeight * 136) / 174);
  const logo = await logoBuffer(logoHeight);
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, left: Math.round((size - logoWidth) / 2), top: Math.round((size - logoHeight) / 2) }])
    .png()
    .toFile(file);
  console.log(`adaptive foreground ${path.relative(ROOT, file)} ${size}x${size}`);
}

async function main() {
  await fs.access(LOGO);

  const drawableDir = path.join(RES, 'drawable');
  const splashFiles = await fs.readdir(RES, { withFileTypes: true });
  for (const entry of splashFiles) {
    if (!entry.isDirectory() || !entry.name.startsWith('drawable')) continue;
    const file = path.join(RES, entry.name, 'splash.png');
    try {
      await fs.access(file);
      await splash(file);
    } catch {
      // No splash in this density.
    }
  }
  const fallback = path.join(drawableDir, 'splash.png');
  await fs.access(fallback);

  for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    const dir = path.join(RES, `mipmap-${density}`);
    await legacyIcon(path.join(dir, 'ic_launcher.png'), false);
    await legacyIcon(path.join(dir, 'ic_launcher_round.png'), true);
    await adaptiveForeground(path.join(dir, 'ic_launcher_foreground.png'));
  }

  const bgFile = path.join(RES, 'values', 'ic_launcher_background.xml');
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BG}</color>
</resources>
`;
  await fs.writeFile(bgFile, bgXml, 'utf8');
  console.log(`launcher background ${path.relative(ROOT, bgFile)} ${BG}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
