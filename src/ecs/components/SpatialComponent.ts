import { ComponentStore } from '../ComponentStore';

// Spatial-index linkage data per entity. Tracks the cell the entity is
// bucketed into plus prev/next links for the cell's intrusive list. All
// values default to -1 ("not in any cell") so partially-initialised entities
// are never visited by spatial queries.
export class SpatialComponent extends ComponentStore {
  public cellIdx = this.i32('cellIdx', -1);   // current cell index, or -1
  public cellPrev = this.i32('cellPrev', -1); // previous slot in cell list
  public cellNext = this.i32('cellNext', -1); // next slot in cell list

  public onSlotAllocated(slot: number): void {
    this.cellIdx[slot] = -1;
    this.cellPrev[slot] = -1;
    this.cellNext[slot] = -1;
  }
}
