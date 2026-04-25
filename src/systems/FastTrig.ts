const SIZE = 4096;
const MASK = SIZE - 1;
const TWO_PI = Math.PI * 2;
const SCALE = SIZE / TWO_PI;
const QUARTER = SIZE >> 2;

const SIN = new Float32Array(SIZE);
for (let i = 0; i < SIZE; i++) SIN[i] = Math.sin((i * TWO_PI) / SIZE);

export function fsin(x: number): number {
  return SIN[(((x * SCALE) | 0) & MASK)];
}

export function fcos(x: number): number {
  return SIN[((((x * SCALE) | 0) + QUARTER) & MASK)];
}
