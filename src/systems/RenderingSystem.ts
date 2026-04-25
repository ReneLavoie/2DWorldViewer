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

  // Slot-textures table parallel to world.texIdx.
  private textures: Texture[] = [];

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

  setTextures(textures: Texture[]): void {
    this.textures = textures;
  }

  setAtlasTexture(tex: Texture): void {
    if (this.atlasTexture === tex && this.container !== null) return;
    this.atlasTexture = tex;
    if (this.container) {
      this.layer.removeChild(this.container as unknown as Container);
      this.container.destroy();
    }
    // Only position and rotation change frame-to-frame. UVs/color/vertex are
    // baked at particle creation, so mark them static to avoid per-frame
    // GPU buffer uploads for those attributes.
    const c = new ParticleContainer({
      texture: tex,
      dynamicProperties: {
        position: true,
        rotation: true,
        uvs: false,
        color: false,
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

  // `slots` holds `count` slot indices into the World's SoA arrays.
  renderSlots(slots: Int32Array, count: number): void {
    if (!this.stage || !this.container) return;

    const world = this.world;
    const tx = world.tx;
    const ty = world.ty;
    const trot = world.trot;
    const tsx = world.tsx;
    const tsy = world.tsy;
    const tdirty = world.tdirty;
    const texIdx = world.texIdx;
    const tints = world.tint;
    const particles = world.particles;
    const textures = this.textures;

    const children = this.childrenArr;
    if (children.length < count) children.length = count;

    let n = 0;
    for (let k = 0; k < count; k++) {
      const i = slots[k];
      let p = particles[i];
      if (p === null) {
        const tex = textures[texIdx[i]];
        if (tex === undefined) continue;
        p = new Particle({
          texture: tex,
          anchorX: 0.5,
          anchorY: 0.5,
          tint: tints[i],
          alpha: 1,
        });
        particles[i] = p;
      }

      p.x = tx[i];
      p.y = ty[i];
      p.rotation = trot[i];
      p.scaleX = tsx[i];
      p.scaleY = tsy[i];

      children[n++] = p;
      tdirty[i] = 0;
    }
    if (children.length !== n) children.length = n;

    this.container.update();
  }

  removeObject(obj: GameObject): void {
    const i = obj.index;
    if (i >= 0) this.world.particles[i] = null;
    obj.displayParticle = null;
    obj.displayActive = false;
    obj.displayTick = 0;
  }
}
