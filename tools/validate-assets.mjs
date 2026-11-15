import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  await fs.readFile(path.join(ROOT, 'src', 'game', 'data', 'manifest.json'), 'utf8'),
);

let failures = 0;
const check = async (key, info) => {
  const file = path.join(ROOT, 'public', info.url);
  try {
    const meta = await sharp(file).metadata();
    if (!meta.hasAlpha) {
      failures++;
      console.error(`✗ ${key}: no alpha channel (${info.url})`);
    }
    if (info.width && meta.width !== info.width) {
      failures++;
      console.error(`✗ ${key}: width ${meta.width} != manifest ${info.width}`);
    }
    if (info.height && meta.height !== info.height) {
      failures++;
      console.error(`✗ ${key}: height ${meta.height} != manifest ${info.height}`);
    }
  } catch {
    failures++;
    console.error(`✗ ${key}: missing ${info.url}`);
  }
};

for (const [key, info] of Object.entries(manifest.sheets)) await check(key, info);
for (const [key, info] of Object.entries(manifest.images)) await check(key, info);
for (const [key, info] of Object.entries(manifest.animals)) await check(key, info);
await check('floor-strip', manifest.floor.strip);
if (manifest.floor.ledge) await check('floor-ledge', manifest.floor.ledge);

if (failures > 0) {
  console.error(`\n${failures} asset problem(s) found.`);
  process.exitCode = 1;
} else {
  console.log(
    `✓ ${Object.keys(manifest.sheets).length} sheets, ${Object.keys(manifest.images).length} images, ` +
      `${Object.keys(manifest.animals).length} animals, floor assets OK.`,
  );
}
