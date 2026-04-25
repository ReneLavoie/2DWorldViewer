import { inject, injectable } from 'inversify';
import { Container, Particle, ParticleContainer, Texture } from 'pixi.js';
import { PerformanceMonitor } from 'pixi-msdf-textfield';
import { TYPES } from '../di/types';
import { GameObject } from '../ecs/GameObject';
import { AssetLoader } from '../assets/AssetLoader';
import { World } from '../ecs/World';

@injectable()
export class RenderingSystem {
  private stage: Container | null = null;
  private layer = new Container();

  private container: ParticleContainer | null = null;
  private childrenArr: Particle[] = [];
  private atlasTexture: Texture | null = null;

  private perfMonitor: PerformanceMonitor | null = null;

  constructor(
    @inject(TYPES.AssetLoader) private readonly _assets: AssetLoader,
    @inject(TYPES.World) private readonly world: World,
  ) {
    void this._assets;
    this.layer.sortableChildren = false;
  }

  attach(stage: Container): void {
    this.stage = stage;
    if (!this.layer.parent) stage.addChild(this.layer);
    if (this.perfMonitor === null) {
      this.perfMonitor = new PerformanceMonitor({
        enableConsole: true,
        autoAdjust: false,
      });
      this.perfMonitor.start();
    }
  }

  setAtlasTexture(tex: Texture): void {
    if (this.atlasTexture === tex && this.container !== null) return;
    this.atlasTexture = tex;
    if (this.container) {
      this.layer.removeChild(this.container as unknown as Container);
      this.container.destroy();
    }
    const c = new ParticleContainer({
      texture: tex,
      dynamicProperties: {
        position: true,
        rotation: true,
        uvs: true,
        color: true,
        vertex: false,
      },
    });
    this.container = c;
    this.childrenArr = c.particleChildren as Particle[];
    this.layer.addChild(c as unknown as Container);
  }

  setZBucketCount(_n: number): void {
    // Z-buckets removed; ParticleContainer renders in array order.
  }

  prewarmSprites(_count: number): void {
    // No-op: particles are created lazily per entity.
  }

  setCameraTransform(x: number, y: number, zoom = 1): void {
    this.layer.position.set(-x * zoom, -y * zoom);
    this.layer.scale.set(zoom);
  }

  private ensureParticle(obj: GameObject): Particle | null {
    const r = obj.renderer;
    if (r === null) return null;
    let p = obj.displayParticle;
    if (p === null) {
      p = new Particle({
        texture: r.texture,
        anchorX: r.anchorX,
        anchorY: r.anchorY,
        tint: r.tint,
        alpha: r.alpha,
      });
      obj.displayParticle = p;
    }
    return p;
  }

  // `slots` holds `count` slot indices into the World's SoA arrays.
  renderSlots(slots: Int32Array, count: number): void {
    if (!this.stage || !this.container) return;

    const children = this.childrenArr;
    children.length = 0;

    const world = this.world;
    const objects = world.objects;
    const tx = world.tx;
    const ty = world.ty;
    const trot = world.trot;
    const tsx = world.tsx;
    const tsy = world.tsy;
    const tdirty = world.tdirty;

    for (let k = 0; k < count; k++) {
      const i = slots[k];
      const obj = objects[i];
      if (obj === undefined) continue;
      const r = obj.renderer;
      if (r === null) continue;

      let p = obj.displayParticle;
      if (p === null) {
        p = this.ensureParticle(obj);
        if (p === null) continue;
      } else if (p.texture !== r.texture) {
        p.texture = r.texture;
      }

      p.x = tx[i];
      p.y = ty[i];
      p.rotation = trot[i];
      p.scaleX = tsx[i];
      p.scaleY = tsy[i];

      children.push(p);

      tdirty[i] = 0;
    }

    this.container.update();
  }

  removeObject(obj: GameObject): void {
    obj.displayParticle = null;
    obj.displayActive = false;
    obj.displayTick = 0;
  }
}
