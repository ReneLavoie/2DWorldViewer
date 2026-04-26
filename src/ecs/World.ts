import { injectable } from 'inversify';
import type { Particle } from 'pixi.js';
import { GameObject } from './GameObject';

export const KIND_LINEAR = 1;
export const KIND_SINUSOIDAL = 2;
export const KIND_CIRCULAR = 3;
export const KIND_SPIN = 4;

const INITIAL_CAPACITY = 1024;

@injectable()
export class World {
  private _objects: GameObject[] = [];
  private indexById = new Map<number, number>();

  capacity = 0;
  size = 0;

  tx!: Float32Array;
  ty!: Float32Array;
  trot!: Float32Array;
  tsx!: Float32Array;
  tsy!: Float32Array;
  tw!: Float32Array;
  th!: Float32Array;
  tvx!: Float32Array;
  tvy!: Float32Array;
  tvr!: Float32Array;
  tdirty!: Uint8Array;

  bkind!: Uint8Array;
  belapsed!: Float32Array;
  bspeed!: Float32Array;
  bamp!: Float32Array;
  bfreq!: Float32Array;
  brad!: Float32Array;
  boriX!: Float32Array;
  boriY!: Float32Array;
  bphase!: Float32Array;

  cellIdx!: Int32Array;
  cellPrev!: Int32Array;
  cellNext!: Int32Array;

  // Per-slot render data (avoids GameObject/RendererComponent indirection in the hot render loop).
  texIdx!: Uint8Array;
  tint!: Uint32Array;
  particles!: (Particle | null)[];

  // Active (LOD-selected) slots that should be simulated and rendered this frame.
  activeIds!: Int32Array;
  activeCount = 0;
  // When true, simulation iterates `activeIds` instead of the full kind-packed lists.
  lodMode = false;

  dirtyTransforms = 0;
  structuralDirty = true;

  constructor() {
    this.allocate(INITIAL_CAPACITY);
  }

  private allocate(cap: number): void {
    this.capacity = cap;
    this.tx = new Float32Array(cap);
    this.ty = new Float32Array(cap);
    this.trot = new Float32Array(cap);
    this.tsx = new Float32Array(cap);
    this.tsy = new Float32Array(cap);
    this.tw = new Float32Array(cap);
    this.th = new Float32Array(cap);
    this.tvx = new Float32Array(cap);
    this.tvy = new Float32Array(cap);
    this.tvr = new Float32Array(cap);
    this.tdirty = new Uint8Array(cap);

    this.bkind = new Uint8Array(cap);
    this.belapsed = new Float32Array(cap);
    this.bspeed = new Float32Array(cap);
    this.bamp = new Float32Array(cap);
    this.bfreq = new Float32Array(cap);
    this.brad = new Float32Array(cap);
    this.boriX = new Float32Array(cap);
    this.boriY = new Float32Array(cap);
    this.bphase = new Float32Array(cap);

    this.cellIdx = new Int32Array(cap);
    this.cellPrev = new Int32Array(cap);
    this.cellNext = new Int32Array(cap);
    this.cellIdx.fill(-1);
    this.cellPrev.fill(-1);
    this.cellNext.fill(-1);

    this.texIdx = new Uint8Array(cap);
    this.tint = new Uint32Array(cap);
    this.particles = new Array(cap).fill(null);

    this.activeIds = new Int32Array(cap);
  }

  reserve(min: number): void {
    if (min <= this.capacity) return;
    let next = this.capacity;
    while (next < min) next *= 2;
    this.growTo(next);
  }

  private growTo(next: number): void {
    const grow32 = (a: Float32Array): Float32Array => {
      const n = new Float32Array(next);
      n.set(a);
      return n;
    };
    const grow8 = (a: Uint8Array): Uint8Array => {
      const n = new Uint8Array(next);
      n.set(a);
      return n;
    };
    const growU32 = (a: Uint32Array): Uint32Array => {
      const n = new Uint32Array(next);
      n.set(a);
      return n;
    };
    const growI = (a: Int32Array, fill = 0): Int32Array => {
      const n = new Int32Array(next);
      n.set(a);
      if (fill !== 0) n.fill(fill, a.length);
      return n;
    };
    this.tx = grow32(this.tx);
    this.ty = grow32(this.ty);
    this.trot = grow32(this.trot);
    this.tsx = grow32(this.tsx);
    this.tsy = grow32(this.tsy);
    this.tw = grow32(this.tw);
    this.th = grow32(this.th);
    this.tvx = grow32(this.tvx);
    this.tvy = grow32(this.tvy);
    this.tvr = grow32(this.tvr);
    this.tdirty = grow8(this.tdirty);

    this.bkind = grow8(this.bkind);
    this.belapsed = grow32(this.belapsed);
    this.bspeed = grow32(this.bspeed);
    this.bamp = grow32(this.bamp);
    this.bfreq = grow32(this.bfreq);
    this.brad = grow32(this.brad);
    this.boriX = grow32(this.boriX);
    this.boriY = grow32(this.boriY);
    this.bphase = grow32(this.bphase);

    this.cellIdx = growI(this.cellIdx, -1);
    this.cellPrev = growI(this.cellPrev, -1);
    this.cellNext = growI(this.cellNext, -1);

    this.texIdx = grow8(this.texIdx);
    this.tint = growU32(this.tint);
    const newParticles = new Array<Particle | null>(next).fill(null);
    for (let i = 0; i < this.particles.length; i++) newParticles[i] = this.particles[i];
    this.particles = newParticles;

    this.activeIds = growI(this.activeIds);

    this.capacity = next;
  }

  allocateSlot(obj: GameObject): number {
    if (this.indexById.has(obj.id)) return this.indexById.get(obj.id)!;
    const idx = this.size;
    if (idx >= this.capacity) this.reserve(idx + 1);
    this._objects[idx] = obj;
    this.indexById.set(obj.id, idx);
    obj.index = idx;
    this.size = idx + 1;
    this.cellIdx[idx] = -1;
    this.cellPrev[idx] = -1;
    this.cellNext[idx] = -1;
    this.particles[idx] = null;
    this.structuralDirty = true;
    return idx;
  }

  get objects(): readonly GameObject[] {
    return this._objects;
  }

  add(obj: GameObject): void {
    if (this.indexById.has(obj.id)) return;
    this.allocateSlot(obj);
  }

  get(id: number): GameObject | undefined {
    const idx = this.indexById.get(id);
    return idx === undefined ? undefined : this._objects[idx];
  }

  has(id: number): boolean {
    return this.indexById.has(id);
  }

  count(): number {
    return this.size;
  }

  resetFrameDirty(): void {
    this.dirtyTransforms = 0;
    this.structuralDirty = false;
  }

  clear(): void {
    this._objects.length = 0;
    this.indexById.clear();
    this.size = 0;
    this.activeCount = 0;
    this.lodMode = false;
    this.structuralDirty = true;
  }
}
