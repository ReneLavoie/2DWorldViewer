import { inject, injectable } from 'inversify';
import { TYPES } from '../di/types';
import { World } from '../ecs/World';
import { QuadtreeSystem } from '../spatial/QuadtreeSystem';
import { RenderingSystem } from './RenderingSystem';
import { BackgroundSystem } from './BackgroundSystem';
import { QuadtreeItem } from '../spatial/Quadtree';

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

  // Frame-coherent skip support: bump `dirty` whenever the camera moves /
  // resizes / zooms. CameraSystem.update() consumes this flag.
  private dirty = true;
  private lastX = Number.NaN;
  private lastY = Number.NaN;
  private lastZoom = Number.NaN;
  private lastW = 0;
  private lastH = 0;

  private readonly visibleBuf: QuadtreeItem[] = [];

  constructor(
    @inject(TYPES.QuadtreeSystem) private readonly quadtree: QuadtreeSystem,
    @inject(TYPES.RenderingSystem) private readonly rendering: RenderingSystem,
    @inject(TYPES.BackgroundSystem) private readonly background: BackgroundSystem,
  ) {}

  setViewport(width: number, height: number): void {
    if (width !== this.width || height !== this.height) this.dirty = true;
    this.width = width;
    this.height = height;
    this.background.setViewport(width, height);
    this.clampToBounds();
  }

  setPosition(x: number, y: number): void {
    const c = this.clamp(x, y);
    if (c.x !== this.x || c.y !== this.y) this.dirty = true;
    this.x = c.x;
    this.y = c.y;
  }

  setZoom(zoom: number): void {
    if (zoom !== this.zoom) this.dirty = true;
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
    if (c.x !== this.x || c.y !== this.y) {
      this.x = c.x;
      this.y = c.y;
      this.dirty = true;
    }
  }

  getViewWidth(): number {
    return this.width / this.zoom;
  }

  getViewHeight(): number {
    return this.height / this.zoom;
  }

  // Returns true if camera state changed since last sampled.
  isDirty(): boolean {
    if (this.dirty) return true;
    return (
      this.x !== this.lastX ||
      this.y !== this.lastY ||
      this.zoom !== this.lastZoom ||
      this.width !== this.lastW ||
      this.height !== this.lastH
    );
  }

  private snapshot(): void {
    this.lastX = this.x;
    this.lastY = this.y;
    this.lastZoom = this.zoom;
    this.lastW = this.width;
    this.lastH = this.height;
    this.dirty = false;
  }

  update(_world: World): void {
    const pad = this.padding;
    const vw = this.width / this.zoom;
    const vh = this.height / this.zoom;
    const vx = this.x - pad;
    const vy = this.y - pad;
    const w = vw + pad * 2;
    const h = vh + pad * 2;

    const items = this.quadtree.query(vx, vy, w, h, this.visibleBuf);

    this.background.setCamera(this.x, this.y, this.zoom);
    this.rendering.setCameraTransform(this.x, this.y, this.zoom);
    this.rendering.renderItems(items);

    this.snapshot();
  }
}
