/**
 * Asset pipeline for Tanricam & Kaju.
 *
 * 1. Removes the baked-in checkerboard background from the AI sprite sheets.
 * 2. Extracts individual frames with connected components (the sheets are not
 *    on a reliable grid).
 * 3. Normalises each animation to a bottom-centred horizontal strip.
 * 4. Emits a manifest consumed by the Phaser preloader.
 *
 * The background pass is intentionally local: the checkerboard is a known,
 * connected region, so a border flood-fill is more predictable than a
 * generative background remover and keeps the pixel-art outlines intact.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'assets');
const OUT = path.join(ROOT, 'public', 'assets', 'game');
const WORK = path.join(ROOT, 'work');
const CLEAN = path.join(WORK, 'clean');
const CONTACT = path.join(WORK, 'contact');

const FLOOR_SURFACE_OFFSET = 150;

const FRAME_CONFIG = {
  tanricam: {
    mode: 'components',
    minArea: 900,
    groups: [
      { key: 'hero-walk', row: 0, indices: [0, 1, 2, 3, 4, 5, 6], cellW: 134, cellH: 201 },
      { key: 'hero-idle', row: 1, indices: [0, 3, 4, 5, 6], cellW: 134, cellH: 201 },
      { key: 'hero-run', row: 1, indices: [1, 2], cellW: 134, cellH: 201 },
    ],
  },
  kaju: {
    mode: 'components',
    minArea: 600,
    groups: [
      { key: 'kaju-run', row: 0, indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    ],
  },
  doktor: {
    mode: 'components',
    minArea: 600,
    groups: [
      { key: 'doctor-walk', row: 0, indices: [0, 1, 2, 3, 4, 5, 6], cellW: 77, cellH: 115 },
      { key: 'doctor-charge', row: 0, indices: [7, 8, 9], cellW: 77, cellH: 115 },
    ],
  },
  hemsire: {
    mode: 'components',
    minArea: 600,
    groups: [
      { key: 'nurse-walk', row: 0, indices: [0, 1, 2, 3, 4, 5, 6], cellW: 71, cellH: 114 },
      { key: 'nurse-attack', row: 0, indices: [7, 8], cellW: 71, cellH: 114 },
    ],
  },
  mikrop: {
    mode: 'components',
    minArea: 500,
    groups: [
      { key: 'microbe-skins', row: 0, indices: [0, 1, 2, 3, 4] },
    ],
  },
  iltihap: {
    mode: 'components',
    minArea: 500,
    groups: [
      { key: 'pus-stages', row: 0, indices: [0, 1, 2, 3, 4] },
    ],
  },
  susi: {
    mode: 'grid',
    grid: { cols: 6, rows: 1 },
    images: ['sushi-0', 'sushi-1', 'sushi-2', 'sushi-3', 'sushi-4', 'sushi-5'],
  },
  helpless: {
    mode: 'animals',
    minArea: 80,
    rowGap: 70,
    animals: true,
  },
};

const MANUAL_CROPS = {
  high_floor: {
    'high-floor-a': { x: 34, y: 34, w: 501, h: 441, surfaceOffset: 0 },
    'high-floor-b': { x: 565, y: 139, w: 419, h: 266, surfaceOffset: 0 },
    'high-floor-c': { x: 1030, y: 111, w: 270, h: 371, surfaceOffset: 193 },
    'high-floor-e': { x: 1672, y: 59, w: 326, h: 410, surfaceOffset: 125 },
    'high-floor-decor': { x: 1351, y: 139, w: 260, h: 296 },
  },
  dolma: {
    'dolma': { x: 55, y: 20, w: 75, h: 70 },
  },
  domestos: {
    'domestos-bottle': { x: 174, y: 69, w: 123, h: 75 },
    'domestos-bottle-b': { x: 9, y: 56, w: 87, h: 98 },
    'domestos-burst': { x: 392, y: 152, w: 142, h: 78 },
  },
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function backgroundLike(r, g, b, a) {
  if (a < 28) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum >= 168 && chroma <= 32;
}

async function readRGBA(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function writePNG(file, data, width, height) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(file);
}

/**
 * Border flood-fill. Only background connected to the image edge is removed,
 * so white areas enclosed by a sprite outline (coats, rice, pillows) survive.
 */
function removeCheckerboard(rgba, width, height) {
  const data = Buffer.from(rgba);
  const total = width * height;
  const seen = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const at = (x, y) => (y * width + x) * 4;
  const push = (x, y) => {
    const p = y * width + x;
    if (seen[p]) return;
    const i = p * 4;
    if (!backgroundLike(data[i], data[i + 1], data[i + 2], data[i + 3])) return;
    seen[p] = 1;
    queue[tail++] = p;
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) push(x - 1, y);
    if (x + 1 < width) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y + 1 < height) push(x, y + 1);
  }

  for (let p = 0; p < total; p++) {
    if (seen[p]) data[p * 4 + 3] = 0;
  }

  // Remove the bright one-pixel halo left by anti-aliasing against the
  // checkerboard. Dark outlines are untouched.
  const alphaAt = (x, y) => data[(y * width + x) * 4 + 3];
  for (let pass = 0; pass < 2; pass++) {
    const snapshot = Buffer.from(data);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (snapshot[i + 3] === 0) continue;
        const transparentNeighbor =
          (x > 0 && alphaAt(x - 1, y) === 0) ||
          (x + 1 < width && alphaAt(x + 1, y) === 0) ||
          (y > 0 && alphaAt(x, y - 1) === 0) ||
          (y + 1 < height && alphaAt(x, y + 1) === 0);
        if (!transparentNeighbor) continue;
        const r = snapshot[i];
        const g = snapshot[i + 1];
        const b = snapshot[i + 2];
        const a = snapshot[i + 3];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const chroma = max - min;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (chroma <= 28 && lum >= 232) {
          data[i + 3] = 0;
        } else if (chroma <= 28 && lum >= 205) {
          data[i + 3] = Math.round(a * 0.4);
        }
      }
    }
  }

  return data;
}

function componentBBoxes(data, width, height, minArea) {
  const total = width * height;
  const seen = new Uint8Array(total);
  const stack = new Int32Array(total);
  const comps = [];

  for (let start = 0; start < total; start++) {
    if (seen[start]) continue;
    if (data[start * 4 + 3] <= 40) {
      seen[start] = 1;
      continue;
    }
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let sumX = 0;
    let sumY = 0;

    while (top > 0) {
      const p = stack[--top];
      const x = p % width;
      const y = (p / width) | 0;
      area++;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = ny * width + nx;
          if (seen[np]) continue;
          seen[np] = 1;
          if (data[np * 4 + 3] > 40) stack[top++] = np;
        }
      }
    }

    if (area >= minArea) {
      comps.push({
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
        area,
        cx: sumX / area,
        cy: sumY / area,
      });
    }
  }

  return comps;
}

function mergeSmallComponents(comps) {
  if (comps.length === 0) return comps;
  const areas = comps.map((c) => c.area).sort((a, b) => a - b);
  const median = areas[Math.floor(areas.length / 2)];
  const small = new Set(comps.filter((c) => c.area < median * 0.12));
  if (small.size === 0) return comps;

  const large = comps.filter((c) => !small.has(c));
  const merged = comps.filter((c) => !small.has(c)).map((c) => ({ ...c }));

  for (const c of comps) {
    if (!small.has(c)) continue;
    let nearest = null;
    let best = Infinity;
    for (const big of large) {
      const dx = Math.max(big.x - (c.x + c.w), c.x - (big.x + big.w), 0);
      const dy = Math.max(big.y - (c.y + c.h), c.y - (big.y + big.h), 0);
      const dist = Math.hypot(dx, dy);
      if (dist < 36 && dy < 24 && dist < best) {
        best = dist;
        nearest = big;
      }
    }
    if (nearest) {
      const target = merged.find((m) => m.x === nearest.x && m.y === nearest.y && m.area === nearest.area);
      if (target) {
        const x = Math.min(target.x, c.x);
        const y = Math.min(target.y, c.y);
        const x2 = Math.max(target.x + target.w, c.x + c.w);
        const y2 = Math.max(target.y + target.h, c.y + c.h);
        target.x = x;
        target.y = y;
        target.w = x2 - x;
        target.h = y2 - y;
      }
    } else {
      merged.push({ ...c });
    }
  }
  return merged;
}

function splitRows(comps, rowGap = 70) {
  const sorted = [...comps].sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const c of sorted) {
    const last = rows[rows.length - 1];
    if (!last || c.cy - last.cy > rowGap) {
      rows.push({ cy: c.cy, comps: [c] });
    } else {
      last.comps.push(c);
    }
  }
  for (const row of rows) {
    row.comps.sort((a, b) => a.x - b.x);
  }
  return rows;
}

function cropRGBA(data, width, bbox) {
  const out = Buffer.alloc(bbox.w * bbox.h * 4);
  for (let y = 0; y < bbox.h; y++) {
    const src = ((bbox.y + y) * width + bbox.x) * 4;
    data.copy(out, y * bbox.w * 4, src, src + bbox.w * 4);
  }
  return out;
}

function bboxAlpha(data, width, x0, y0, x1, y1, pad = 0) {
  let minX = x1;
  let minY = y1;
  let maxX = -1;
  let maxY = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (data[(y * width + x) * 4 + 3] > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  minX = clamp(minX - pad, x0, x1 - 1);
  minY = clamp(minY - pad, y0, y1 - 1);
  maxX = clamp(maxX + pad, x0, x1 - 1);
  maxY = clamp(maxY + pad, y0, y1 - 1);
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

async function makeStrip(frames, outFile, pad = 4, target = null) {
  const naturalW = Math.max(...frames.map((f) => f.bbox.w)) + pad * 2;
  const naturalH = Math.max(...frames.map((f) => f.bbox.h)) + pad * 2;
  const cellW = target?.cellW ?? naturalW;
  const cellH = target?.cellH ?? naturalH;
  if (cellW < naturalW || cellH < naturalH) {
    throw new Error(`target cell ${cellW}x${cellH} is smaller than ${naturalW}x${naturalH}`);
  }
  const sheetW = cellW * frames.length;
  const canvas = Buffer.alloc(sheetW * cellH * 4);

  frames.forEach((frame, index) => {
    const destX = index * cellW + Math.floor((cellW - frame.bbox.w) / 2);
    const destY = cellH - pad - frame.bbox.h;
    const cropped = cropRGBA(frame.data, frame.width, frame.bbox);
    for (let y = 0; y < frame.bbox.h; y++) {
      const src = y * frame.bbox.w * 4;
      const dst = ((destY + y) * sheetW + destX) * 4;
      cropped.copy(canvas, dst, src, src + frame.bbox.w * 4);
    }
  });

  await writePNG(outFile, canvas, sheetW, cellH);
  return { frameWidth: cellW, frameHeight: cellH, count: frames.length };
}

async function makeSingle(data, width, bbox, outFile) {
  const cropped = cropRGBA(data, width, bbox);
  await writePNG(outFile, cropped, bbox.w, bbox.h);
  return { width: bbox.w, height: bbox.h };
}

async function contactSheet(sourceFile, cleanData, width, height, name) {
  const magenta = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    magenta[i * 4] = 255;
    magenta[i * 4 + 1] = 0;
    magenta[i * 4 + 2] = 255;
    magenta[i * 4 + 3] = 255;
  }
  const overlay = Buffer.from(magenta);
  for (let i = 0; i < width * height; i++) {
    const a = cleanData[i * 4 + 3] / 255;
    if (a === 0) continue;
    overlay[i * 4] = Math.round(cleanData[i * 4] * a + 255 * (1 - a));
    overlay[i * 4 + 1] = Math.round(cleanData[i * 4 + 1] * a);
    overlay[i * 4 + 2] = Math.round(cleanData[i * 4 + 2] * a + 255 * (1 - a));
  }
  await writePNG(path.join(CONTACT, `${name}-magenta.png`), overlay, width, height);
  await sharp(sourceFile)
    .resize({ width: Math.min(width, 1600) })
    .png()
    .toFile(path.join(CONTACT, `${name}-source.png`));
}

async function processSheet(name, config) {
  const file = path.join(RAW, `${name}.png`);
  const { data, width, height } = await readRGBA(file);
  const clean = removeCheckerboard(data, width, height);
  await writePNG(path.join(CLEAN, `${name}.png`), clean, width, height);
  await contactSheet(file, clean, width, height, name);

  const manifestSheets = {};
  const manifestImages = {};

  if (config.mode === 'components') {
    const comps = mergeSmallComponents(componentBBoxes(clean, width, height, config.minArea));
    const rows = splitRows(comps, config.rowGap ?? 70);
    if (config.groups) {
      for (const group of config.groups) {
        const row = rows[group.row];
        if (!row) throw new Error(`${name}: missing row ${group.row}`);
        const frames = group.indices.map((index) => {
          const c = row.comps[index];
          if (!c) throw new Error(`${name}: missing frame ${index} in row ${group.row}`);
          return { data: clean, width, bbox: { x: c.x, y: c.y, w: c.w, h: c.h } };
        });
        const meta = await makeStrip(frames, path.join(OUT, `${group.key}.png`), 4, group);
        manifestSheets[group.key] = { url: `assets/game/${group.key}.png`, ...meta };
      }
    }
  }

  if (config.mode === 'grid') {
    const { cols, rows } = config.grid;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellIndex = row * cols + col;
        const x0 = Math.round((col * width) / cols);
        const x1 = Math.round(((col + 1) * width) / cols);
        const y0 = Math.round((row * height) / rows);
        const y1 = Math.round(((row + 1) * height) / rows);
        const bbox = bboxAlpha(clean, width, x0, y0, x1, y1, 2);
        if (!bbox) continue;
        const key = config.images[cellIndex];
        if (!key) continue;
        const meta = await makeSingle(clean, width, bbox, path.join(OUT, `${key}.png`));
        manifestImages[key] = { url: `assets/game/${key}.png`, ...meta };
      }
    }
  }

  if (config.mode === 'animals') {
    const comps = componentBBoxes(clean, width, height, config.minArea ?? 80);
    const rows = splitRows(comps, config.rowGap ?? 70);
    if (rows.length !== 3) throw new Error(`${name}: expected 3 animal rows, got ${rows.length}`);
    const animals = [];
    for (const [rowIndex, row] of rows.entries()) {
      if (row.comps.length !== 13) {
        throw new Error(`${name}: expected 13 animals in row ${rowIndex}, got ${row.comps.length}`);
      }
      animals.push(...row.comps);
    }
    if (animals.length !== 39) throw new Error(`${name}: expected 39 animals, got ${animals.length}`);

    for (const [index, c] of animals.entries()) {
      const key = `animal-${String(index).padStart(2, '0')}`;
      const bbox = { x: c.x, y: c.y, w: c.w, h: c.h };
      const meta = await makeSingle(clean, width, bbox, path.join(OUT, 'animals', `${key}.png`));
      manifestImages[key] = { url: `assets/game/animals/${key}.png`, ...meta };
    }
  }

  return { manifestSheets, manifestImages, clean, width, height };
}

async function processManual(name, crops) {
  const file = path.join(RAW, `${name}.png`);
  const { data, width, height } = await readRGBA(file);
  const clean = removeCheckerboard(data, width, height);
  await writePNG(path.join(CLEAN, `${name}.png`), clean, width, height);
  await contactSheet(file, clean, width, height, name);

  const images = {};
  for (const [key, crop] of Object.entries(crops)) {
    const bbox = bboxAlpha(clean, width, crop.x, crop.y, crop.x + crop.w, crop.y + crop.h, 2);
    if (!bbox) continue;
    const meta = await makeSingle(clean, width, bbox, path.join(OUT, `${key}.png`));
    if (crop.surfaceOffset !== undefined) {
      // Offsets were measured from the source crop's top; account for any trim.
      meta.surfaceOffset = crop.surfaceOffset - (bbox.y - crop.y);
    }
    images[key] = { url: `assets/game/${key}.png`, ...meta };
  }
  return { images };
}

async function processLogo() {
  const file = path.join(RAW, 'logo.png');
  const { data, width, height } = await readRGBA(file);
  const clean = removeCheckerboard(data, width, height);
  await writePNG(path.join(CLEAN, 'logo.png'), clean, width, height);
  await contactSheet(file, clean, width, height, 'logo');

  const bbox = bboxAlpha(clean, width, 0, 0, width, height, 4);
  if (!bbox) throw new Error('logo.png has no visible pixels after background removal');
  const meta = await makeSingle(clean, width, bbox, path.join(OUT, 'logo.png'));
  return { url: 'assets/game/logo.png', ...meta };
}

async function processFloor() {
  const file = path.join(RAW, 'zemin.png');
  const { data, width, height } = await readRGBA(file);
  const clean = removeCheckerboard(data, width, height);
  await writePNG(path.join(CLEAN, 'zemin.png'), clean, width, height);
  await writePNG(path.join(OUT, 'floor-strip.png'), clean, width, height);
  await contactSheet(file, clean, width, height, 'zemin');

  // Red line preview: the collider sits on the blanket surface, not on the
  // sprite's top edge (which includes IV poles and headboards).
  const line = Buffer.alloc(width * 6 * 4);
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      line[i] = 255;
      line[i + 1] = 40;
      line[i + 2] = 80;
      line[i + 3] = 230;
    }
  }
  const preview = Buffer.from(clean);
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = ((FLOOR_SURFACE_OFFSET - 3 + y) * width + x) * 4;
      preview[dst] = 255;
      preview[dst + 1] = 40;
      preview[dst + 2] = 80;
      preview[dst + 3] = 230;
    }
  }
  await writePNG(path.join(CONTACT, 'floor-surface.png'), preview, width, height);

  return {
    strip: {
      url: 'assets/game/floor-strip.png',
      width,
      height,
      surfaceOffset: FLOOR_SURFACE_OFFSET,
    },
  };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  await fs.mkdir(CLEAN, { recursive: true });
  await fs.mkdir(CONTACT, { recursive: true });
  await fs.rm(path.join(OUT, 'animals'), { recursive: true, force: true });

  const manifest = { sheets: {}, images: {}, animals: {}, floor: null };

  for (const [name, config] of Object.entries(FRAME_CONFIG)) {
    process.stdout.write(`processing ${name}... `);
    const result = await processSheet(name, config);
    Object.assign(manifest.sheets, result.manifestSheets);
    if (config.animals) {
      for (const [key, value] of Object.entries(result.manifestImages)) {
        manifest.animals[key] = value;
      }
    } else {
      Object.assign(manifest.images, result.manifestImages);
    }
    console.log('ok');
  }

  for (const [name, crops] of Object.entries(MANUAL_CROPS)) {
    process.stdout.write(`processing ${name}... `);
    const result = await processManual(name, crops);
    Object.assign(manifest.images, result.images);
    console.log('ok');
  }

  process.stdout.write('processing zemin... ');
  manifest.floor = await processFloor();
  console.log('ok');

  process.stdout.write('processing logo... ');
  manifest.images.logo = await processLogo();
  console.log('ok');

  manifest.images = Object.fromEntries(
    Object.entries(manifest.images).sort(([a], [b]) => a.localeCompare(b)),
  );
  manifest.animals = Object.fromEntries(
    Object.entries(manifest.animals).sort(([a], [b]) => a.localeCompare(b)),
  );

  await fs.writeFile(
    path.join(ROOT, 'src', 'game', 'data', 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
  await fs.writeFile(
    path.join(OUT, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  console.log('\n--- manifest ---');
  for (const [key, value] of Object.entries(manifest.sheets)) {
    console.log(`sheet ${key}: ${value.count} frames (${value.frameWidth}x${value.frameHeight})`);
  }
  for (const [key, value] of Object.entries(manifest.images)) {
    console.log(`image ${key}: ${value.width}x${value.height}`);
  }
  console.log(`animals: ${Object.keys(manifest.animals).length}`);
  console.log(`floor: ${manifest.floor.strip.width}x${manifest.floor.strip.height} @${manifest.floor.strip.surfaceOffset}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
