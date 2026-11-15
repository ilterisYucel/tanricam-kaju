/**
 * Proportional design grid.
 *
 * The game always renders a 1280x720 reference scene; Phaser's Scale.FIT maps
 * it to the real window. U is one tenth of that reference height, so every
 * gameplay height (ground, upper rows, characters, props) derives from one
 * number instead of scattered pixel constants.
 */
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 720;
export const U = DESIGN_HEIGHT / 10;

export const GROUND_TILE = 1942;
export const GROUND_Y = Math.round(DESIGN_HEIGHT - 2 * U);
export const GROUND_GAP = Math.round(2.8 * U);
export const STEP = Math.round(1.5 * U);

/** Floating upper routes: two steps above the ground, then one more step. */
export const UPPER1_Y = GROUND_Y - 2 * STEP;
export const UPPER2_Y = UPPER1_Y - STEP;
export const ROW_Y = [GROUND_Y, UPPER1_Y, UPPER2_Y] as const;

/** Matrix placement grid: half a U keeps props close to the intended x. */
export const RAISE_SLOT = Math.round(U / 2);
export const FOOT_PAD = 4;
export const JUMP_RISE = Math.round(3.4 * U);
export const MAX_GAP = Math.round(3.3 * U);

export const HERO_TARGET_HEIGHT = 2.7 * U;
export const SUSHI_SCALE = 0.95;

export type RaisedRow = 'RAISED1' | 'RAISED2';
export type HighFloorKey = 'high-floor-a' | 'high-floor-b' | 'high-floor-e';
export type DecorKey = 'high-floor-c' | 'high-floor-decor';

/**
 * Whole-sprite scales, never crops. Upper props must end well above the floor
 * line so they read as floating; RAISED2 props fit above a RAISED1 surface.
 */
export const RAISED_SCALE: Record<RaisedRow, Partial<Record<HighFloorKey, number>>> = {
  RAISED1: {
    'high-floor-a': 0.38,
    'high-floor-b': 0.48,
    'high-floor-e': 0.42,
  },
  RAISED2: {
    'high-floor-b': 0.39,
    'high-floor-e': 0.35,
  },
};

export const DECOR_SCALE: Record<DecorKey, number> = {
  'high-floor-c': 0.72,
  'high-floor-decor': 0.85,
};

export const ENEMY_TARGET_HEIGHT: Record<'doctor' | 'nurse' | 'microbe' | 'pus', number> = {
  doctor: HERO_TARGET_HEIGHT * 0.9,
  nurse: HERO_TARGET_HEIGHT * 0.9,
  microbe: HERO_TARGET_HEIGHT * 0.55,
  pus: HERO_TARGET_HEIGHT * 0.4,
};
