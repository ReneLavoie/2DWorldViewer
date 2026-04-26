import { injectable } from 'inversify';
import { World } from '../ecs/World';
import { KIND_SINUSOIDAL, KIND_CIRCULAR } from '../ecs/components/BehaviorComponent';
import { fcos, fsin } from './FastTrig';

const TWO_PI = Math.PI * 2;

@injectable()
export class BehaviorSystem {
  update(world: World, dt: number): void {
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
