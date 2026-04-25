import { inject, injectable } from 'inversify';
import { Container, Sprite } from 'pixi.js';
import { TYPES } from '../di/types';
import { World } from '../ecs/World';
import { GameObject } from '../ecs/GameObject';
import {
  RendererComponent,
  RendererType,
} from '../ecs/components/RendererComponent';
import {
  TransformComponent,
  TransformType,
} from '../ecs/components/TransformComponent';
import { AssetLoader } from '../assets/AssetLoader';

@injectable()
export class RenderingSystem {
  private stage: Container | null = null;
  private layer = new Container();
  private displays = new Map<number, Sprite>();

  constructor(
    @inject(TYPES.AssetLoader) private readonly _assets: AssetLoader,
  ) {
    this.layer.sortableChildren = true;
  }

  attach(stage: Container): void {
    this.stage = stage;
    if (!this.layer.parent) stage.addChild(this.layer);
  }

  setCameraTransform(x: number, y: number, zoom = 1): void {
    this.layer.position.set(-x * zoom, -y * zoom);
    this.layer.scale.set(zoom);
  }

  render(visible: GameObject[]): void {
    if (!this.stage) return;

    const seen = new Set<number>();

    for (const obj of visible) {
      const t = obj.getComponent<TransformComponent>(TransformType);
      const r = obj.getComponent<RendererComponent>(RendererType);
      if (!t || !r) continue;

      seen.add(obj.id);
      let node = this.displays.get(obj.id);
      if (!node) {
        node = this.createDisplay(r);
        this.displays.set(obj.id, node);
        this.layer.addChild(node);
      } else if (node.texture !== r.texture) {
        node.texture = r.texture;
      }

      if (t.dirty) {
        node.x = t.x;
        node.y = t.y;
        node.rotation = t.rotation;
        node.scale.set(t.scaleX, t.scaleY);
        t.dirty = false;
      }
      node.tint = r.tint;
      node.alpha = r.alpha;
      node.zIndex = r.zIndex;
      node.anchor.set(r.anchorX, r.anchorY);
      node.visible = true;
    }

    for (const [id, node] of this.displays) {
      if (!seen.has(id)) {
        node.visible = false;
      }
    }
  }

  removeObject(id: number): void {
    const node = this.displays.get(id);
    if (node) {
      this.layer.removeChild(node);
      node.destroy();
      this.displays.delete(id);
    }
  }

  syncWith(world: World): void {
    const alive = new Set(world.all().map((o) => o.id));
    for (const id of Array.from(this.displays.keys())) {
      if (!alive.has(id)) this.removeObject(id);
    }
  }

  private createDisplay(r: RendererComponent): Sprite {
    const s = new Sprite(r.texture);
    s.anchor.set(r.anchorX, r.anchorY);
    return s;
  }
}
