export function growF32(a: Float32Array | undefined, next: number): Float32Array {
  const n = new Float32Array(next);
  if (a) n.set(a);
  return n;
}

export function growU8(a: Uint8Array | undefined, next: number): Uint8Array {
  const n = new Uint8Array(next);
  if (a) n.set(a);
  return n;
}

export function growU32(a: Uint32Array | undefined, next: number): Uint32Array {
  const n = new Uint32Array(next);
  if (a) n.set(a);
  return n;
}

export function growI32(a: Int32Array | undefined, next: number, fill = 0): Int32Array {
  const n = new Int32Array(next);
  if (a) {
    n.set(a);
    if (fill !== 0) n.fill(fill, a.length);
  } else if (fill !== 0) {
    n.fill(fill);
  }
  return n;
}

export function growRefs<T>(a: (T | null)[] | undefined, next: number): (T | null)[] {
  const n = new Array<T | null>(next).fill(null);
  if (a) for (let i = 0; i < a.length; i++) n[i] = a[i];
  return n;
}

export abstract class ComponentStore {
  capacity = 0;

  reserve(min: number): void {
    if (min <= this.capacity) return;
    let next = Math.max(this.capacity, 1);
    while (next < min) next *= 2;
    this.grow(next);
    this.capacity = next;
  }

  protected abstract grow(next: number): void;

  onSlotAllocated(_slot: number): void {
    
  }
}
