import { injectable } from 'inversify';
import { Bounds, Quadtree, QuadtreeItem } from './Quadtree';
import { World } from '../ecs/World';
import { TransformComponent, TransformType } from '../ecs/components/TransformComponent';

@injectable()
export class QuadtreeSystem {
  private tree: Quadtree;
  private worldBounds: Bounds;

  constructor() {
    this.worldBounds = { x: -5000, y: -5000, width: 10000, height: 10000 };
    this.tree = new Quadtree(this.worldBounds);
  }

  setWorldBounds(bounds: Bounds): void {
    this.worldBounds = bounds;
    this.tree = new Quadtree(bounds);
  }

  rebuild(world: World): void {
    this.tree.clear();
    for (const obj of world.all()) {
      const t = obj.getComponent<TransformComponent>(TransformType);
      if (!t) continue;
      const w = t.width * Math.abs(t.scaleX);
      const h = t.height * Math.abs(t.scaleY);
      const item: QuadtreeItem = {
        id: obj.id,
        bounds: {
          x: t.x - w / 2,
          y: t.y - h / 2,
          width: w,
          height: h,
        },
      };
      this.tree.insert(item);
    }
  }

  query(range: Bounds): QuadtreeItem[] {
    return this.tree.query(range);
  }
}
