import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parseLevelText } from '../src/game/data/levelParser';
import {
  DECOR_SCALE,
  FOOT_PAD,
  GROUND_TILE,
  GROUND_Y,
  RAISED_SCALE,
  UPPER1_Y,
  UPPER2_Y,
  type DecorKey,
  type HighFloorKey,
} from '../src/game/layout';
import type { LevelDef } from '../src/game/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS_DIR = path.join(ROOT, 'assets', 'levels');
const OUT = path.join(ROOT, 'work', 'level-previews');
const SCALE = 0.3;

const manifest = JSON.parse(
  await fs.readFile(path.join(ROOT, 'src', 'game', 'data', 'manifest.json'), 'utf8'),
);
const tileWidths: Record<string, number> = Object.fromEntries(
  Object.entries(manifest.images)
    .filter(([key]) => key.startsWith('high-floor-'))
    .map(([key, info]) => [key, (info as { width: number }).width]),
);

const themeColor: Record<string, string> = {
  day: '#cfe8de',
  dusk: '#2b3f47',
  night: '#0b171d',
};

const assetCache = new Map<string, Buffer>();
async function scaledAsset(key: string, width: number, height: number): Promise<Buffer | null> {
  const info = manifest.images[key];
  if (!info) return null;
  const cacheKey = `${key}:${width}x${height}`;
  const cached = assetCache.get(cacheKey);
  if (cached) return cached;
  const buffer = await sharp(path.join(ROOT, 'public', info.url))
    .resize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), {
      fit: 'fill',
      kernel: 'nearest',
    })
    .png()
    .toBuffer();
  assetCache.set(cacheKey, buffer);
  return buffer;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]!));
}

async function previewLevel(level: LevelDef): Promise<void> {
  const width = Math.ceil(level.width * SCALE);
  const height = Math.ceil(720 * SCALE);
  const layers: sharp.OverlayOptions[] = [];

  for (const platform of level.platforms) {
    if (platform.kind === 'ground') {
      const tiles = platform.tileCount ?? 1;
      for (let index = 0; index < tiles; index++) {
        const image = await scaledAsset('floor-strip', 1942 * SCALE, 302 * SCALE);
        if (image) {
          layers.push({
            input: image,
            left: Math.round((platform.x + index * GROUND_TILE) * SCALE),
            top: Math.round((GROUND_Y - manifest.floor.strip.surfaceOffset) * SCALE),
          });
        }
      }
    } else {
      const row = platform.row ?? 'RAISED1';
      const scales = RAISED_SCALE[row];
      let x = platform.x;
      for (const key of platform.tiles ?? []) {
        const info = manifest.images[key];
        if (!info) continue;
        const scale = scales[key as HighFloorKey] ?? 1;
        const width = Math.round(info.width * scale);
        const image = await scaledAsset(key, width * SCALE, Math.round(info.height * scale) * SCALE);
        if (image) {
          layers.push({
            input: image,
            left: Math.round(x * SCALE),
            top: Math.round((platform.y - (info.surfaceOffset ?? 0) * scale) * SCALE),
          });
        }
        x += width;
      }
    }
  }

  for (const item of level.decor ?? []) {
    const info = manifest.images[item.tile];
    if (!info) continue;
    const scale = DECOR_SCALE[item.tile as DecorKey] ?? 1;
    const image = await scaledAsset(
      item.tile,
      Math.round(info.width * scale) * SCALE,
      Math.round(info.height * scale) * SCALE,
    );
    if (image) {
      layers.push({
        input: image,
        left: Math.round(item.x * SCALE),
        top: Math.round((item.y - info.height * scale) * SCALE),
      });
    }
  }

  const marker = (
    x: number,
    y: number,
    color: string,
    label: string,
    size = 7,
  ): string => {
    const sx = Math.round(x * SCALE);
    const sy = Math.round(y * SCALE);
    return `<circle cx="${sx}" cy="${sy}" r="${size}" fill="${color}" stroke="#081214" stroke-width="1"/>
      <text x="${sx}" y="${sy + 3}" text-anchor="middle" font-family="sans-serif" font-size="8" font-weight="bold" fill="#081214">${escapeXml(label)}</text>`;
  };

  const marks: string[] = [];
  for (const enemy of level.enemies) {
    const y = (enemy.y ?? GROUND_Y + FOOT_PAD) - 70;
    const label = enemy.boss ? 'B' : enemy.flying ? 'F' : enemy.kind === 'doctor' ? 'D' : enemy.kind === 'nurse' ? 'N' : enemy.kind === 'pus' ? 'P' : 'M';
    marks.push(marker(enemy.x, y, enemy.boss ? '#ff6b8a' : enemy.flying ? '#9ad8ff' : '#ffb3c7', label, enemy.boss ? 11 : 7));
  }
  for (const item of level.sushi) {
    marks.push(marker(item.x, item.y, item.kind === 0 || item.kind === 1 ? '#9be86b' : '#ffe08a', item.kind === 0 || item.kind === 1 ? 'G' : 'S', 6));
  }
  if (level.animalX !== undefined) {
    marks.push(marker(level.animalX, GROUND_Y - 76, '#7fd6c1', 'K', 9));
  }

  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="0" y="0" width="${width}" height="18" fill="#081214" opacity="0.55"/>
    <text x="6" y="13" font-family="sans-serif" font-size="11" fill="#eff7f2">#${level.id} ${escapeXml(level.name)} · ${level.theme} · ${level.width}px</text>
    <line x1="0" y1="${GROUND_Y * SCALE}" x2="${width}" y2="${GROUND_Y * SCALE}" stroke="#ffcc55" stroke-width="1" opacity="0.45"/>
    <line x1="0" y1="${UPPER1_Y * SCALE}" x2="${width}" y2="${UPPER1_Y * SCALE}" stroke="#7fd6c1" stroke-width="1" opacity="0.3"/>
    <line x1="0" y1="${UPPER2_Y * SCALE}" x2="${width}" y2="${UPPER2_Y * SCALE}" stroke="#7fd6c1" stroke-width="1" opacity="0.2"/>
    ${marks.join('\n')}
  </svg>`;

  const base = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: themeColor[level.theme] ?? '#0d1b1e',
    },
  });

  await base
    .composite([
      ...layers,
      { input: Buffer.from(overlay), left: 0, top: 0 },
    ])
    .png()
    .toFile(path.join(OUT, `${String(level.id).padStart(2, '0')}.png`));
}

await fs.mkdir(OUT, { recursive: true });
const files = (await fs.readdir(LEVELS_DIR))
  .filter((file) => /^\d+\.txt$/.test(file))
  .sort();

for (const file of files) {
  const text = await fs.readFile(path.join(LEVELS_DIR, file), 'utf8');
  const id = Number(file.replace('.txt', ''));
  const level = parseLevelText(text, id, tileWidths);
  await previewLevel(level);
  console.log(`preview ${file}`);
}
