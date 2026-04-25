import { injectable } from 'inversify';
import { World } from '../ecs/World';

const TWO_PI = Math.PI * 2;

@injectable()
export class BehaviorSystem {
  update(world: World, dt: number): void {
    const items = world.items;
    let dirty = 0;
    for (let i = 0, n = items.length; i < n; i++) {
      const obj = items[i];
      const b = obj.behavior;
      const t = obj.transform;
      if (!b || !t) continue;

      b.elapsed += dt;
      const d = b.descriptor;

      switch (d.kind) {
        case 'idle':
          t.vx = 0;
          t.vy = 0;
          break;

        case 'linear': {

          break;
        }

        case 'sinusoidal': {
          const amp = d.amplitude ?? 50;
          const freq = d.frequency ?? 1;
          const speed = d.speed ?? 50;
          t.vx = speed;
          t.vy = amp * Math.cos(TWO_PI * freq * b.elapsed + (d.phase ?? 0));
          break;
        }

        case 'circular': {
          const r = d.radius ?? 100;
          const freq = d.frequency ?? 0.5;
          const ox = d.originX ?? t.x;
          const oy = d.originY ?? t.y;
          const angle = TWO_PI * freq * b.elapsed + (d.phase ?? 0);
          t.vx = 0;
          t.vy = 0;
          t.x = ox + Math.cos(angle) * r;
          t.y = oy + Math.sin(angle) * r;
          t.dirty = true;
          dirty++;
          break;
        }

        case 'spin': {
          // vr precomputed by factory. Nothing to do.
          break;
        }
      }
    }
    if (dirty > 0) world.dirtyTransforms += dirty;
  }
}
