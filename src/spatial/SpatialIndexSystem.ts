import { inject, injectable } from 'inversify';
import { TYPES } from '../di/types';
import { Bounds } from './Bounds';
import { SpatialPyramid } from './SpatialPyramid';
import { World } from '../ecs/World';

// Facade in front of a multi-resolution spatial index.
//
// Exposes a simple update/query API to systems while internally maintaining a
// SpatialPyramid (several SpatialHashGrids at different cell sizes) so queries
// can pick the granularity that matches the current viewport.
@injectable()
export class SpatialIndexSystem {
  private pyramid: SpatialPyramid;
  private worldBounds: Bounds;

  // Reusable visible-slot output buffer; grown on demand to fit world.size.
  private visibleBuf: Int32Array = new Int32Array(4096);
  private lastVisibleCount = 0;

  public constructor(
    @inject(TYPES.World) private readonly world: World,
  ) {
    this.worldBounds = { x: -5000, y: -5000, width: 10000, height: 10000 };
    // Hierarchical levels: fine grid for close-up queries, coarser levels
    // automatically selected when the viewport spans many fine cells.
    this.pyramid = new SpatialPyramid(this.world, this.worldBounds, [512, 2048, 8192]);
  }

  // Resets the world rectangle and re-buckets every existing entity. Called
  // once during boot from index.ts after the bounds are known.
  public setWorldBounds(bounds: Bounds): void {
    this.worldBounds = bounds;
    this.pyramid.setBounds(bounds);
    this.rebuildAll();
  }

  // Bulk re-bucket: pushes every world slot through every pyramid level.
  // Called once after createMany() to seed the index.
  public rebuildAll(): void {
    const w = this.world;
    const t = w.transform;
    const tx = t.tx;
    const ty = t.ty;
    const tw = t.tw;
    const th = t.th;
    const tsx = t.tsx;
    const tsy = t.tsy;
    const n = w.size;
    const pyramid = this.pyramid;
    for (let i = 0; i < n; i++) {
      const sx = tsx[i] < 0 ? -tsx[i] : tsx[i];
      const sy = tsy[i] < 0 ? -tsy[i] : tsy[i];
      pyramid.update(i, tx[i], ty[i], tw[i] * sx * 0.5, th[i] * sy * 0.5);
    }
  }

  // Per-frame incremental update: re-buckets only the active subset
  // (entities the camera selected this frame).
  public update(): void {
    const w = this.world;
    const t = w.transform;
    const tx = t.tx;
    const ty = t.ty;
    const tw = t.tw;
    const th = t.th;
    const tsx = t.tsx;
    const tsy = t.tsy;
    const ids = w.activeIds;
    const n = w.activeCount;
    const pyramid = this.pyramid;
    for (let k = 0; k < n; k++) {
      const i = ids[k];
      const sx = tsx[i] < 0 ? -tsx[i] : tsx[i];
      const sy = tsy[i] < 0 ? -tsy[i] : tsy[i];
      pyramid.update(i, tx[i], ty[i], tw[i] * sx * 0.5, th[i] * sy * 0.5);
    }
  }

  // Returns slot indices that overlap the given world-space rect. The result
  // buffer is owned by this system; valid until the next query() call.
  // Use visibleCount() to read the actual element count.
  public query(rx: number, ry: number, rw: number, rh: number): Int32Array {
    if (this.visibleBuf.length < this.world.size) {
      this.visibleBuf = new Int32Array(this.world.size);
    }
    this.lastVisibleCount = this.pyramid.query(rx, ry, rw, rh, this.visibleBuf);
    return this.visibleBuf;
  }

  public visibleCount(): number {
    return this.lastVisibleCount;
  }
}
