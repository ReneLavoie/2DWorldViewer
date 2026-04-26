import { injectable } from 'inversify';
import { GameObject } from './GameObject';
import { ComponentStore } from './ComponentStore';
import { TransformComponent } from './components/TransformComponent';
import { BehaviorComponent } from './components/BehaviorComponent';
import { SpatialComponent } from './components/SpatialComponent';
import { RenderComponent } from './components/RenderComponent';

export {
  KIND_LINEAR,
  KIND_SINUSOIDAL,
  KIND_CIRCULAR,
  KIND_SPIN,
} from './components/BehaviorComponent';

const INITIAL_CAPACITY = 1024;

@injectable()
export class World {
  // Component stores. Each owns its parallel typed arrays and grows in lockstep
  // with the world's slot capacity. Slots are linked to GameObject ids via
  // `indexById` and the GameObject's `index` field.
  readonly transform = new TransformComponent();
  readonly behavior = new BehaviorComponent();
  readonly spatial = new SpatialComponent();
  readonly render = new RenderComponent();

  private readonly stores: ComponentStore[] = [
    this.transform,
    this.behavior,
    this.spatial,
    this.render,
  ];

  private _objects: GameObject[] = [];
  private indexById = new Map<number, number>();

  capacity = 0;
  size = 0;

  // Active (LOD-selected) slots that should be simulated and rendered this frame.
  activeIds!: Int32Array;
  activeCount = 0;
  // When true, simulation iterates `activeIds` instead of the full slot range.
  lodMode = false;

  dirtyTransforms = 0;
  structuralDirty = true;

  // Tracked across all entities for camera frustum padding:
  //   pad = maxSpeed * dt + maxHalfExtent
  // Updated by GameObjectFactory at creation time.
  maxSpeed = 0;
  maxHalfExtent = 0;

  constructor() {
    this.reserve(INITIAL_CAPACITY);
  }

  reserve(min: number): void {
    if (min <= this.capacity) return;
    let next = Math.max(this.capacity, 1);
    while (next < min) next *= 2;
    for (const s of this.stores) s.reserve(next);
    const newActive = new Int32Array(next);
    if (this.activeIds) newActive.set(this.activeIds);
    this.activeIds = newActive;
    this.capacity = next;
  }

  allocateSlot(obj: GameObject): number {
    const existing = this.indexById.get(obj.id);
    if (existing !== undefined) return existing;
    const idx = this.size;
    if (idx >= this.capacity) this.reserve(idx + 1);
    this._objects[idx] = obj;
    this.indexById.set(obj.id, idx);
    obj.index = idx;
    this.size = idx + 1;
    for (const s of this.stores) s.onSlotAllocated(idx);
    this.structuralDirty = true;
    return idx;
  }

  get objects(): readonly GameObject[] {
    return this._objects;
  }

  add(obj: GameObject): void {
    if (this.indexById.has(obj.id)) return;
    this.allocateSlot(obj);
  }

  get(id: number): GameObject | undefined {
    const idx = this.indexById.get(id);
    return idx === undefined ? undefined : this._objects[idx];
  }

  has(id: number): boolean {
    return this.indexById.has(id);
  }

  count(): number {
    return this.size;
  }

  resetFrameDirty(): void {
    this.dirtyTransforms = 0;
    this.structuralDirty = false;
  }

  clear(): void {
    this._objects.length = 0;
    this.indexById.clear();
    this.size = 0;
    this.activeCount = 0;
    this.lodMode = false;
    this.structuralDirty = true;
    this.maxSpeed = 0;
    this.maxHalfExtent = 0;
  }
}