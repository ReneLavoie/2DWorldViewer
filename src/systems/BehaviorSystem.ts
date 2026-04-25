import { injectable } from 'inversify';
import { World, KIND_SINUSOIDAL, KIND_CIRCULAR } from '../ecs/World';
import { fcos, fsin } from './FastTrig';

const TWO_PI = Math.PI * 2;

@injectable()
export class BehaviorSystem {
  update(world: World, dt: number): void {
    const tx = world.tx;
    const ty = world.ty;
    const tvx = world.tvx;
    const tvy = world.tvy;
    const tdirty = world.tdirty;
    const bkind = world.bkind;
    const belapsed = world.belapsed;
    const bspeed = world.bspeed;
    const bamp = world.bamp;
    const bfreq = world.bfreq;
    const brad = world.brad;
    const boriX = world.boriX;
    const boriY = world.boriY;
    const bphase = world.bphase;

    let dirty = 0;

    // Single pass over active slots, branching on behavior kind.
    const ids = world.activeIds;
    const n = world.activeCount;
    for (let k = 0; k < n; k++) {
      const i = ids[k];
      const kind = bkind[i];
      if (kind === KIND_SINUSOIDAL) {
        const e = belapsed[i] + dt;
        belapsed[i] = e;
        const dy = bamp[i] * fcos(TWO_PI * bfreq[i] * e + bphase[i]);
        tx[i] += bspeed[i] * dt;
        ty[i] += dy * dt;
        tvx[i] = 0;
        tvy[i] = 0;
        tdirty[i] = 1;
        dirty++;
      } else if (kind === KIND_CIRCULAR) {
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
