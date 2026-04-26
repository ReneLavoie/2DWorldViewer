import { injectable } from 'inversify';
import { World } from '../ecs/World';
import { KIND_SINUSOIDAL, KIND_CIRCULAR } from '../ecs/components/BehaviorComponent';
import { fcos, fsin } from '../mathUtils/FastTrig';

const TWO_PI = Math.PI * 2;

// Drives time-based behaviors (sinusoidal and circular). Linear and spin
// motion are handled directly by TransformSystem via tvx/tvy/tvr, since they
// only need a velocity*dt integration step.
//
// Iterates only the active subset selected by CameraSystem.beginFrame, so
// off-screen entities don't cost CPU. Uses a precomputed sine LUT (FastTrig)
// because Math.sin/cos dominate the per-entity cost at million-entity scale.
@injectable()
export class BehaviorSystem {
  public update(world: World, dt: number): void {
    // Hot-loop locals: hoist component arrays so V8 sees stable shapes.
    const t = world.transform;
    const b = world.behavior;
    const tx = t.tx;
    const ty = t.ty;
    const tvx = t.tvx;
    const tvy = t.tvy;
    const tdirty = t.tdirty;
    const bkind = b.bkind;
    const belapsed = b.belapsed;
    const bspeed = b.bspeed;
    const bamp = b.bamp;
    const bfreq = b.bfreq;
    const brad = b.brad;
    const boriX = b.boriX;
    const boriY = b.boriY;
    const bphase = b.bphase;

    let dirty = 0;

    const ids = world.activeIds;
    const n = world.activeCount;
    for (let k = 0; k < n; k++) {
      const i = ids[k];
      const kind = bkind[i];
      if (kind === KIND_SINUSOIDAL) {
        // Linear x + sinusoidal y (vertical velocity = amp * cos(2π f t + φ)).
        const e = belapsed[i] + dt;
        belapsed[i] = e;
        const dy = bamp[i] * fcos(TWO_PI * bfreq[i] * e + bphase[i]);
        tx[i] += bspeed[i] * dt;
        ty[i] += dy * dt;
        // Position is written directly here, so zero velocity to prevent
        // TransformSystem from double-integrating it later this frame.
        tvx[i] = 0;
        tvy[i] = 0;
        tdirty[i] = 1;
        dirty++;
      } else if (kind === KIND_CIRCULAR) {
        // Absolute position around a fixed origin; same velocity-zeroing
        // rationale as KIND_SINUSOIDAL.
        const e = belapsed[i] + dt;
        belapsed[i] = e;
        const angle = TWO_PI * bfreq[i] * e + bphase[i];
        tvx[i] = 0;
        tvy[i] = 0;
        tx[i] = boriX[i] + fcos(angle) * brad[i];
        ty[i] = boriY[i] + fsin(angle) * brad[i];
        tdirty[i] = 1;
        dirty++;
      }
    }

    if (dirty > 0) world.dirtyTransforms += dirty;
  }
}
