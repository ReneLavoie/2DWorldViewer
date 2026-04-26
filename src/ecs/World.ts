import { injectable } from 'inversify';
import { GameObject } from './GameObject';
import { ComponentStore } from './ComponentStore';
import { TransformComponent } from './components/TransformComponent';
import { BehaviorComponent } from './components/BehaviorComponent';
import { SpatialComponent } from './components/SpatialComponent';
import { RenderComponent } from './components/RenderComponent';

// Re-export behavior kind codes here so consumers only need to import from
// the World barrel.
export {
  KIND_LINEAR,
  KIND_SINUSOIDAL,
  KIND_CIRCULAR,
  KIND_SPIN,
} from './components/BehaviorComponent';

const INITIAL_CAPACITY = 1024;

// Central ECS container.
//
// Owns all component stores plus the sparse->dense slot mapping (id -> slot
// index). Designed for SoA iteration: systems read/write component arrays
// directly via `world.<component>.<field>` rather than going through
// per-entity objects.
@injectable()
export class World {
  // Component stores. Each owns its parallel typed arrays and grows in lockstep
  // with the world's slot capacity. Slots are linked to GameObject ids via
  // `indexById` and the GameObject's `index` field.
  public readonly transform = new TransformComponent();
  public readonly behavior = new BehaviorComponent();
  public readonly spatial = new SpatialComponent();
  public readonly render = new RenderComponent();

  // Iteration order for reserve(): all stores grow together in lockstep so a
  // valid slot in one is a valid slot in all of them.
  private readonly stores: ComponentStore[] = [
    this.transform,
    this.behavior,
    this.spatial,
    this.render,
  ];

  // Dense GameObject array indexed by slot. Parallel to component arrays.
  private _objects: GameObject[] = [];
  // Sparse map: GameObject.id -> slot index in the dense arrays.
  private readonly indexById = new Map<number, number>();
  // Monotonic id counter; never reused even after entities are removed.
  private _nextId = 1;

  public capacity = 0;
  public size = 0;

  // Active (LOD-selected) slots that should be simulated and rendered this frame.
  public activeIds!: Int32Array;
  public activeCount = 0;
  // When true, simulation iterates `activeIds` instead of the full slot range.
  public lodMode = false;

  // Counter of transforms mutated this frame; consumed by SpatialIndexSystem
  // to skip the re-bucket pass entirely when nothing moved.
  public dirtyTransforms = 0;
  // True when entities were added/removed since the last reset; signals the
  // spatial index to rebuild from scratch rather than incrementally.
  public structuralDirty = true;

  // Tracked across all entities for camera frustum padding:
  //   pad = maxSpeed * dt + maxHalfExtent
  // Updated by GameObjectFactory at creation time.
  public maxSpeed = 0;
  public maxHalfExtent = 0;

  public constructor() {
    this.reserve(INITIAL_CAPACITY);
  }

  // Ensures all component stores plus the active-id buffer can hold at least
  // `min` slots. Growth is geometric (capacity doubling) to amortise cost.
  public reserve(min: number): void {
    if (min <= this.capacity) return;
    let next = Math.max(this.capacity, 1);
    while (next < min) next *= 2;
    for (const s of this.stores) s.reserve(next);
    const newActive = new Int32Array(next);
    if (this.activeIds) newActive.set(this.activeIds);
    this.activeIds = newActive;
    this.capacity = next;
  }

  // Reserves a dense slot for `obj`, wires up the id->slot map, and gives
  // every component store a chance to initialise the slot. Returns the slot.
  public allocateSlot(obj: GameObject): number {
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

  public get objects(): readonly GameObject[] {
    return this._objects;
  }

  public add(obj: GameObject): void {
    if (this.indexById.has(obj.id)) return;
    this.allocateSlot(obj);
  }

  public get(id: number): GameObject | undefined {
    const idx = this.indexById.get(id);
    return idx === undefined ? undefined : this._objects[idx];
  }

  public has(id: number): boolean {
    return this.indexById.has(id);
  }

  public count(): number {
    return this.size;
  }

  // Allocates a fresh, never-before-used entity id.
  public nextId(): number {
    return this._nextId++;
  }

  // Called at end-of-frame by FrameScheduler to reset the per-frame change
  // counters used by the spatial index.
  public resetFrameDirty(): void {
    this.dirtyTransforms = 0;
    this.structuralDirty = false;
  }

  // Drops every entity and resets bookkeeping. Component arrays are not
  // shrunk: their capacity is kept so the next createMany() doesn't realloc.
  public clear(): void {
    this._objects.length = 0;
    this.indexById.clear();
    this.size = 0;
    this.activeCount = 0;
    this.lodMode = false;
    this.structuralDirty = true;
    this.maxSpeed = 0;
    this.maxHalfExtent = 0;
    this._nextId = 1;
  }
}
