export const XP_THRESHOLDS = [0, 6, 15, 28, 45] as const;
export const LEVEL_COUNT = 39;
const SAVE_KEY = 'tanricam-kaju-save-v1';

export interface SaveData {
  version: number;
  completed: number[];
  xp: number;
  attackLevel: number;
  sound: boolean;
}

const freshSave = (): SaveData => ({
  version: 1,
  completed: [],
  xp: 0,
  attackLevel: 1,
  sound: true,
});

let cache: SaveData | null = null;

function read(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const completed = Array.isArray(parsed.completed)
      ? [...new Set(parsed.completed.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= LEVEL_COUNT))]
      : [];
    const xp = Number.isFinite(parsed.xp) ? Math.max(0, Math.min(XP_THRESHOLDS[XP_THRESHOLDS.length - 1], Number(parsed.xp))) : 0;
    return {
      version: 1,
      completed,
      xp,
      attackLevel: levelForXp(xp),
      sound: parsed.sound !== false,
    };
  } catch {
    return freshSave();
  }
}

export function getSave(): SaveData {
  if (!cache) cache = read();
  return cache;
}

export function saveNow(): void {
  if (!cache) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(cache));
  } catch {
    // Private mode / storage full: the game keeps running with in-memory save.
  }
}

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

export function xpForNext(level: number): number {
  return XP_THRESHOLDS[Math.min(level, XP_THRESHOLDS.length - 1)] ?? XP_THRESHOLDS[XP_THRESHOLDS.length - 1];
}

export function addXp(amount: number): { levelUp: boolean; level: number } {
  const save = getSave();
  const before = save.attackLevel;
  save.xp = Math.min(XP_THRESHOLDS[XP_THRESHOLDS.length - 1], save.xp + Math.max(0, amount));
  save.attackLevel = levelForXp(save.xp);
  saveNow();
  return { levelUp: save.attackLevel > before, level: save.attackLevel };
}

export function completeLevel(id: number): void {
  const save = getSave();
  if (!save.completed.includes(id)) save.completed.push(id);
  save.completed.sort((a, b) => a - b);
  saveNow();
}

export function isUnlocked(id: number): boolean {
  const save = getSave();
  return id === 1 || save.completed.includes(id - 1) || save.completed.includes(id);
}

export function resetProgress(): void {
  cache = freshSave();
  saveNow();
}

export function setSoundEnabled(enabled: boolean): void {
  const save = getSave();
  save.sound = enabled;
  saveNow();
}

export function rescuedCount(): number {
  return getSave().completed.length;
}
