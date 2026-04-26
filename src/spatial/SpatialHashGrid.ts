import type { Bounds } from './Bounds';
import type { World } from '../ecs/World';

// Incremental uniform spatial hash grid backed by typed arrays.
// - Each entity is bucketed by AABB-center into one cell.
// - Doubly-linked list per cell uses World's spatial.cellPrev/cellNext arrays
//   so re-bucketing is O(1) without any allocation.
// - Insert/update is a no-op when the entity stays in the same cell.
export class SpatialHashGrid {
  private invCellSize: number;
  private cols = 0;
  private rows = 0;
  private originX = 0;
  private originY = 0;

  private cellHead: Int32Array = new Int32Array(0);

  private maxHalfW = 0;
  private maxHalfH = 0;

  constructor(
    private readonly world: World,
    bounds: Bounds,
    cellSize = 256,
  ) {
    this.invCellSize = 1 / cellSize;
    this.setBounds(bounds);
  }

  setBounds(bounds: Bounds): void {
    this.originX = bounds.x;
    this.originY = bounds.y;
    this.cols = Math.max(1, Math.ceil(bounds.width * this.invCellSize));
    this.rows = Math.max(1, Math.ceil(bounds.height * this.invCellSize));
    this.cellHead = new Int32Array(this.cols * this.rows);
    this.cellHead.fill(-1);
    const w = this.world;
    if (w.size > 0) {
      const s = w.spatial;
      s.cellIdx.fill(-1, 0, w.size);
      s.cellPrev.fill(-1, 0, w.size);
      s.cellNext.fill(-1, 0, w.size);
    }
    this.maxHalfW = 0;
    this.maxHalfH = 0;
  }

  private cellAt(x: number, y: number): number {
    let ix = ((x - this.originX) * this.invCellSize) | 0;
    let iy = ((y - this.originY) * this.invCellSize) | 0;
    if (ix < 0) ix = 0; else if (ix >= this.cols) ix = this.cols - 1;
    if (iy < 0) iy = 0; else if (iy >= this.rows) iy = this.rows - 1;
    return iy * this.cols + ix;
  }

  update(slot: number, cx: number, cy: number, hw: number, hh: number): void {
    if (hw > this.maxHalfW) this.maxHalfW = hw;
    if (hh > this.maxHalfH) this.maxHalfH = hh;

    const newCell = this.cellAt(cx, cy);
    const s = this.world.spatial;
    const oldCell = s.cellIdx[slot];
    if (oldCell === newCell) return;

    if (oldCell !== -1) {
      const prev = s.cellPrev[slot];
      const next = s.cellNext[slot];
      if (prev !== -1) s.cellNext[prev] = next;
      else this.cellHead[oldCell] = next;
      if (next !== -1) s.cellPrev[next] = prev;
    }

    const head = this.cellHead[newCell];
    s.cellPrev[slot] = -1;
    s.cellNext[slot] = head;
    if (head !== -1) s.cellPrev[head] = slot;
    this.cellHead[newCell] = slot;
    s.cellIdx[slot] = newCell;
  }

  remove(slot: number): void {
    const s = this.world.spatial;
    const cell = s.cellIdx[slot];
    if (cell === -1) return;
    const prev = s.cellPrev[slot];
    const next = s.cellNext[slot];
    if (prev !== -1) s.cellNext[prev] = next;
    else this.cellHead[cell] = next;
    if (next !== -1) s.cellPrev[next] = prev;
    s.cellIdx[slot] = -1;
    s.cellPrev[slot] = -1;
    s.cellNext[slot] = -1;
  }

  query(rx: number, ry: number, rw: number, rh: number, outSlots: Int32Array): number {
    if (this.world.size === 0) return 0;

    const padX = this.maxHalfW;
    const padY = this.maxHalfH;
    const qx0 = rx - padX;
    const qy0 = ry - padY;
    const qx1 = rx + rw + padX;
    const qy1 = ry + rh + padY;

    let cx0 = ((qx0 - this.originX) * this.invCellSize) | 0;
    let cy0 = ((qy0 - this.originY) * this.invCellSize) | 0;
    let cx1 = ((qx1 - this.originX) * this.invCellSize) | 0;
    let cy1 = ((qy1 - this.originY) * this.invCellSize) | 0;
    if (cx0 < 0) cx0 = 0;
    if (cy0 < 0) cy0 = 0;
    if (cx1 >= this.cols) cx1 = this.cols - 1;
    if (cy1 >= this.rows) cy1 = this.rows - 1;
    if (cx1 < cx0 || cy1 < cy0) return 0;

    const cellHead = this.cellHead;
    const t = this.world.transform;
    const cellNext = this.world.spatial.cellNext;
    const tx = t.tx;
    const ty = t.ty;
    const tw = t.tw;
    const th = t.th;
    const tsx = t.tsx;
    const tsy = t.tsy;
    const cols = this.cols;
    const rxEnd = rx + rw;
    const ryEnd = ry + rh;
    const cap = outSlots.length;

    let n = 0;
    for (let y = cy0; y <= cy1; y++) {
      const rowBase = y * cols;
      for (let x = cx0; x <= cx1; x++) {
        let slot = cellHead[rowBase + x];
        while (slot !== -1) {
          const sxAbs = tsx[slot] < 0 ? -tsx[slot] : tsx[slot];
          const syAbs = tsy[slot] < 0 ? -tsy[slot] : tsy[slot];
          const w = tw[slot] * sxAbs;
          const h = th[slot] * syAbs;
          const ix = tx[slot] - w * 0.5;
          const iy = ty[slot] - h * 0.5;
          if (ix < rxEnd && ix + w > rx && iy < ryEnd && iy + h > ry) {
            if (n < cap) outSlots[n++] = slot;
            else return n;
          }
          slot = cellNext[slot];
        }
      }
    }
    return n;
  }
}
