import { ComponentStore, growI32 } from '../ComponentStore';

export class SpatialComponent extends ComponentStore {
  cellIdx!: Int32Array;
  cellPrev!: Int32Array;
  cellNext!: Int32Array;

  protected grow(next: number): void {
    this.cellIdx = growI32(this.cellIdx, next, -1);
    this.cellPrev = growI32(this.cellPrev, next, -1);
    this.cellNext = growI32(this.cellNext, next, -1);
  }

  onSlotAllocated(slot: number): void {
    this.cellIdx[slot] = -1;
    this.cellPrev[slot] = -1;
    this.cellNext[slot] = -1;
  }
}
