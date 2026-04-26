import { inject, injectable } from 'inversify';
import { TYPES } from '../di/types';
import { World } from '../ecs/World';
import { SpatialIndexSystem } from '../spatial/SpatialIndexSystem';
import { TransformSystem } from './TransformSystem';
import { BehaviorSystem } from './BehaviorSystem';
import { RenderingSystem } from './RenderingSystem';
import { BackgroundSystem } from './BackgroundSystem';
import { CameraSystem } from './CameraSystem';

@injectable()
export class FrameScheduler {
  constructor(
    @inject(TYPES.World) private readonly world: World,
    @inject(TYPES.SpatialIndexSystem) private readonly spatialIndex: SpatialIndexSystem,
    @inject(TYPES.TransformSystem) private readonly transform: TransformSystem,
    @inject(TYPES.BehaviorSystem) private readonly behavior: BehaviorSystem,
    @inject(TYPES.RenderingSystem) private readonly rendering: RenderingSystem,
    @inject(TYPES.BackgroundSystem) private readonly background: BackgroundSystem,
    @inject(TYPES.CameraSystem) private readonly camera: CameraSystem,
  ) {}

  setViewport(width: number, height: number): void {
    this.camera.setViewport(width, height);
    this.background.setViewport(width, height);
  }

  tick(dt: number): void {
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
