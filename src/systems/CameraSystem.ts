import { inject, injectable } from 'inversify';
import { TYPES } from '../di/types';
import { World } from '../ecs/World';
import { SpatialIndexSystem } from '../spatial/SpatialIndexSystem';
import { RenderingSystem } from './RenderingSystem';
import { BackgroundSystem } from './BackgroundSystem';

@injectable()
export class CameraSystem {
  x = 0;
  y = 0;
  width = 800;
  height = 600;
  zoom = 1;
  padding = 64;

  private boundsX = -Infinity;
  private boundsY = -Infinity;
  private boundsW = Infinity;
  private boundsH = Infinity;
  private hasBounds = false;

  // Maximum number of objects to render at extreme zoom-out.
  private lodCap = 30000;
  private coversWorld = false;

  constructor(
    @inject(TYPES.SpatialIndexSystem) private readonly spatialIndex: SpatialIndexSystem,
    @inject(TYPES.RenderingSystem) private readonly rendering: RenderingSystem,
    @inject(TYPES.BackgroundSystem) private readonly background: BackgroundSystem,
  ) {}

  setViewport(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.background.setViewport(width, height);
    this.clampToBounds();
  }

  setPosition(x: number, y: number): void {
    const c = this.clamp(x, y);
    this.x = c.x;
    this.y = c.y;
  }

  setZoom(zoom: number): void {
    this.zoom = zoom;
    this.clampToBounds();
  }

  setWorldBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.boundsX = bounds.x;
    this.boundsY = bounds.y;
    this.boundsW = bounds.width;
    this.boundsH = bounds.height;
    this.hasBounds = true;
    this.clampToBounds();
  }

  private clamp(x: number, y: number): { x: number; y: number } {
    if (!this.hasBounds) return { x, y };
    const vw = this.width / this.zoom;
    const vh = this.height / this.zoom;
    let cx: number;
    let cy: number;
    if (vw >= this.boundsW) {
      cx = this.boundsX + (this.boundsW - vw) / 2;
    } else {
      const minX = this.boundsX;
      const maxX = this.boundsX + this.boundsW - vw;
      cx = x < minX ? minX : x > maxX ? maxX : x;
    }
    if (vh >= this.boundsH) {
      cy = this.boundsY + (this.boundsH - vh) / 2;
    } else {
      const minY = this.boundsY;
      const maxY = this.boundsY + this.boundsH - vh;
      cy = y < minY ? minY : y > maxY ? maxY : y;
    }
    return { x: cx, y: cy };
  }

  private clampToBounds(): void {
    const c = this.clamp(this.x, this.y);
    this.x = c.x;
    this.y = c.y;
  }

  setLodCap(n: number): void {
    this.lodCap = n;
  }

  // Choose which entity slots to simulate AND render this frame, populating
  // world.activeIds/activeCount and world.lodMode. Must be called before the
  // simulation systems run so they can iterate only the active subset.
  beginFrame(world: World): void {
    const pad = this.padding;
    const vw = this.width / this.zoom;
    const vh = this.height / this.zoom;
    const vx = this.x - pad;
    const vy = this.y - pad;
    const w = vw + pad * 2;
    const h = vh + pad * 2;

    const totalSize = world.size;
    this.coversWorld = !this.hasBounds
      ? false
      : vx <= this.boundsX && vy <= this.boundsY &&
        vx + w >= this.boundsX + this.boundsW &&
        vy + h >= this.boundsY + this.boundsH;

    if (totalSize === 0) {
      world.activeCount = 0;
      world.lodMode = false;
      return;
    }

    if (this.coversWorld) {
      // Entire world visible: stride-sample up to lodCap entities.
      const cap = this.lodCap;
      const stride = totalSize > cap ? Math.ceil(totalSize / cap) : 1;
      const renderCount = Math.ceil(totalSize / stride);
      if (world.activeIds.length < renderCount) {
        world.activeIds = new Int32Array(renderCount);
      }
      const buf = world.activeIds;
      let n = 0;
      for (let i = 0; i < totalSize; i += stride) buf[n++] = i;
      world.activeCount = n;
      world.lodMode = true;
      return;
    }

    // Windowed: query the spatial grid for visible slots.
    const slots = this.spatialIndex.query(vx, vy, w, h);
    let count = this.spatialIndex.visibleCount();

    const cap = this.lodCap;
    if (count > cap) {
      const stride = Math.ceil(count / cap);
      let n = 0;
      for (let i = 0; i < count; i += stride) slots[n++] = slots[i];
      count = n;
    }

    if (world.activeIds.length < count) world.activeIds = new Int32Array(count);
    world.activeIds.set(slots.subarray(0, count));
    world.activeCount = count;
    world.lodMode = true;
  }

  // After simulation has updated transforms for active slots, push the camera
  // transform and render those slots.
  flush(world: World): void {
    this.background.setCamera(this.x, this.y, this.zoom);
    this.rendering.setCameraTransform(this.x, this.y, this.zoom);
    this.rendering.renderSlots(world.activeIds, world.activeCount);
  }

  // Whether the previous beginFrame() determined the camera covers the whole world.
  isCoveringWorld(): boolean {
    return this.coversWorld;
  }
}
