import { injectable } from 'inversify';
import { Texture } from 'pixi.js';
import { GameObject } from './GameObject';
import { TransformComponent } from './components/TransformComponent';
import { RendererComponent } from './components/RendererComponent';
import {
  BehaviorComponent,
  BehaviorDescriptor,
  BehaviorKind,
} from './components/BehaviorComponent';
import { Bounds } from '../spatial/Quadtree';

export interface FactoryOptions {
  textures: Texture[];
  worldBounds: Bounds;
  minSize?: number;
  maxSize?: number;
}

const BEHAVIORS: BehaviorKind[] = [
  'linear',
  'sinusoidal',
  'circular',
  'spin',
];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

@injectable()
export class GameObjectFactory {
  private readonly objectPool: GameObject[] = [];
  private readonly transformPool: TransformComponent[] = [];
  private readonly rendererPool: RendererComponent[] = [];
  private readonly behaviorPool: BehaviorComponent[] = [];

  create(opts: FactoryOptions): GameObject {
    if (!opts.textures || opts.textures.length === 0) {
      throw new Error('GameObjectFactory.create requires at least one texture');
    }

    const obj = this.acquireObject();

    const minSize = opts.minSize ?? 24;
    const maxSize = opts.maxSize ?? 64;
    const size = rand(minSize, maxSize);

    const t = this.acquireTransform();
    t.x = rand(opts.worldBounds.x, opts.worldBounds.x + opts.worldBounds.width);
    t.y = rand(opts.worldBounds.y, opts.worldBounds.y + opts.worldBounds.height);
    t.width = size;
    t.height = size;
    t.scaleX = rand(0.8, 1.2);
    t.scaleY = rand(0.8, 1.2);
    t.rotation = rand(0, Math.PI * 2);
    t.vx = 0;
    t.vy = 0;
    t.vr = 0;
    t.dirty = true;
    obj.addComponent(t);

    const r = this.acquireRenderer();
    r.texture = pick(opts.textures);
    r.tint = Math.floor(Math.random() * 0xffffff);
    r.alpha = 1;
    r.anchorX = 0.5;
    r.anchorY = 0.5;
    r.zIndex = Math.floor(rand(0, 10));
    obj.addComponent(r);

    const kind = pick(BEHAVIORS);
    const b = this.acquireBehavior();
    const descriptor: BehaviorDescriptor = b.descriptor;
    descriptor.kind = kind;
    descriptor.speed = undefined;
    descriptor.amplitude = undefined;
    descriptor.frequency = undefined;
    descriptor.radius = undefined;
    descriptor.originX = undefined;
    descriptor.originY = undefined;
    descriptor.phase = undefined;
    descriptor.direction = undefined;
    b.elapsed = 0;

    switch (kind) {
      case 'linear': {
        const speed = rand(20, 120);
        const direction = rand(0, Math.PI * 2);
        descriptor.speed = speed;
        descriptor.direction = direction;
        t.vx = Math.cos(direction) * speed;
        t.vy = Math.sin(direction) * speed;
        break;
      }
      case 'sinusoidal':
        descriptor.speed = rand(20, 80);
        descriptor.amplitude = rand(20, 80);
        descriptor.frequency = rand(0.2, 1.5);
        descriptor.phase = rand(0, Math.PI * 2);
        break;
      case 'circular':
        descriptor.radius = rand(30, 120);
        descriptor.frequency = rand(0.1, 0.8);
        descriptor.originX = t.x;
        descriptor.originY = t.y;
        descriptor.phase = rand(0, Math.PI * 2);
        break;
      case 'spin': {
        const spinSpeed = rand(-3, 3);
        descriptor.speed = spinSpeed;
        t.vr = spinSpeed;
        break;
      }
    }
    obj.addComponent(b);

    return obj;
  }

  createMany(count: number, opts: FactoryOptions): GameObject[] {
    const out: GameObject[] = new Array(count);
    // Stratified (jittered-grid) placement: guarantees even coverage of the
    // entire world, eliminating the clumpy/empty regions that arise with
    // pure uniform-random sampling at low density.
    const cols = Math.max(1, Math.ceil(Math.sqrt(count * (opts.worldBounds.width / opts.worldBounds.height))));
    const rows = Math.max(1, Math.ceil(count / cols));
    const cellW = opts.worldBounds.width / cols;
    const cellH = opts.worldBounds.height / rows;
    const baseX = opts.worldBounds.x;
    const baseY = opts.worldBounds.y;

    for (let i = 0; i < count; i++) {
      const obj = this.create(opts);
      const cx = i % cols;
      const cy = (i / cols) | 0;
      const t = obj.transform!;
      t.x = baseX + (cx + Math.random()) * cellW;
      t.y = baseY + (cy + Math.random()) * cellH;
      // Re-anchor circular behaviors to their new (post-stratified) position.
      const b = obj.behavior;
      if (b && b.descriptor.kind === 'circular') {
        b.descriptor.originX = t.x;
        b.descriptor.originY = t.y;
      }
      out[i] = obj;
    }
    return out;
  }

  release(obj: GameObject): void {
    if (obj.transform) this.transformPool.push(obj.transform);
    if (obj.renderer) this.rendererPool.push(obj.renderer);
    if (obj.behavior) this.behaviorPool.push(obj.behavior);
    obj.reset();
    obj.id = GameObject.nextId();
    this.objectPool.push(obj);
  }

  private acquireObject(): GameObject {
    return this.objectPool.pop() ?? new GameObject();
  }

  private acquireTransform(): TransformComponent {
    return this.transformPool.pop() ?? new TransformComponent();
  }

  private acquireRenderer(): RendererComponent {
    return this.rendererPool.pop() ?? new RendererComponent({ texture: Texture.WHITE });
  }

  private acquireBehavior(): BehaviorComponent {
    return this.behaviorPool.pop() ?? new BehaviorComponent({ kind: 'idle' });
  }
}
