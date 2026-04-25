import { injectable } from 'inversify';
import { GameObject } from './GameObject';

@injectable()
export class World {
  private readonly _items: GameObject[] = [];
  private readonly indexById = new Map<number, number>();

  // Per-frame dirty counter incremented by TransformSystem / BehaviorSystem when
  // they actually mutate a transform. CameraSystem / index.ts read this to
  // decide whether to rebuild the spatial index and re-render this frame.
  dirtyTransforms = 0;
  // Set when objects are added/removed (the spatial index must be rebuilt at
  // least once after any structural change).
  structuralDirty = true;

  get items(): readonly GameObject[] {
    return this._items;
  }

  add(obj: GameObject): void {
    if (this.indexById.has(obj.id)) return;
    this.indexById.set(obj.id, this._items.length);
    this._items.push(obj);
    this.structuralDirty = true;
  }

  remove(id: number): void {
    const idx = this.indexById.get(id);
    if (idx === undefined) return;
    const last = this._items.length - 1;
    if (idx !== last) {
      const swapped = this._items[last];
      this._items[idx] = swapped;
      this.indexById.set(swapped.id, idx);
    }
    this._items.pop();
    this.indexById.delete(id);
    this.structuralDirty = true;
  }

  get(id: number): GameObject | undefined {
    const idx = this.indexById.get(id);
    return idx === undefined ? undefined : this._items[idx];
  }

  has(id: number): boolean {
    return this.indexById.has(id);
  }

  forEach(cb: (obj: GameObject) => void): void {
    const arr = this._items;
    for (let i = 0, n = arr.length; i < n; i++) cb(arr[i]);
  }

  count(): number {
    return this._items.length;
  }

  size(): number {
    return this._items.length;
  }

  resetFrameDirty(): void {
    this.dirtyTransforms = 0;
    this.structuralDirty = false;
  }

  clear(): void {
    this._items.length = 0;
    this.indexById.clear();
    this.structuralDirty = true;
  }
}
