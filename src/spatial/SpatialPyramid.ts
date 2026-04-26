import type { Bounds } from './Bounds';
import type { World } from '../ecs/World';
import { SpatialHashGrid } from './SpatialHashGrid';

// Multi-resolution spatial index: a fixed pyramid of uniform hash grids at
// increasingly coarser cell sizes. Each entity is bucketed into every level
// (one cell per level), so a query at any level returns the same logical set.
//
// Queries pick the coarsest level whose viewport-aligned cell span is small
// enough that per-cell overhead is amortized. At extreme zoom-out this lets
// the camera iterate a handful of huge cells instead of thousands of fine
// ones; at close zoom-in queries naturally fall back to the finest level.
export class SpatialPyramid {
  public readonly levels: SpatialHashGrid[];

  // Cap on how many cells a query is willing to walk before falling back to a
  // coarser level. Per-cell overhead is small, but at zoom-out scales like
  // 1600+ cells per query the head-pointer indirection dominates.
  private readonly maxCellsPerQuery: number;

  public constructor(
    world: World,
    bounds: Bounds,
    cellSizes: number[] = [512, 2048, 8192],
    maxCellsPerQuery = 256,
  ) {
    if (cellSizes.length === 0) throw new Error('SpatialPyramid: cellSizes must be non-empty');
    const sorted = [...cellSizes].sort((a, b) => a - b);
    this.levels = sorted.map((s) => new SpatialHashGrid(world, bounds, s));
    this.maxCellsPerQuery = maxCellsPerQuery;
  }

  public setBounds(bounds: Bounds): void {
    for (let i = 0; i < this.levels.length; i++) this.levels[i].setBounds(bounds);
  }

  public update(slot: number, cx: number, cy: number, hw: number, hh: number): void {
    for (let i = 0; i < this.levels.length; i++) this.levels[i].update(slot, cx, cy, hw, hh);
  }

  public remove(slot: number): void {
    for (let i = 0; i < this.levels.length; i++) this.levels[i].remove(slot);
  }

  // Pick the finest level whose viewport-aligned cell span is below the cap.
  // Walking from finest to coarsest gives the smallest cells (and thus the
  // tightest per-entity AABB pre-filter) that still keep the cell loop short.
  public pickLevel(rw: number, rh: number): SpatialHashGrid {
    const cap = this.maxCellsPerQuery;
    const levels = this.levels;
    for (let i = 0; i < levels.length; i++) {
      if (levels[i].cellSpan(rw, rh) <= cap) return levels[i];
    }
    return levels[levels.length - 1];
  }

  public query(rx: number, ry: number, rw: number, rh: number, outSlots: Int32Array): number {
    return this.pickLevel(rw, rh).query(rx, ry, rw, rh, outSlots);
  }
}