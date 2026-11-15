import {
  DECOR_SCALE,
  FOOT_PAD,
  GROUND_GAP,
  GROUND_TILE,
  GROUND_Y,
  RAISE_SLOT,
  RAISED_SCALE,
  UPPER1_Y,
  UPPER2_Y,
  type DecorKey,
  type HighFloorKey,
  type RaisedRow,
} from '../layout';
import type { DecorDef, EnemyDef, LevelDef, PickupDef, PlatformDef, Theme } from '../types';

const RAISED_TILE_BY_LETTER: Record<string, HighFloorKey> = {
  a: 'high-floor-a',
  b: 'high-floor-b',
  e: 'high-floor-e',
};

const DECOR_TILE_BY_LETTER: Record<string, DecorKey> = {
  c: 'high-floor-c',
  d: 'high-floor-decor',
};

const SUSHI_KIND_BY_LETTER: Record<string, number> = {
  s: 2,
  t: 3,
  u: 4,
  v: 5,
  g: 0,
};

const ENEMY_BY_LETTER: Record<
  string,
  { kind: EnemyDef['kind']; skin?: number; flying?: boolean; boss?: boolean }
> = {
  m: { kind: 'microbe', skin: 0 },
  M: { kind: 'microbe', skin: 2 },
  f: { kind: 'microbe', skin: 1, flying: true },
  p: { kind: 'pus' },
  d: { kind: 'doctor' },
  n: { kind: 'nurse' },
  b: { kind: 'microbe', skin: 4, boss: true },
};

export interface TileWidths {
  [key: string]: number;
}

function parseMeta(lines: string[]): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([a-zA-Z]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    if (['ground', 'raised1', 'raised2', 'decor', 'e0', 'e1', 'e2'].includes(key)) continue;
    meta[key] = match[2].trim();
  }
  return meta;
}

function parseRows(lines: string[]): Map<string, string> {
  const rows = new Map<string, string>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^(GROUND|RAISED1|RAISED2|DECOR|E0|E1|E2)\s*:\s*(.*)$/i);
    if (!match) continue;
    rows.set(match[1].toUpperCase(), match[2].replace(/\s+/g, ''));
  }
  return rows;
}

function raisedWidth(row: RaisedRow, key: HighFloorKey, tileWidths: TileWidths): number {
  const scale = RAISED_SCALE[row][key];
  if (!scale) throw new Error(`${key} is not allowed on ${row}`);
  if (!tileWidths[key]) throw new Error(`missing tile width for ${key}`);
  return Math.round(tileWidths[key] * scale);
}

export function parseLevelText(text: string, id: number, tileWidths: TileWidths): LevelDef {
  const lines = text.replace(/\r/g, '').split('\n');
  const meta = parseMeta(lines);
  const rows = parseRows(lines);
  const groundRow = rows.get('GROUND') ?? '';
  if (!groundRow.includes('#')) throw new Error(`Level ${id}: GROUND has no tiles`);

  const name = meta.name || `Bölüm ${id}`;
  const theme = (meta.theme || 'day') as Theme;
  if (!['day', 'dusk', 'night'].includes(theme)) throw new Error(`Level ${id}: invalid theme "${theme}"`);
  const animal = Number.parseInt(meta.animal ?? '', 10);
  if (!Number.isInteger(animal) || animal < 0 || animal > 38) {
    throw new Error(`Level ${id}: invalid animal index "${meta.animal}"`);
  }

  const platforms: PlatformDef[] = [];
  const decor: DecorDef[] = [];
  let levelWidth = 0;

  // Ground is a sequence of full 1942px tiles (#) and fixed gaps (.).
  let x = 0;
  for (let i = 0; i < groundRow.length; ) {
    const char = groundRow[i];
    if (char === '#') {
      let count = 0;
      while (groundRow[i + count] === '#') count++;
      platforms.push({
        x,
        y: GROUND_Y,
        width: count * GROUND_TILE,
        kind: 'ground',
        tileCount: count,
      });
      x += count * GROUND_TILE;
      i += count;
    } else if (char === '.') {
      x += GROUND_GAP;
      i++;
    } else {
      throw new Error(`Level ${id}: invalid GROUND character "${char}"`);
    }
  }
  levelWidth = Math.max(levelWidth, x);

  // Floating upper routes. Letters pack left-to-right using scaled widths.
  for (const [rowKey, surfaceY] of [
    ['RAISED1', UPPER1_Y],
    ['RAISED2', UPPER2_Y],
  ] as const) {
    const row = rows.get(rowKey) ?? '';
    let cursor = 0;
    let runStart = 0;
    let runTiles: HighFloorKey[] = [];

    const flush = (): void => {
      if (runTiles.length === 0) return;
      const width = runTiles.reduce((sum, key) => sum + raisedWidth(rowKey, key, tileWidths), 0);
      platforms.push({
        x: runStart,
        y: surfaceY,
        width,
        kind: 'raised',
        tiles: [...runTiles],
        row: rowKey,
      });
      runTiles = [];
    };

    for (const char of row) {
      if (char === '.') {
        flush();
        cursor += RAISE_SLOT;
        continue;
      }
      const key = RAISED_TILE_BY_LETTER[char];
      if (!key) throw new Error(`Level ${id}: invalid ${rowKey} character "${char}"`);
      if (runTiles.length === 0) runStart = cursor;
      runTiles.push(key);
      cursor += raisedWidth(rowKey, key, tileWidths);
    }
    flush();
    levelWidth = Math.max(levelWidth, cursor);
  }

  // Ground-level, non-colliding props: wheeled cart (c) and O2 rack (d).
  {
    let cursor = 0;
    for (const char of rows.get('DECOR') ?? '') {
      if (char === '.') {
        cursor += RAISE_SLOT;
        continue;
      }
      const key = DECOR_TILE_BY_LETTER[char];
      if (!key) throw new Error(`Level ${id}: invalid DECOR character "${char}"`);
      const width = Math.round((tileWidths[key] ?? 0) * DECOR_SCALE[key]);
      if (!width) throw new Error(`Level ${id}: missing tile width for ${key}`);
      decor.push({ x: cursor, y: GROUND_Y, tile: key });
      cursor += width;
    }
    levelWidth = Math.max(levelWidth, cursor);
  }

  const enemies: EnemyDef[] = [];
  const sushi: PickupDef[] = [];
  let animalX: number | undefined;
  let animalCount = 0;

  for (const [rowKey, surfaceY] of [
    ['E0', GROUND_Y],
    ['E1', UPPER1_Y],
    ['E2', UPPER2_Y],
  ] as const) {
    const row = rows.get(rowKey) ?? '';
    const len = row.length;
    if (len === 0) continue;

    for (let i = 0; i < len; i++) {
      const char = row[i];
      if (char === '.') continue;
      const entityX = Math.round((levelWidth * (i + 0.5)) / len);

      if (char === 'k') {
        animalCount++;
        animalX = entityX;
        continue;
      }

      const enemy = ENEMY_BY_LETTER[char];
      if (enemy) {
        const flying = Boolean(enemy.flying);
        enemies.push({
          kind: enemy.kind,
          x: entityX,
          y: flying ? surfaceY - 40 : surfaceY + FOOT_PAD,
          skin: enemy.skin,
          flying,
          boss: enemy.boss,
        });
        continue;
      }

      const kind = SUSHI_KIND_BY_LETTER[char];
      if (kind !== undefined) {
        const y = surfaceY === GROUND_Y ? surfaceY - 100 : surfaceY - 70;
        sushi.push({ x: entityX, y, kind });
        continue;
      }

      throw new Error(`Level ${id}: invalid ${rowKey} character "${char}"`);
    }
  }

  if (animalCount > 1) throw new Error(`Level ${id}: more than one animal marker`);
  const groundRuns = platforms.filter((p) => p.kind === 'ground').sort((a, b) => a.x - b.x);
  const lastGround = groundRuns[groundRuns.length - 1];
  if (!lastGround) throw new Error(`Level ${id}: no ground run`);
  if (animalX === undefined) animalX = lastGround.x + lastGround.width - 155;

  levelWidth = Math.max(levelWidth, animalX + 155);

  return {
    id,
    name,
    theme,
    width: levelWidth,
    platforms,
    decor,
    enemies,
    sushi,
    animal,
    animalX,
    hint: meta.hint || undefined,
  };
}
