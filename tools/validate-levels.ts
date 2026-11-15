import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLevelText } from '../src/game/data/levelParser';
import {
  FOOT_PAD,
  GROUND_GAP,
  GROUND_TILE,
  GROUND_Y,
  JUMP_RISE,
  RAISED_SCALE,
  UPPER1_Y,
  UPPER2_Y,
  type RaisedRow,
} from '../src/game/layout';
import type { LevelDef, PlatformDef } from '../src/game/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS_DIR = path.join(ROOT, 'assets', 'levels');
const MAX_GAP = GROUND_GAP;
const MAX_JUMP_RISE = JUMP_RISE;
const MIN_SUSHI_HEIGHT = 35;
const MAX_SUSHI_HEIGHT = 210;
const MIN_PLATFORM_CLEARANCE = 24;
const SAME_ROW_SPACING = 120;

let failures = 0;
const fail = (levelId: number, message: string): void => {
  failures++;
  console.error(`  ✗ L${levelId}: ${message}`);
};

const manifest = JSON.parse(
  await fs.readFile(path.join(ROOT, 'src', 'game', 'data', 'manifest.json'), 'utf8'),
);
const tileWidths: Record<string, number> = Object.fromEntries(
  Object.entries(manifest.images)
    .filter(([key]) => key.startsWith('high-floor-'))
    .map(([key, info]) => [key, (info as { width: number }).width]),
);

const files = (await fs.readdir(LEVELS_DIR))
  .filter((file) => /^\d+\.txt$/.test(file))
  .sort();

const levels: LevelDef[] = [];
for (const file of files) {
  const id = Number(file.replace('.txt', ''));
  const text = await fs.readFile(path.join(LEVELS_DIR, file), 'utf8');
  try {
    levels.push(parseLevelText(text, id, tileWidths));
  } catch (error) {
    failures++;
    console.error(`  ✗ ${file}: ${(error as Error).message}`);
  }
}

console.log(`Checking ${levels.length} level matrices...`);

const grounds = (platforms: PlatformDef[]): PlatformDef[] =>
  platforms.filter((platform) => platform.kind === 'ground').sort((a, b) => a.x - b.x);

const platformAt = (platforms: PlatformDef[], x: number, surfaceY?: number): PlatformDef | undefined => {
  const candidates = platforms.filter(
    (platform) => x >= platform.x && x <= platform.x + platform.width,
  );
  if (candidates.length === 0) return undefined;
  if (surfaceY !== undefined) {
    candidates.sort((a, b) => Math.abs(a.y - surfaceY) - Math.abs(b.y - surfaceY));
    return candidates[0];
  }
  return candidates.sort((a, b) => b.y - a.y)[0];
};

const platformBottom = (platform: PlatformDef): number => {
  let bottom = platform.y;
  const row = platform.row ?? 'RAISED1';
  for (const tile of platform.tiles ?? []) {
    const info = manifest.images[tile];
    const scale = RAISED_SCALE[row]?.[tile];
    if (!info || !scale) continue;
    bottom = Math.max(bottom, platform.y + (info.height - (info.surfaceOffset ?? 0)) * scale);
  }
  return bottom;
};

const edgeDistance = (a: PlatformDef, b: PlatformDef): number =>
  Math.max(0, Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width)));

const ids = new Set<number>();
const animals = new Set<number>();

for (const level of levels) {
  if (level.id < 1 || level.id > 39) fail(level.id, 'level id must be 1..39');
  if (ids.has(level.id)) fail(level.id, 'duplicate level id');
  ids.add(level.id);
  if (level.animal < 0 || level.animal > 38) fail(level.id, `animal index ${level.animal} out of range`);
  if (animals.has(level.animal)) fail(level.id, `duplicate animal ${level.animal}`);
  animals.add(level.animal);

  const list = grounds(level.platforms);
  if (list.length === 0) {
    fail(level.id, 'no ground run');
    continue;
  }
  if (list[0].x !== 0) fail(level.id, `first ground run must start at x=0 (currently ${list[0].x})`);

  for (const ground of list) {
    if (!ground.tileCount || ground.tileCount < 1) fail(level.id, `ground at x=${ground.x} has no tileCount`);
    if (ground.width !== (ground.tileCount ?? 0) * GROUND_TILE) {
      fail(level.id, `ground at x=${ground.x} is not a whole 1942px tile run`);
    }
  }

  const gaps: { start: number; end: number }[] = [];
  for (let i = 0; i < list.length - 1; i++) {
    const current = list[i];
    const next = list[i + 1];
    const gap = next.x - (current.x + current.width);
    gaps.push({ start: current.x + current.width, end: next.x });
    if (gap < 0) fail(level.id, `ground runs overlap by ${-gap}px at x=${next.x}`);
    if (gap > MAX_GAP) fail(level.id, `gap ${gap}px > ${MAX_GAP}px at x=${current.x + current.width}`);
  }

  const raised = level.platforms.filter((platform) => platform.kind === 'raised');
  if (raised.length === 0) fail(level.id, 'no raised platform; R2 requires high-floor platforms');

  for (const platform of raised) {
    const row = (platform.row ?? 'RAISED1') as RaisedRow;
    if (platform.y !== UPPER1_Y && platform.y !== UPPER2_Y) {
      fail(level.id, `raised platform y=${platform.y} must be ${UPPER1_Y} or ${UPPER2_Y}`);
    }
    if ((row === 'RAISED1' && platform.y !== UPPER1_Y) || (row === 'RAISED2' && platform.y !== UPPER2_Y)) {
      fail(level.id, `raised platform row ${row} does not match y=${platform.y}`);
    }
    if (!platform.tiles || platform.tiles.length === 0) {
      fail(level.id, `raised platform at x=${platform.x} has no tiles`);
    }
    for (const tile of platform.tiles ?? []) {
      if (!tileWidths[tile]) fail(level.id, `unknown raised tile ${tile}`);
      if (!RAISED_SCALE[row]?.[tile]) fail(level.id, `${tile} is not allowed on ${row}`);
    }

    const bottom = platformBottom(platform);
    const limit = row === 'RAISED2' ? UPPER1_Y - 4 : GROUND_Y - MIN_PLATFORM_CLEARANCE;
    if (bottom > limit) {
      fail(level.id, `raised ${row} at x=${platform.x} reaches y=${Math.round(bottom)}; must end at y<=${limit}`);
    }

    const center = platform.x + platform.width / 2;
    if (row === 'RAISED1' && !gaps.some((gap) => center >= gap.start && center <= gap.end)) {
      fail(level.id, `raised platform at x=${platform.x} is not centered over a ground gap`);
    }
    if (row === 'RAISED2') {
      const lower = raised.find(
        (candidate) =>
          candidate !== platform &&
          candidate.y === UPPER1_Y &&
          edgeDistance(candidate, platform) <= 180,
      );
      if (!lower) fail(level.id, `RAISED2 at x=${platform.x} needs a RAISED1 platform beside it`);
    }

    const support = level.platforms.find((candidate) => {
      if (candidate === platform || candidate.y <= platform.y) return false;
      if (candidate.y - platform.y > MAX_JUMP_RISE) return false;
      return edgeDistance(candidate, platform) <= 180;
    });
    if (!support) {
      fail(level.id, `raised platform at x=${platform.x}, y=${platform.y} has no reachable platform within jump range`);
    }
  }

  for (let i = 0; i < raised.length; i++) {
    for (let j = i + 1; j < raised.length; j++) {
      const a = raised[i];
      const b = raised[j];
      if (a.y !== b.y) continue;
      if (edgeDistance(a, b) < SAME_ROW_SPACING) {
        fail(level.id, `same-height raised platforms at x=${a.x} and x=${b.x} are too close; stack or use another gap`);
      }
    }
  }

  for (const enemy of level.enemies) {
    const surface = enemy.flying ? undefined : (enemy.y ?? GROUND_Y + FOOT_PAD) - FOOT_PAD;
    const platform = platformAt(level.platforms, enemy.x, surface);
    if (!platform) {
      fail(level.id, `enemy ${enemy.kind} at x=${enemy.x} is not on a platform`);
      continue;
    }
    if (!enemy.flying && surface !== undefined && Math.abs(surface - platform.y) > 2) {
      fail(level.id, `enemy ${enemy.kind} at x=${enemy.x} is not on a platform surface`);
    }
    if (enemy.boss && enemy.flying) fail(level.id, 'boss cannot fly');
  }

  for (const item of level.sushi ?? []) {
    const platforms = level.platforms
      .filter((platform) => item.x >= platform.x && item.x <= platform.x + platform.width)
      .sort((a, b) => a.y - b.y);
    const below = platforms.find((platform) => platform.y > item.y);
    if (!below) {
      fail(level.id, `sushi at x=${item.x} is not above a platform`);
      continue;
    }
    const above = below.y - item.y;
    if (above < MIN_SUSHI_HEIGHT || above > MAX_SUSHI_HEIGHT) {
      fail(level.id, `sushi at x=${item.x} is ${above}px above its platform`);
    }
    if (item.kind < 0 || item.kind > 5) fail(level.id, `sushi kind ${item.kind} out of range`);
  }

  if (level.animalX === undefined) {
    fail(level.id, 'animalX missing');
  } else {
    const animalPlatform = platformAt(level.platforms, level.animalX);
    if (!animalPlatform || animalPlatform.kind !== 'ground') {
      fail(level.id, `animal x=${level.animalX} must be on a ground run`);
    }
  }

  const bosses = level.enemies.filter((enemy) => enemy.boss);
  if (level.id === 39) {
    if (bosses.length !== 1) fail(level.id, 'level 39 must have exactly one boss');
  } else if (bosses.length > 0) {
    fail(level.id, 'boss is only allowed on level 39');
  }
}

if (levels.length !== 39) failures++;
if (ids.size !== 39) failures++;
if (animals.size !== 39) failures++;

if (failures > 0) {
  console.error(`\n${failures} problem(s) found.`);
  process.exitCode = 1;
} else {
  console.log('✓ All level matrices look reachable and complete.');
  console.table(
    levels.map((level) => ({
      id: level.id,
      name: level.name,
      theme: level.theme,
      width: level.width,
      ground: grounds(level.platforms).reduce((sum, platform) => sum + (platform.tileCount ?? 0), 0),
      raised: level.platforms.filter((platform) => platform.kind === 'raised').length,
      enemies: level.enemies.length,
      sushi: level.sushi.length,
      animal: level.animal,
    })),
  );
}
