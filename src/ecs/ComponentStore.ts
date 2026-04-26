// Typed-array growth helpers. All preserve existing data and return a new
// buffer of the requested length; callers must reassign their references.
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

// Like growF32/U8/U32 but supports a default fill applied to newly-grown
// tail slots (used e.g. by SpatialComponent to default cell links to -1).
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

// Reference-array grower for component data that can't fit in typed arrays
// (e.g. Pixi Particle handles). New slots default to null.
export function growRefs<T>(a: (T | null)[] | undefined, next: number): (T | null)[] {
  const n = new Array<T | null>(next).fill(null);
  if (a) for (let i = 0; i < a.length; i++) n[i] = a[i];
  return n;
}

type GrowFn<T> = (prev: T | undefined, next: number) => T;

interface ComponentArray<T> {
  name: string;
  grow: GrowFn<T>;
}

// Base class for all SoA component stores.
//
// Subclasses declare their per-slot fields by calling one of the protected
// helpers (f32/u8/u32/i32/refs), which both initialise the field and register
// it with the store so reserve() can grow them all in lockstep when the
// World allocates more slots.
export abstract class ComponentStore {
  // Number of slots currently backed by the underlying typed arrays.
  public capacity = 0;

  // Registered fields keyed by property name; reserve() reassigns the grown
  // buffer back onto the property via dynamic access.
  private readonly _arrays: ComponentArray<unknown>[] = [];

  // Grows every registered field to at least `min` slots, doubling capacity
  // (geometric growth) to amortise reallocations.
  public reserve(min: number): void {
    if (min <= this.capacity) return;
    let next = Math.max(this.capacity, 1);
    while (next < min) next *= 2;
    const self = this as unknown as Record<string, unknown>;
    for (const a of this._arrays) {
      self[a.name] = a.grow(self[a.name], next);
    }
    this.capacity = next;
  }

  // Hook invoked by World after a new slot is allocated. Override to set
  // per-slot defaults that aren't simply zero (see SpatialComponent).
  public onSlotAllocated(_slot: number): void {

  }

  // Registers a field so reserve() will grow it. Returns the initial empty
  // typed array to assign to the property.
  private register<T>(name: string, grow: GrowFn<T>, initial: T): T {
    this._arrays.push({ name, grow: grow as GrowFn<unknown> });
    return initial;
  }

  protected f32(name: string): Float32Array {
    return this.register(name, growF32, new Float32Array(0));
  }

  protected u8(name: string): Uint8Array {
    return this.register(name, growU8, new Uint8Array(0));
  }

  protected u32(name: string): Uint32Array {
    return this.register(name, growU32, new Uint32Array(0));
  }

  protected i32(name: string, fill = 0): Int32Array {
    const grow: GrowFn<Int32Array> = (prev, next) => growI32(prev, next, fill);
    return this.register(name, grow, new Int32Array(0));
  }

  protected refs<T>(name: string): (T | null)[] {
    return this.register<(T | null)[]>(name, growRefs, []);
  }
}
