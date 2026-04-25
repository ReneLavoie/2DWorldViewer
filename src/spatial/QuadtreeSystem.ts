import { injectable } from 'inversify';
import { Bounds, QuadtreeItem } from './Quadtree';
import { SpatialHashGrid } from './SpatialHashGrid';
import { World } from '../ecs/World';
import { GameObject } from '../ecs/GameObject';

@injectable()
export class QuadtreeSystem {
  private grid: SpatialHashGrid;
  private worldBounds: Bounds;

  constructor() {
    this.worldBounds = { x: -5000, y: -5000, width: 10000, height: 10000 };
    this.grid = new SpatialHashGrid(this.worldBounds, 128);
  }

  setWorldBounds(bounds: Bounds): void {
    this.worldBounds = bounds;
    this.grid.setBounds(bounds);
  }

  rebuild(world: World): void {
    this.grid.begin();
    const items = world.items;
    for (let i = 0, n = items.length; i < n; i++) {
      const obj = items[i];
      const t = obj.transform;
      if (!t) continue;
      let item = obj.spatial;
      if (!item) {
        item = new QuadtreeItem();
        item.id = obj.id;
        item.obj = obj;
        obj.spatial = item;
      }
      const sx = t.scaleX < 0 ? -t.scaleX : t.scaleX;
      const sy = t.scaleY < 0 ? -t.scaleY : t.scaleY;
      const w = t.width * sx;
      const h = t.height * sy;
      item.x = t.x - w * 0.5;
      item.y = t.y - h * 0.5;
      item.w = w;
      item.h = h;
      this.grid.insert(item);
    }
  }

  query(rx: number, ry: number, rw: number, rh: number, out: QuadtreeItem[]): QuadtreeItem[] {
    return this.grid.query(rx, ry, rw, rh, out);
  }

  queryBounds(range: Bounds, out: QuadtreeItem[]): QuadtreeItem[] {
    return this.grid.query(range.x, range.y, range.width, range.height, out);
  }

  releaseObject(obj: GameObject): void {
    obj.spatial = null;
  }
}
