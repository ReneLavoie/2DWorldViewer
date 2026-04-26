import { ComponentStore } from '../ComponentStore';

export class SpatialComponent extends ComponentStore {
  cellIdx = this.i32('cellIdx', -1);
  cellPrev = this.i32('cellPrev', -1);
  cellNext = this.i32('cellNext', -1);

  onSlotAllocated(slot: number): void {
    this.cellIdx[slot] = -1;
    this.cellPrev[slot] = -1;
    this.cellNext[slot] = -1;
  }
}
