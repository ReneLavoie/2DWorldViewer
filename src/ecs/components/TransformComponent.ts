import { ComponentStore } from '../ComponentStore';

export class TransformComponent extends ComponentStore {
  public tx = this.f32('tx');
  public ty = this.f32('ty');
  public trot = this.f32('trot');
  public tsx = this.f32('tsx');
  public tsy = this.f32('tsy');
  public tw = this.f32('tw');
  public th = this.f32('th');
  public tvx = this.f32('tvx');
  public tvy = this.f32('tvy');
  public tvr = this.f32('tvr');
  public tdirty = this.u8('tdirty');
}