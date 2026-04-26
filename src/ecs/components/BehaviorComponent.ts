import { ComponentStore } from '../ComponentStore';

export const KIND_LINEAR = 1;
export const KIND_SINUSOIDAL = 2;
export const KIND_CIRCULAR = 3;
export const KIND_SPIN = 4;

export class BehaviorComponent extends ComponentStore {
  bkind = this.u8('bkind');
  belapsed = this.f32('belapsed');
  bspeed = this.f32('bspeed');
  bamp = this.f32('bamp');
  bfreq = this.f32('bfreq');
  brad = this.f32('brad');
  boriX = this.f32('boriX');
  boriY = this.f32('boriY');
  bphase = this.f32('bphase');
}
