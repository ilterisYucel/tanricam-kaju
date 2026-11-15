import manifest from './manifest.json';
import { parseLevelText } from './levelParser';
import type { LevelDef } from '../types';

const rawFiles = import.meta.glob('../../../assets/levels/*.txt', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const tileWidths = Object.fromEntries(
  Object.entries(manifest.images)
    .filter(([key]) => key.startsWith('high-floor-'))
    .map(([key, info]) => [key, info.width]),
);

const paths = Object.keys(rawFiles).sort();

export const LEVELS: LevelDef[] = paths.map((path) => {
  const match = path.match(/(\d+)\.txt$/);
  if (!match) throw new Error(`Level filename must end with a numeric id: ${path}`);
  return parseLevelText(rawFiles[path], Number(match[1]), tileWidths);
});
