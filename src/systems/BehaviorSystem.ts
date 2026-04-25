import { injectable } from 'inversify';
import { World } from '../ecs/World';
import {
  BehaviorComponent,
  BehaviorType,
} from '../ecs/components/BehaviorComponent';
import { TransformComponent, TransformType } from '../ecs/components/TransformComponent';

@injectable()
export class BehaviorSystem {
  update(world: World, dt: number): void {
    for (const obj of world.all()) {
      const b = obj.getComponent<BehaviorComponent>(BehaviorType);
      const t = obj.getComponent<TransformComponent>(TransformType);
      if (!b || !t) continue;

      b.elapsed += dt;
      const d = b.descriptor;

      switch (d.kind) {
        case 'idle':
          t.vx = 0;
          t.vy = 0;
          break;

        case 'linear': {
          const speed = d.speed ?? 50;
          const dir = d.direction ?? 0;
          t.vx = Math.cos(dir) * speed;
          t.vy = Math.sin(dir) * speed;
          break;
        }

        case 'sinusoidal': {
          const amp = d.amplitude ?? 50;
          const freq = d.frequency ?? 1;
          const speed = d.speed ?? 50;
          t.vx = speed;
          t.vy = amp * Math.cos(2 * Math.PI * freq * b.elapsed + (d.phase ?? 0));
          break;
        }

        case 'circular': {
          const r = d.radius ?? 100;
          const freq = d.frequency ?? 0.5;
          const ox = d.originX ?? t.x;
          const oy = d.originY ?? t.y;
          const angle = 2 * Math.PI * freq * b.elapsed + (d.phase ?? 0);
          t.vx = 0;
          t.vy = 0;
          t.x = ox + Math.cos(angle) * r;
          t.y = oy + Math.sin(angle) * r;
          t.dirty = true;
          break;
        }

        case 'spin': {
          t.vr = d.speed ?? 1;
          break;
        }
      }
    }
  }
}
