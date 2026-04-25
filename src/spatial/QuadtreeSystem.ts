import { inject, injectable } from 'inversify';
import { TYPES } from '../di/types';
import { Bounds } from './Quadtree';
import { SpatialHashGrid } from './SpatialHashGrid';
import { World } from '../ecs/World';
import { GameObject } from '../ecs/GameObject';

@injectable()
export class QuadtreeSystem {
  private grid: SpatialHashGrid;
  private worldBounds: Bounds;

  // Reusable visible-slot output buffer; grown on demand.
  private visibleBuf: Int32Array = new Int32Array(4096);
  private lastVisibleCount = 0;

  constructor(
    @inject(TYPES.World) private readonly world: World,
  ) {
    this.worldBounds = { x: -5000, y: -5000, width: 10000, height: 10000 };
    this.grid = new SpatialHashGrid(this.world, this.worldBounds, 256);
  }

  setWorldBounds(bounds: Bounds): void {
    this.worldBounds = bounds;
    this.grid.setBounds(bounds);
    // After bounds change every entity must be re-inserted.
    this.rebuildAll();
  }

  // Re-bucket every live entity. Called when bounds change or after bulk add.
  rebuildAll(): void {
    const w = this.world;
    const tx = w.tx;
    const ty = w.ty;
    const tw = w.tw;
    const th = w.th;
    const tsx = w.tsx;
    const tsy = w.tsy;
    const n = w.size;
    for (let i = 0; i < n; i++) {
      const sx = tsx[i] < 0 ? -tsx[i] : tsx[i];
      const sy = tsy[i] < 0 ? -tsy[i] : tsy[i];
      this.grid.update(i, tx[i], ty[i], tw[i] * sx * 0.5, th[i] * sy * 0.5);
    }
  }

  // Incremental update: only re-bucket entities whose transform changed since
  // last frame (tdirty[i] === 1). Entities that did not move skip the grid
  // entirely. Clears tdirty after consuming.
  update(): void {
    const w = this.world;
    const tx = w.tx;
    const ty = w.ty;
    const tw = w.tw;
    const th = w.th;
    const tsx = w.tsx;
    const tsy = w.tsy;
    const tdirty = w.tdirty;
    const n = w.size;
    for (let i = 0; i < n; i++) {
      if (tdirty[i] === 0) continue;
      const sx = tsx[i] < 0 ? -tsx[i] : tsx[i];
      const sy = tsy[i] < 0 ? -tsy[i] : tsy[i];
      this.grid.update(i, tx[i], ty[i], tw[i] * sx * 0.5, th[i] * sy * 0.5);
      // tdirty cleared by RenderingSystem after sprite sync; leave intact.
    }
  }

  query(rx: number, ry: number, rw: number, rh: number): Int32Array {
    // Worst-case: every entity overlaps; ensure capacity.
    if (this.visibleBuf.length < this.world.size) {
      this.visibleBuf = new Int32Array(this.world.size);
    }
    this.lastVisibleCount = this.grid.query(rx, ry, rw, rh, this.visibleBuf);
    return this.visibleBuf;
  }

  queryBounds(range: Bounds): Int32Array {
    return this.query(range.x, range.y, range.width, range.height);
  }

  visibleCount(): number {
    return this.lastVisibleCount;
  }

  releaseObject(obj: GameObject): void {
    if (obj.index >= 0) this.grid.remove(obj.index);
  }
}
