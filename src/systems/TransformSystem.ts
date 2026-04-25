import { injectable } from 'inversify';
import { World } from '../ecs/World';
import { TransformComponent, TransformType } from '../ecs/components/TransformComponent';

@injectable()
export class TransformSystem {
  update(world: World, dt: number): void {
    for (const obj of world.all()) {
      const t = obj.getComponent<TransformComponent>(TransformType);
      if (!t) continue;
      if (t.vx !== 0 || t.vy !== 0 || t.vr !== 0) {
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        t.rotation += t.vr * dt;
        t.dirty = true;
      }
    }
  }
}