import { inject, injectable } from 'inversify';
import { TYPES } from '../di/types';
import { World } from '../ecs/World';
import { SpatialIndexSystem } from '../spatial/SpatialIndexSystem';

@injectable()
export class CameraSystem {
  x = 0;
  y = 0;
  width = 800;
  height = 600;
  zoom = 1;
  // Frustum padding floor (world units). The actual padding each frame is
  //   max(paddingFloor, world.maxSpeed * dt + world.maxHalfExtent)
  // so it expands for fast entities and shrinks for static ones.
  paddingFloor = 0;

  private boundsX = -Infinity;
  private boundsY = -Infinity;
  private boundsW = Infinity;
  private boundsH = Infinity;
  private hasBounds = false;

  // Maximum number of objects to render at extreme zoom-out.
  private lodCap = 30000;
  private coversWorld = false;

  // Density LOD: a transient screen-space cell grid used to keep at most one
  // sprite per cell, which preserves spatial coverage instead of randomly
  // dropping entities the way stride-sampling does. `cellMark` is stamped per
  // frame so it doesn't need clearing.
  private cellMark: Uint32Array = new Uint32Array(0);
  private cellStamp = 0;
  private readonly minCellPx = 4;

  constructor(
    @inject(TYPES.SpatialIndexSystem) private readonly spatialIndex: SpatialIndexSystem,
  ) {}

  setViewport(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.clampToBounds();
  }

  setPosition(x: number, y: number): void {
    const c = this.clamp(x, y);
    this.x = c.x;
    this.y = c.y;
  }

  setZoom(zoom: number): void {
    this.zoom = zoom;
    this.clampToBounds();
  }

  setWorldBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.boundsX = bounds.x;
    this.boundsY = bounds.y;
    this.boundsW = bounds.width;
    this.boundsH = bounds.height;
    this.hasBounds = true;
    this.clampToBounds();
  }

  private clamp(x: number, y: number): { x: number; y: number } {
    if (!this.hasBounds) return { x, y };
    const vw = this.width / this.zoom;
    const vh = this.height / this.zoom;
    let cx: number;
    let cy: number;
    if (vw >= this.boundsW) {
      cx = this.boundsX + (this.boundsW - vw) / 2;
    } else {
      const minX = this.boundsX;
      const maxX = this.boundsX + this.boundsW - vw;
      cx = x < minX ? minX : x > maxX ? maxX : x;
    }
    if (vh >= this.boundsH) {
      cy = this.boundsY + (this.boundsH - vh) / 2;
    } else {
      const minY = this.boundsY;
      const maxY = this.boundsY + this.boundsH - vh;
      cy = y < minY ? minY : y > maxY ? maxY : y;
    }
    return { x: cx, y: cy };
  }

  private clampToBounds(): void {
    const c = this.clamp(this.x, this.y);
    this.x = c.x;
    this.y = c.y;
  }

  setLodCap(n: number): void {
    this.lodCap = n;
  }

  // Choose which entity slots to simulate AND render this frame, populating
  // world.activeIds/activeCount and world.lodMode. Must be called before the
  // simulation systems run so they can iterate only the active subset.
  beginFrame(world: World, dt: number): void {
    // Pad the visible rect so entities entering from outside aren't culled
    // before they cross the screen edge. Driven by the per-frame max travel
    // distance plus the largest sprite half-extent (for rotation safety).
    const dynPad = world.maxSpeed * dt + world.maxHalfExtent;
    const pad = dynPad > this.paddingFloor ? dynPad : this.paddingFloor;
    const vw = this.width / this.zoom;
    const vh = this.height / this.zoom;
    const vx = this.x - pad;
    const vy = this.y - pad;
    const w = vw + pad * 2;
    const h = vh + pad * 2;

    const totalSize = world.size;
    this.coversWorld = !this.hasBounds
      ? false
      : vx <= this.boundsX && vy <= this.boundsY &&
        vx + w >= this.boundsX + this.boundsW &&
        vy + h >= this.boundsY + this.boundsH;

    if (totalSize === 0) {
      world.activeCount = 0;
      world.lodMode = false;
      return;
    }

    const cap = this.lodCap;
    const tx = world.transform.tx;
    const ty = world.transform.ty;

    // Cell size in screen pixels chosen so that the visible cell grid has
    // roughly `cap` cells. Translates to a world-space cell size via zoom.
    const screenArea = this.width * this.height;
    let cellPx = Math.sqrt(screenArea / Math.max(1, cap));
    if (cellPx < this.minCellPx) cellPx = this.minCellPx;
    const cellW = cellPx / this.zoom;
    const invCell = 1 / cellW;
    const cols = Math.max(1, Math.ceil(w * invCell));
    const rows = Math.max(1, Math.ceil(h * invCell));
    const cellCount = cols * rows;
    if (this.cellMark.length < cellCount) {
      this.cellMark = new Uint32Array(cellCount);
      this.cellStamp = 0;
    }
    const cellMark = this.cellMark;
    const stamp = ++this.cellStamp;

    if (this.coversWorld) {
      // Entire world visible: bin every entity into the screen cell grid and
      // keep the first per cell. Bounded by `cap` via early exit.
      if (world.activeIds.length < cap) world.activeIds = new Int32Array(cap);
      const buf = world.activeIds;
      let n = 0;
      for (let i = 0; i < totalSize; i++) {
        const cx = (tx[i] - vx) * invCell;
        const cy = (ty[i] - vy) * invCell;
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
        const ci = (cy | 0) * cols + (cx | 0);
        if (cellMark[ci] === stamp) continue;
        cellMark[ci] = stamp;
        buf[n++] = i;
        if (n >= cap) break;
      }
      world.activeCount = n;
      world.lodMode = true;
      return;
    }

    // Windowed: query the spatial grid for visible slots.
    const slots = this.spatialIndex.query(vx, vy, w, h);
    const count = this.spatialIndex.visibleCount();

    if (count <= cap) {
      // Sparse enough that every visible entity fits the budget; no LOD needed.
      if (world.activeIds.length < count) world.activeIds = new Int32Array(count);
      world.activeIds.set(slots.subarray(0, count));
      world.activeCount = count;
      world.lodMode = true;
      return;
    }

    // Dense: density-bin into screen cells, keeping first per cell.
    if (world.activeIds.length < cap) world.activeIds = new Int32Array(cap);
    const buf = world.activeIds;
    let n = 0;
    for (let k = 0; k < count; k++) {
      const i = slots[k];
      const cx = (tx[i] - vx) * invCell;
      const cy = (ty[i] - vy) * invCell;
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
      const ci = (cy | 0) * cols + (cx | 0);
      if (cellMark[ci] === stamp) continue;
      cellMark[ci] = stamp;
      buf[n++] = i;
      if (n >= cap) break;
    }
    world.activeCount = n;
    world.lodMode = true;
  }

  // Whether the previous beginFrame() determined the camera covers the whole world.
  isCoveringWorld(): boolean {
    return this.coversWorld;
  }
}