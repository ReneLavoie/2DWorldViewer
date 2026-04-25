import { inject, injectable } from 'inversify';
import { TYPES } from '../di/types';
import { World } from '../ecs/World';
import { GameObject } from '../ecs/GameObject';
import { QuadtreeSystem } from '../spatial/QuadtreeSystem';
import { RenderingSystem } from './RenderingSystem';
import { BackgroundSystem } from './BackgroundSystem';
import { Bounds } from '../spatial/Quadtree';

@injectable()
export class CameraSystem {
  x = 0;
  y = 0;
  width = 800;
  height = 600;
  zoom = 1;
  padding = 64;

  constructor(
    @inject(TYPES.QuadtreeSystem) private readonly quadtree: QuadtreeSystem,
    @inject(TYPES.RenderingSystem) private readonly rendering: RenderingSystem,
    @inject(TYPES.BackgroundSystem) private readonly background: BackgroundSystem,
  ) {}

  setViewport(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.background.setViewport(width, height);
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  getViewWidth(): number {
    return this.width / this.zoom;
  }

  getViewHeight(): number {
    return this.height / this.zoom;
  }

  getViewBounds(): Bounds {
    const w = this.getViewWidth();
    const h = this.getViewHeight();
    return {
      x: this.x - this.padding,
      y: this.y - this.padding,
      width: w + this.padding * 2,
      height: h + this.padding * 2,
    };
  }

  update(world: World): void {
    const view = this.getViewBounds();
    const items = this.quadtree.query(view);

    const visible: GameObject[] = [];
    for (const item of items) {
      const obj = world.get(item.id);
      if (obj) visible.push(obj);
    }

    this.background.setCamera(this.x, this.y, this.zoom);
    this.rendering.setCameraTransform(this.x, this.y, this.zoom);
    this.rendering.render(visible);
  }
}
