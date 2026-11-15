import type { RaisedRow } from './layout';

export type Weapon = 'domestos' | 'sarma';
export type Species = 'microbe' | 'human';
export type EnemyKind = 'microbe' | 'pus' | 'doctor' | 'nurse';
export type Theme = 'day' | 'dusk' | 'night';
export type PlatformKind = 'ground' | 'raised';

export interface PlatformDef {
  x: number;
  y: number;
  width: number;
  kind?: PlatformKind;
  /** Full 1942px floor tiles in this ground run. */
  tileCount?: number;
  /** Raised platform image keys, placed left-to-right. */
  tiles?: string[];
  /** Which floating row the tiles belong to; drives their scale. */
  row?: RaisedRow;
}

export interface DecorDef {
  x: number;
  y: number;
  tile: string;
}

export interface EnemyDef {
  kind: EnemyKind;
  x: number;
  y?: number;
  skin?: number;
  flying?: boolean;
  elite?: boolean;
  boss?: boolean;
}

export interface PickupDef {
  x: number;
  y: number;
  kind: number;
}

export interface LevelDef {
  id: number;
  name: string;
  theme: Theme;
  width: number;
  platforms: PlatformDef[];
  enemies: EnemyDef[];
  sushi: PickupDef[];
  animal: number;
  animalX?: number;
  decor?: DecorDef[];
  hint?: string;
}

export interface ManifestSheet {
  url: string;
  frameWidth: number;
  frameHeight: number;
  count: number;
}

export interface ManifestImage {
  url: string;
  width: number;
  height: number;
  surfaceOffset?: number;
}

export interface FloorInfo extends ManifestImage {
  surfaceOffset: number;
}

export interface AssetManifest {
  sheets: Record<string, ManifestSheet>;
  images: Record<string, ManifestImage>;
  animals: Record<string, ManifestImage>;
  floor: {
    strip: FloorInfo;
    ledge?: FloorInfo | null;
  };
}

export interface HudState {
  health: number;
  maxHealth: number;
  attackLevel: number;
  xp: number;
  xpNext: number;
  levelId: number;
  levelName: string;
  bossHp: number;
  bossMax: number;
}

export interface CompletePayload {
  levelId: number;
  levelName: string;
  animalKey: string;
  rescuedCount: number;
  isFinal: boolean;
}
