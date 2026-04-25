import { injectable } from 'inversify';
import { World } from '../ecs/World';

const TWO_PI = Math.PI * 2;

@injectable()
export class BehaviorSystem {
  update(world: World, dt: number): void {
    const tx = world.tx;
    const ty = world.ty;
    const tvx = world.tvx;
    const tvy = world.tvy;
    const tdirty = world.tdirty;
    const belapsed = world.belapsed;
    const bspeed = world.bspeed;
    const bamp = world.bamp;
    const bfreq = world.bfreq;
    const brad = world.brad;
    const boriX = world.boriX;
    const boriY = world.boriY;
    const bphase = world.bphase;

    let dirty = 0;

    const sinIds = world.sinIds;
    const sinCount = world.sinCount;
    for (let k = 0; k < sinCount; k++) {
      const i = sinIds[k];
      const e = belapsed[i] + dt;
      belapsed[i] = e;
      const dy = bamp[i] * Math.cos(TWO_PI * bfreq[i] * e + bphase[i]);
      tx[i] += bspeed[i] * dt;
      ty[i] += dy * dt;
      tvx[i] = 0;
      tvy[i] = 0;
      tdirty[i] = 1;
      dirty++;
    }

    const circIds = world.circIds;
    const circCount = world.circCount;
    for (let k = 0; k < circCount; k++) {
      const i = circIds[k];
      const e = belapsed[i] + dt;
      belapsed[i] = e;
      const angle = TWO_PI * bfreq[i] * e + bphase[i];
      tvx[i] = 0;
      tvy[i] = 0;
      tx[i] = boriX[i] + Math.cos(angle) * brad[i];
      ty[i] = boriY[i] + Math.sin(angle) * brad[i];
      tdirty[i] = 1;
      dirty++;
    }

    if (dirty > 0) world.dirtyTransforms += dirty;
  }
}