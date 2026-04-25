import { injectable } from 'inversify';
import { World } from '../ecs/World';

@injectable()
export class TransformSystem {
  update(world: World, dt: number): void {
    const items = world.items;
    let dirty = 0;
    for (let i = 0, n = items.length; i < n; i++) {
      const t = items[i].transform;
      if (!t) continue;
      if (t.vx !== 0 || t.vy !== 0 || t.vr !== 0) {
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        t.rotation += t.vr * dt;
        t.dirty = true;
        dirty++;
      }
    }
    if (dirty > 0) world.dirtyTransforms += dirty;
  }
}