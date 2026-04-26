import { ComponentStore } from '../ComponentStore';

// Per-entity transform: world-space position, rotation, scale, base size and
// linear/angular velocities. `tdirty` is a per-slot flag the simulation
// systems raise when they mutate position/rotation, so the spatial index only
// re-buckets entities that actually moved.
export class TransformComponent extends ComponentStore {
  public tx = this.f32('tx');         // world x
  public ty = this.f32('ty');         // world y
  public trot = this.f32('trot');     // rotation (radians)
  public tsx = this.f32('tsx');       // scale x
  public tsy = this.f32('tsy');       // scale y
  public tw = this.f32('tw');         // unscaled width
  public th = this.f32('th');         // unscaled height
  public tvx = this.f32('tvx');       // linear velocity x (units/s)
  public tvy = this.f32('tvy');       // linear velocity y (units/s)
  public tvr = this.f32('tvr');       // angular velocity (rad/s)
  public tdirty = this.u8('tdirty');  // 1 if transform changed this frame
}
