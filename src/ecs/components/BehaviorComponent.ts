import { ComponentStore } from '../ComponentStore';

export const KIND_LINEAR = 1;
export const KIND_SINUSOIDAL = 2;
export const KIND_CIRCULAR = 3;
export const KIND_SPIN = 4;

export class BehaviorComponent extends ComponentStore {
  public bkind = this.u8('bkind');
  public belapsed = this.f32('belapsed');
  public bspeed = this.f32('bspeed');
  public bamp = this.f32('bamp');
  public bfreq = this.f32('bfreq');
  public brad = this.f32('brad');
  public boriX = this.f32('boriX');
  public boriY = this.f32('boriY');
  public bphase = this.f32('bphase');
}