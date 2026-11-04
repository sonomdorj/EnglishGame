// Reads the game's JSON data files for tests.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const readJSON = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

// Math.random replacement that returns the given values in a loop.
export function withRandom(values, fn) {
  const real = Math.random;
  let i = 0;
  Math.random = () => values[i++ % values.length];
  try { return fn(); } finally { Math.random = real; }
}
