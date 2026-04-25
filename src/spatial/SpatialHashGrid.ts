import type { Bounds, QuadtreeItem } from './Quadtree';

// Uniform spatial hash grid optimized for 100k+ moving point-like items.
// - Items are bucketed by their AABB center into a single cell.
// - Queries pad the search rect by `maxItemSize` so off-cell straddlers are still
//   discovered without inserting one item into multiple cells.
// - All per-frame state lives in pre-sized typed arrays. No per-frame allocations.
export class SpatialHashGrid {
  private cellSize: number;
  private invCellSize: number;
  private cols = 0;
  private rows = 0;
  private originX = 0;
  private originY = 0;

  // Linked list of items per cell. cellHead[c] -> first item slot index, or -1.
  private cellHead: Int32Array = new Int32Array(0);
  // Parallel-with-itemRefs: next item slot index for the same cell, or -1.
  private itemNext: Int32Array = new Int32Array(0);
  private itemRefs: (QuadtreeItem | null)[] = [];
  private capacity = 0;
  private count = 0;

  // Largest item half-size seen this frame (used to pad queries).
  private maxHalfW = 0;
  private maxHalfH = 0;

  constructor(bounds: Bounds, cellSize = 128, initialCapacity = 1024) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.setBounds(bounds);
    this.ensureCapacity(initialCapacity);
  }

  setBounds(bounds: Bounds): void {
    this.originX = bounds.x;
    this.originY = bounds.y;
    this.cols = Math.max(1, Math.ceil(bounds.width * this.invCellSize));
    this.rows = Math.max(1, Math.ceil(bounds.height * this.invCellSize));
    this.cellHead = new Int32Array(this.cols * this.rows);
    this.cellHead.fill(-1);
  }

  setCellSize(cellSize: number): void {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
  }

  // Reset all cells. Capacity / item arrays are preserved.
  begin(): void {
    this.cellHead.fill(-1);
    this.count = 0;
    this.maxHalfW = 0;
    this.maxHalfH = 0;
  }

  insert(item: QuadtreeItem): void {
    const slot = this.count;
    if (slot >= this.capacity) this.ensureCapacity(slot + 1);

    const cx = (item.x + item.w * 0.5 - this.originX) * this.invCellSize;
    const cy = (item.y + item.h * 0.5 - this.originY) * this.invCellSize;
    let ix = cx | 0;
    let iy = cy | 0;
    if (ix < 0) ix = 0; else if (ix >= this.cols) ix = this.cols - 1;
    if (iy < 0) iy = 0; else if (iy >= this.rows) iy = this.rows - 1;
    const cell = iy * this.cols + ix;

    this.itemRefs[slot] = item;
    this.itemNext[slot] = this.cellHead[cell];
    this.cellHead[cell] = slot;
    this.count = slot + 1;

    const hw = item.w * 0.5;
    const hh = item.h * 0.5;
    if (hw > this.maxHalfW) this.maxHalfW = hw;
    if (hh > this.maxHalfH) this.maxHalfH = hh;
  }

  query(rx: number, ry: number, rw: number, rh: number, out: QuadtreeItem[]): QuadtreeItem[] {
    out.length = 0;
    if (this.count === 0) return out;

    // Expand by largest item half-extent so center-bucketed items are not missed.
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
    if (cx1 < cx0 || cy1 < cy0) return out;

    const cellHead = this.cellHead;
    const itemNext = this.itemNext;
    const itemRefs = this.itemRefs;
    const cols = this.cols;
    const rxEnd = rx + rw;
    const ryEnd = ry + rh;

    for (let y = cy0; y <= cy1; y++) {
      const rowBase = y * cols;
      for (let x = cx0; x <= cx1; x++) {
        let slot = cellHead[rowBase + x];
        while (slot !== -1) {
          const it = itemRefs[slot];
          if (it !== null) {
            // Final precise AABB test against the original (un-padded) rect.
            if (it.x < rxEnd && it.x + it.w > rx && it.y < ryEnd && it.y + it.h > ry) {
              out.push(it);
            }
          }
          slot = itemNext[slot];
        }
      }
    }
    return out;
  }

  private ensureCapacity(min: number): void {
    if (this.capacity >= min) return;
    let next = this.capacity > 0 ? this.capacity : 1024;
    while (next < min) next *= 2;
    const oldNext = this.itemNext;
    this.itemNext = new Int32Array(next);
    if (this.count > 0) this.itemNext.set(oldNext.subarray(0, this.count));
    this.itemRefs.length = next;
    this.capacity = next;
  }
}
