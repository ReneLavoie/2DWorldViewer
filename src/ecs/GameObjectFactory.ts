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
  create(opts: FactoryOptions): GameObject {
    if (!opts.textures || opts.textures.length === 0) {
      throw new Error('GameObjectFactory.create requires at least one texture');
    }

    const obj = new GameObject();

    const minSize = opts.minSize ?? 24;
    const maxSize = opts.maxSize ?? 64;
    const size = rand(minSize, maxSize);

    const t = new TransformComponent(
      rand(opts.worldBounds.x, opts.worldBounds.x + opts.worldBounds.width),
      rand(opts.worldBounds.y, opts.worldBounds.y + opts.worldBounds.height),
      size,
      size,
      rand(0.8, 1.2),
      rand(0.8, 1.2),
      rand(0, Math.PI * 2),
    );
    obj.addComponent(t);

    obj.addComponent(
      new RendererComponent({
        texture: pick(opts.textures),
        tint: Math.floor(Math.random() * 0xffffff),
        anchorX: 0.5,
        anchorY: 0.5,
        zIndex: Math.floor(rand(0, 10)),
      }),
    );

    const kind = pick(BEHAVIORS);
    const descriptor: BehaviorDescriptor = { kind };
    switch (kind) {
      case 'linear':
        descriptor.speed = rand(20, 120);
        descriptor.direction = rand(0, Math.PI * 2);
        break;
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
      case 'spin':
        descriptor.speed = rand(-3, 3);
        break;
    }
    obj.addComponent(new BehaviorComponent(descriptor));

    return obj;
  }

  createMany(count: number, opts: FactoryOptions): GameObject[] {
    const out: GameObject[] = [];
    for (let i = 0; i < count; i++) out.push(this.create(opts));
    return out;
  }
}
