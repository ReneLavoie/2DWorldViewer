import { ComponentStore, growF32, growU8 } from '../ComponentStore';

export const KIND_LINEAR = 1;
export const KIND_SINUSOIDAL = 2;
export const KIND_CIRCULAR = 3;
export const KIND_SPIN = 4;

export class BehaviorComponent extends ComponentStore {
  bkind!: Uint8Array;
  belapsed!: Float32Array;
  bspeed!: Float32Array;
  bamp!: Float32Array;
  bfreq!: Float32Array;
  brad!: Float32Array;
  boriX!: Float32Array;
  boriY!: Float32Array;
  bphase!: Float32Array;

  protected grow(next: number): void {
    this.bkind = growU8(this.bkind, next);
    this.belapsed = growF32(this.belapsed, next);
    this.bspeed = growF32(this.bspeed, next);
    this.bamp = growF32(this.bamp, next);
    this.bfreq = growF32(this.bfreq, next);
    this.brad = growF32(this.brad, next);
    this.boriX = growF32(this.boriX, next);
    this.boriY = growF32(this.boriY, next);
    this.bphase = growF32(this.bphase, next);
  }
}
