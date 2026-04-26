import { inject, injectable } from 'inversify';
import { TYPES } from '../di/types';
import { World } from '../ecs/World';
import { SpatialIndexSystem } from '../spatial/SpatialIndexSystem';
import { TransformSystem } from './TransformSystem';
import { BehaviorSystem } from './BehaviorSystem';
import { RenderingSystem } from './RenderingSystem';
import { BackgroundSystem } from './BackgroundSystem';
import { CameraSystem } from './CameraSystem';

// Drives the per-frame system pipeline in the right order:
//   1. Camera selects which slots are active for this frame (LOD culling).
//   2. Behavior + Transform mutate the active subset's transforms.
//   3. Spatial index re-buckets only what moved (skipped when entire world
//      is visible because the renderer no longer needs spatial lookups).
//   4. Camera transform is pushed to the background and entity layers.
//   5. World's per-frame dirty counters are reset for the next tick.
@injectable()
export class FrameScheduler {
  public constructor(
    @inject(TYPES.World) private readonly world: World,
    @inject(TYPES.SpatialIndexSystem) private readonly spatialIndex: SpatialIndexSystem,
    @inject(TYPES.TransformSystem) private readonly transform: TransformSystem,
    @inject(TYPES.BehaviorSystem) private readonly behavior: BehaviorSystem,
    @inject(TYPES.RenderingSystem) private readonly rendering: RenderingSystem,
    @inject(TYPES.BackgroundSystem) private readonly background: BackgroundSystem,
    @inject(TYPES.CameraSystem) private readonly camera: CameraSystem,
  ) {}

  // Propagate viewport size to systems that depend on it.
  public setViewport(width: number, height: number): void {
    this.camera.setViewport(width, height);
    this.background.setViewport(width, height);
  }

  // One simulation + render step. `dt` is in seconds.
  public tick(dt: number): void {
    const world = this.world;
    const camera = this.camera;

    // Decide which entities to simulate AND render this frame.
    camera.beginFrame(world, dt);

    // Simulate only the active subset.
    this.behavior.update(world, dt);
    this.transform.update(world, dt);

    // Re-bucket only the simulated subset; skip when the camera covers the
    // whole world (rendering uses density binning, not the spatial grid).
    if (!camera.isCoveringWorld() && world.dirtyTransforms > 0) {
      this.spatialIndex.update();
    }

    // Push camera transform and render the active subset.
    this.background.setCamera(camera.x, camera.y, camera.zoom);
    this.rendering.setCameraTransform(camera.x, camera.y, camera.zoom);
    this.rendering.renderSlots(world.activeIds, world.activeCount);

    world.resetFrameDirty();
  }
}
