import { injectable } from 'inversify';
import { World } from '../ecs/World';

// Integrates linear/angular velocity into position/rotation for the active
// subset. BehaviorSystem owns time-based motion (sinusoidal/circular) and
// zeroes those velocities so this system is a no-op for them.
//
// The early `continue` on zero velocity is critical: most entities at any
// given moment are not moving (or are sinusoidal/circular and cleared their
// velocities), so skipping the writes avoids polluting tdirty and trashing
// the spatial index.
@injectable()
export class TransformSystem {
  public update(world: World, dt: number): void {
    const ids = world.activeIds;
    const n = world.activeCount;
    const t = world.transform;
    const tx = t.tx;
    const ty = t.ty;
    const trot = t.trot;
    const tvx = t.tvx;
    const tvy = t.tvy;
    const tvr = t.tvr;
    const tdirty = t.tdirty;

    let dirty = 0;
    for (let k = 0; k < n; k++) {
      const i = ids[k];
      const vx = tvx[i];
      const vy = tvy[i];
      const vr = tvr[i];
      // Skip stationary entities: nothing to integrate, no dirty flag to set.
      if (vx === 0 && vy === 0 && vr === 0) continue;
      tx[i] += vx * dt;
      ty[i] += vy * dt;
      trot[i] += vr * dt;
      tdirty[i] = 1;
      dirty++;
    }
    if (dirty > 0) world.dirtyTransforms += dirty;
  }
}
