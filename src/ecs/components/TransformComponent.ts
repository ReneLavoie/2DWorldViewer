import { ComponentStore } from '../ComponentStore';

export class TransformComponent extends ComponentStore {
  tx = this.f32('tx');
  ty = this.f32('ty');
  trot = this.f32('trot');
  tsx = this.f32('tsx');
  tsy = this.f32('tsy');
  tw = this.f32('tw');
  th = this.f32('th');
  tvx = this.f32('tvx');
  tvy = this.f32('tvy');
  tvr = this.f32('tvr');
  tdirty = this.u8('tdirty');
}
