import { inject, injectable } from 'inversify';
import { TYPES } from '../di/types';
import { Bounds } from './Bounds';
import { SpatialPyramid } from './SpatialPyramid';
import { World } from '../ecs/World';

@injectable()
export class SpatialIndexSystem {
  private pyramid: SpatialPyramid;
  private worldBounds: Bounds;

  // Reusable visible-slot output buffer; grown on demand.
  private visibleBuf: Int32Array = new Int32Array(4096);
  private lastVisibleCount = 0;

  constructor(
    @inject(TYPES.World) private readonly world: World,
  ) {
    this.worldBounds = { x: -5000, y: -5000, width: 10000, height: 10000 };
    // Hierarchical levels: fine grid for close-up queries, coarser levels
    // automatically selected when the viewport spans many fine cells.
    this.pyramid = new SpatialPyramid(this.world, this.worldBounds, [512, 2048, 8192]);
  }

  setWorldBounds(bounds: Bounds): void {
    this.worldBounds = bounds;
    this.pyramid.setBounds(bounds);
    this.rebuildAll();
  }

  rebuildAll(): void {
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

  update(): void {
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

  query(rx: number, ry: number, rw: number, rh: number): Int32Array {
    if (this.visibleBuf.length < this.world.size) {
      this.visibleBuf = new Int32Array(this.world.size);
    }
    this.lastVisibleCount = this.pyramid.query(rx, ry, rw, rh, this.visibleBuf);
    return this.visibleBuf;
  }

  visibleCount(): number {
    return this.lastVisibleCount;
  }
}
