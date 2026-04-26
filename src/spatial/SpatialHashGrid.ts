import type { Bounds } from './Bounds';
import type { World } from '../ecs/World';

// Incremental uniform spatial hash grid backed by typed arrays.
// - Each entity is bucketed by AABB-center into one cell.
// - Per-cell membership is stored as a CSR-style bucketed SoA:
//     cellStart[cell..cell+1) indexes into a flat sorted slots[] array.
//   The bucket layout is rebuilt lazily (counting sort) the next time a
//   query runs after any update/remove. update/remove are O(1) and only
//   mutate cellIdx[slot] + a dirty flag, so insert-heavy frames do not
//   touch the bucket arrays at all. Queries then walk slots[] with
//   sequential, cache-friendly reads instead of pointer-chasing a
//   per-cell doubly-linked list.
export class SpatialHashGrid {
  readonly cellSize: number;
  private invCellSize: number;
  private cols = 0;
  private rows = 0;
  private originX = 0;
  private originY = 0;

  // Per-slot: which cell this slot currently belongs to, or -1.
  private cellIdx: Int32Array = new Int32Array(0);
  private slotCap = 0;

  // Bucketed SoA, rebuilt lazily on first query after a mutation.
  // cellStart has logical length ncells+1; cellStart[c+1]-cellStart[c] is
  // the count for cell c, and slots[cellStart[c]..cellStart[c+1]) lists
  // the slot indices in that cell.
  private cellStart: Int32Array = new Int32Array(1);
  private cellStartCap = 0;
  private slots: Int32Array = new Int32Array(0);
  private slotsCap = 0;
  // Scratch cursor used during the scatter phase of rebuild.
  private cellCursor: Int32Array = new Int32Array(0);
  private dirty = true;

  private maxHalfW = 0;
  private maxHalfH = 0;

  private boundsX = 0;
  private boundsY = 0;
  private boundsW = 0;
  private boundsH = 0;
  private boundsInitialized = false;

  constructor(
    private readonly world: World,
    bounds: Bounds,
    cellSize = 256,
  ) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.setBounds(bounds);
  }

  setBounds(bounds: Bounds): void {
    // No-op if bounds match what we already have.
    if (
      this.boundsInitialized &&
      bounds.x === this.boundsX &&
      bounds.y === this.boundsY &&
      bounds.width === this.boundsW &&
      bounds.height === this.boundsH
    ) {
      return;
    }

    const newCols = Math.max(1, Math.ceil(bounds.width * this.invCellSize));
    const newRows = Math.max(1, Math.ceil(bounds.height * this.invCellSize));
    const sameOrigin =
      this.boundsInitialized &&
      bounds.x === this.boundsX &&
      bounds.y === this.boundsY;
    const canGrow = sameOrigin && newCols >= this.cols && newRows >= this.rows;

    if (canGrow && (newCols !== this.cols || newRows !== this.rows)) {
      // Lazy growth: only remap cellIdx values from the old (col,row) layout
      // to the new linear cell index. The bucket arrays will be rebuilt on
      // the next query, so we don't bother touching them here.
      const oldCols = this.cols;
      const cellIdx = this.cellIdx;
      const slotCap = this.slotCap;
      for (let s = 0; s < slotCap; s++) {
        const c = cellIdx[s];
        if (c < 0) continue;
        const row = (c / oldCols) | 0;
        const col = c - row * oldCols;
        cellIdx[s] = row * newCols + col;
      }
      this.cols = newCols;
      this.rows = newRows;
      this.boundsW = bounds.width;
      this.boundsH = bounds.height;
      this.ensureCellArrays(newCols * newRows);
      this.dirty = true;
      return;
    }

    // Origin/cellSize changed or extents shrank: full reset is required
    // because stale cellIdx values would point at out-of-range cells.
    this.originX = bounds.x;
    this.originY = bounds.y;
    this.cols = newCols;
    this.rows = newRows;
    if (this.slotCap > 0) this.cellIdx.fill(-1);
    this.maxHalfW = 0;
    this.maxHalfH = 0;
    this.boundsX = bounds.x;
    this.boundsY = bounds.y;
    this.boundsW = bounds.width;
    this.boundsH = bounds.height;
    this.boundsInitialized = true;
    this.ensureCellArrays(newCols * newRows);
    this.dirty = true;
  }

  private ensureCellArrays(ncells: number): void {
    const need = ncells + 1;
    if (need <= this.cellStartCap) return;
    let cap = Math.max(this.cellStartCap, 16);
    while (cap < need) cap *= 2;
    this.cellStart = new Int32Array(cap);
    this.cellCursor = new Int32Array(cap);
    this.cellStartCap = cap;
  }

  private ensureSlot(slot: number): void {
    if (slot < this.slotCap) return;
    let next = Math.max(this.slotCap, 1024);
    while (next <= slot) next *= 2;
    const b = new Int32Array(next);
    b.fill(-1);
    b.set(this.cellIdx);
    this.cellIdx = b;
    this.slotCap = next;
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

    this.ensureSlot(slot);
    const newCell = this.cellAt(cx, cy);
    if (this.cellIdx[slot] === newCell) return;
    this.cellIdx[slot] = newCell;
    this.dirty = true;
  }

  remove(slot: number): void {
    if (slot >= this.slotCap) return;
    if (this.cellIdx[slot] === -1) return;
    this.cellIdx[slot] = -1;
    this.dirty = true;
  }

  // Number of cells the given viewport rect would touch at this level.
  cellSpan(rw: number, rh: number): number {
    const cx = Math.ceil(rw * this.invCellSize) + 1;
    const cy = Math.ceil(rh * this.invCellSize) + 1;
    return cx * cy;
  }

  // Counting-sort rebuild of the bucketed SoA. Two linear passes over
  // cellIdx (length slotCap) plus a prefix sum over cellStart. Within a
  // cell, slots are emitted in ascending slot order, which keeps the
  // subsequent transform-array reads roughly forward-scanning.
  private rebuild(): void {
    const ncells = this.cols * this.rows;
    const cellStart = this.cellStart;
    const cellCursor = this.cellCursor;
    const cellIdx = this.cellIdx;
    const slotCap = this.slotCap;

    // Phase 1: count into cellStart[c+1] so the in-place prefix sum below
    // produces the correct start offsets.
    for (let i = 0; i <= ncells; i++) cellStart[i] = 0;
    let total = 0;
    for (let s = 0; s < slotCap; s++) {
      const c = cellIdx[s];
      if (c >= 0) {
        cellStart[c + 1]++;
        total++;
      }
    }

    // Phase 2: exclusive prefix sum -> bucket start offsets.
    for (let c = 0; c < ncells; c++) cellStart[c + 1] += cellStart[c];

    // Phase 3: scatter slots into their buckets. Use cellCursor as a
    // running write index per cell so cellStart is preserved for queries.
    if (total > this.slotsCap) {
      let cap = Math.max(this.slotsCap, 1024);
      while (cap < total) cap *= 2;
      this.slots = new Int32Array(cap);
      this.slotsCap = cap;
    }
    const slots = this.slots;
    for (let i = 0; i < ncells; i++) cellCursor[i] = cellStart[i];
    for (let s = 0; s < slotCap; s++) {
      const c = cellIdx[s];
      if (c >= 0) slots[cellCursor[c]++] = s;
    }

    this.dirty = false;
  }

  query(rx: number, ry: number, rw: number, rh: number, outSlots: Int32Array): number {
    if (this.world.size === 0) return 0;
    if (this.dirty) this.rebuild();

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

    const cellStart = this.cellStart;
    const slots = this.slots;
    const t = this.world.transform;
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
        const cell = rowBase + x;
        const end = cellStart[cell + 1];
        for (let i = cellStart[cell]; i < end; i++) {
          const slot = slots[i];
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
        }
      }
    }
    return n;
  }
}
