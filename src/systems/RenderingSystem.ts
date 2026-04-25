import { inject, injectable } from 'inversify';
import { Container, Sprite } from 'pixi.js';
import { TYPES } from '../di/types';
import { RendererComponent } from '../ecs/components/RendererComponent';
import { GameObject } from '../ecs/GameObject';
import { AssetLoader } from '../assets/AssetLoader';
import { World } from '../ecs/World';

const DEFAULT_Z_BUCKETS = 10;

@injectable()
export class RenderingSystem {
  private stage: Container | null = null;
  private layer = new Container();

  private spritePool: Sprite[] = [];
  private visibleTick = 0;

  private activeObjs: GameObject[] = [];
  private activeSwap: GameObject[] = [];

  private zBuckets: Container[] = [];
  private zBucketCount = 0;

  constructor(
    @inject(TYPES.AssetLoader) private readonly _assets: AssetLoader,
    @inject(TYPES.World) private readonly world: World,
  ) {
    this.layer.sortableChildren = false;
    this.setZBucketCount(DEFAULT_Z_BUCKETS);
  }

  attach(stage: Container): void {
    this.stage = stage;
    if (!this.layer.parent) stage.addChild(this.layer);
  }

  setZBucketCount(n: number): void {
    while (this.zBuckets.length < n) {
      const bucket = new Container();
      bucket.sortableChildren = false;
      this.zBuckets.push(bucket);
      this.layer.addChild(bucket);
    }
    this.zBucketCount = n;
  }

  prewarmSprites(count: number, fallbackTexture = (this._assets as unknown) as null): void {
    void fallbackTexture;
    const pool = this.spritePool;
    const tex = (this._assets && (this._assets as any).get?.('blue_swirl')) || undefined;
    for (let i = pool.length; i < count; i++) {
      const s = tex ? new Sprite(tex) : new Sprite();
      s.visible = false;
      pool.push(s);
    }
  }

  setCameraTransform(x: number, y: number, zoom = 1): void {
    this.layer.position.set(-x * zoom, -y * zoom);
    this.layer.scale.set(zoom);
  }

  // `slots` holds `count` slot indices into the World's SoA arrays.
  renderSlots(slots: Int32Array, count: number): void {
    if (!this.stage) return;

    this.visibleTick++;
    if (this.visibleTick === 0) this.visibleTick = 1;
    const tick = this.visibleTick;

    const swap = this.activeSwap;
    swap.length = 0;

    const buckets = this.zBuckets;
    const lastBucket = this.zBucketCount - 1;

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

      let z = r.zIndex | 0;
      if (z < 0) z = 0; else if (z > lastBucket) z = lastBucket;

      let sprite = obj.displaySprite;
      if (sprite === null) {
        sprite = this.acquireSprite(r);
        buckets[z].addChild(sprite);
        obj.displaySprite = sprite;
        obj.displayZBucket = z;
      } else if (sprite.texture !== r.texture) {
        sprite.texture = r.texture;
      }

      if (!sprite.visible) sprite.visible = true;
      obj.displayTick = tick;

      if (tdirty[i] === 1 || obj.displayActive === false) {
        sprite.x = tx[i];
        sprite.y = ty[i];
        sprite.rotation = trot[i];
        sprite.scale.set(tsx[i], tsy[i]);
      }
      if (sprite.tint !== r.tint) sprite.tint = r.tint;
      if (sprite.alpha !== r.alpha) sprite.alpha = r.alpha;
      if (obj.displayZBucket !== z) {
        const newBucket = buckets[z];
        const parent = sprite.parent;
        if (parent !== null) parent.removeChild(sprite);
        newBucket.addChild(sprite);
        obj.displayZBucket = z;
      }

      if (!obj.displayActive) {
        obj.displayActive = true;
      }
      swap.push(obj);
    }

    const prev = this.activeObjs;
    for (let p = 0, pn = prev.length; p < pn; p++) {
      const obj = prev[p];
      if (obj.displayTick !== tick) {
        const sprite = obj.displaySprite;
        if (sprite !== null) {
          this.releaseSprite(sprite);
          obj.displaySprite = null;
        }
        obj.displayActive = false;
      }
    }

    this.activeObjs = swap;
    this.activeSwap = prev;

    // Now that sprites have been synced, clear dirty flags for visible slots.
    for (let k = 0; k < count; k++) tdirty[slots[k]] = 0;
  }

  removeObject(obj: GameObject): void {
    const sprite = obj.displaySprite;
    if (sprite !== null) {
      this.releaseSprite(sprite);
      obj.displaySprite = null;
    }
    obj.displayActive = false;
    obj.displayTick = 0;
  }

  private acquireSprite(r: RendererComponent): Sprite {
    const s = this.spritePool.pop();
    if (s) {
      s.texture = r.texture;
      s.anchor.set(r.anchorX, r.anchorY);
      s.tint = r.tint;
      s.alpha = r.alpha;
      s.visible = true;
      return s;
    }
    const ns = new Sprite(r.texture);
    ns.anchor.set(r.anchorX, r.anchorY);
    ns.tint = r.tint;
    ns.alpha = r.alpha;
    return ns;
  }

  private releaseSprite(s: Sprite): void {
    s.visible = false;
    const parent = s.parent;
    if (parent !== null) parent.removeChild(s);
    this.spritePool.push(s);
  }
}
