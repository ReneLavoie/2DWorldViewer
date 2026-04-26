import { ComponentStore, growF32, growU8 } from '../ComponentStore';

export class TransformComponent extends ComponentStore {
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

  protected grow(next: number): void {
    this.tx = growF32(this.tx, next);
    this.ty = growF32(this.ty, next);
    this.trot = growF32(this.trot, next);
    this.tsx = growF32(this.tsx, next);
    this.tsy = growF32(this.tsy, next);
    this.tw = growF32(this.tw, next);
    this.th = growF32(this.th, next);
    this.tvx = growF32(this.tvx, next);
    this.tvy = growF32(this.tvy, next);
    this.tvr = growF32(this.tvr, next);
    this.tdirty = growU8(this.tdirty, next);
  }
}
