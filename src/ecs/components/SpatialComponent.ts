import { ComponentStore } from '../ComponentStore';

export class SpatialComponent extends ComponentStore {
  public cellIdx = this.i32('cellIdx', -1);
  public cellPrev = this.i32('cellPrev', -1);
  public cellNext = this.i32('cellNext', -1);

  public onSlotAllocated(slot: number): void {
    this.cellIdx[slot] = -1;
    this.cellPrev[slot] = -1;
    this.cellNext[slot] = -1;
  }
}