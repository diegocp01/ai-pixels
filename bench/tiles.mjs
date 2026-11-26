// The benchmark browser and server use the same hard clip for each worker.
// Ordinary drawings still take the studio's normal rendering path.
import {SIZE, applyGenerated as applySingle, raster as rasterSingle, validateScene as validateSingle} from '../public/scene.mjs';
export * from '../public/scene.mjs';

const half = SIZE / 2;
export const quadrants = [
  {name: 'upper left', x: 0, y: 0},
  {name: 'upper right', x: half, y: 0},
  {name: 'lower left', x: 0, y: half},
  {name: 'lower right', x: half, y: half},
];

export function applyGenerated(scene, line) {
  if (!line.startsWith('tile ')) return applySingle(scene, line);
  const [, index, command] = /^tile ([0-3]) (.+)$/.exec(line);
  const source = scene.source ?? scene;
  const tiles = scene.tiles?.slice() ?? quadrants.map(() => source);
  tiles[index] = command === 'restart' ? source : applySingle(tiles[index], command);
  return {size: SIZE, base: 'blank', title: 'Quadrant drawing', ops: [], source, tiles};
}

export function validateScene(scene) {
  if (!scene.tiles) return validateSingle(scene);
  if (scene.tiles.length !== quadrants.length) throw Error('Incomplete quadrant drawing.');
  return {...validateSingle(scene), source: validateSingle(scene.source), tiles: scene.tiles.map(validateSingle)};
}

const cached = new WeakMap();
export function raster(scene) {
  if (!scene.tiles) return rasterSingle(scene);
  const pixels = new Uint8ClampedArray(SIZE * SIZE * 4);
  const regions = new Array(SIZE * SIZE);
  for (const [index, {x, y}] of quadrants.entries()) {
    const tile = scene.tiles[index];
    if (!cached.has(tile)) cached.set(tile, rasterSingle(tile));
    const image = cached.get(tile);
    for (let row = y; row < y + half; row++) {
      const start = row * SIZE + x, end = start + half;
      pixels.set(image.pixels.subarray(start * 4, end * 4), start * 4);
      for (let i = start; i < end; i++) regions[i] = image.regions[i];
    }
  }
  return {pixels, regions};
}
