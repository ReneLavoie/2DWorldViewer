import { inject, injectable } from 'inversify';
import { Texture } from 'pixi.js';
import { TYPES } from '../di/types';
import { GameObject } from './GameObject';
import { Bounds } from '../spatial/Bounds';
import {
  World,
  KIND_LINEAR,
  KIND_SINUSOIDAL,
  KIND_CIRCULAR,
  KIND_SPIN,
} from './World';

export interface FactoryOptions {
  textures: Texture[];
  worldBounds: Bounds;
  minSize?: number;
  maxSize?: number;
}

const BEHAVIOR_CODES = [KIND_LINEAR, KIND_SINUSOIDAL, KIND_CIRCULAR, KIND_SPIN];

@injectable()
export class GameObjectFactory {
  constructor(
    @inject(TYPES.World) private readonly world: World,
  ) {}

  private createInto(opts: FactoryOptions): GameObject {
    const textures = opts.textures;
    if (!textures || textures.length === 0) {
      throw new Error('GameObjectFactory.create requires at least one texture');
    }
    const world = this.world;

    const obj = new GameObject();
    world.allocateSlot(obj);
    const i = obj.index;

    const minSize = opts.minSize ?? 24;
    const maxSize = opts.maxSize ?? 64;
    const size = minSize + Math.random() * (maxSize - minSize);
    const bx = opts.worldBounds.x;
    const by = opts.worldBounds.y;
    const bw = opts.worldBounds.width;
    const bh = opts.worldBounds.height;

    world.tx[i] = bx + Math.random() * bw;
    world.ty[i] = by + Math.random() * bh;
    world.tw[i] = size;
    world.th[i] = size;
    world.tsx[i] = 0.8 + Math.random() * 0.4;
    world.tsy[i] = 0.8 + Math.random() * 0.4;
    world.trot[i] = Math.random() * Math.PI * 2;
    world.tvx[i] = 0;
    world.tvy[i] = 0;
    world.tvr[i] = 0;
    world.tdirty[i] = 1;

    const texIndex = (Math.random() * textures.length) | 0;
    world.texIdx[i] = texIndex;
    world.tint[i] = 0xffffff;

    const kind = BEHAVIOR_CODES[(Math.random() * BEHAVIOR_CODES.length) | 0];
    world.bkind[i] = kind;
    world.belapsed[i] = 0;
    world.bspeed[i] = 0;
    world.bamp[i] = 0;
    world.bfreq[i] = 0;
    world.brad[i] = 0;
    world.boriX[i] = 0;
    world.boriY[i] = 0;
    world.bphase[i] = 0;

    if (kind === KIND_LINEAR) {
      const speed = 20 + Math.random() * 100;
      const direction = Math.random() * Math.PI * 2;
      world.bspeed[i] = speed;
      world.tvx[i] = Math.cos(direction) * speed;
      world.tvy[i] = Math.sin(direction) * speed;
    } else if (kind === KIND_SINUSOIDAL) {
      world.bspeed[i] = 20 + Math.random() * 60;
      world.bamp[i] = 20 + Math.random() * 60;
      world.bfreq[i] = 0.2 + Math.random() * 1.3;
      world.bphase[i] = Math.random() * Math.PI * 2;
    } else if (kind === KIND_CIRCULAR) {
      world.brad[i] = 30 + Math.random() * 90;
      world.bfreq[i] = 0.1 + Math.random() * 0.7;
      world.boriX[i] = world.tx[i];
      world.boriY[i] = world.ty[i];
      world.bphase[i] = Math.random() * Math.PI * 2;
    } else if (kind === KIND_SPIN) {
      const spinSpeed = -3 + Math.random() * 6;
      world.bspeed[i] = spinSpeed;
      world.tvr[i] = spinSpeed;
    }

    return obj;
  }

  create(opts: FactoryOptions): GameObject {
    return this.createInto(opts);
  }

  createMany(count: number, opts: FactoryOptions): GameObject[] {
    const world = this.world;
    world.reserve(world.size + count);
    const out: GameObject[] = new Array(count);

    const bw = opts.worldBounds.width;
    const bh = opts.worldBounds.height;
    const cols = Math.max(1, Math.ceil(Math.sqrt(count * (bw / bh))));
    const cellW = bw / cols;
    const cellH = bh / Math.max(1, Math.ceil(count / cols));
    const baseX = opts.worldBounds.x;
    const baseY = opts.worldBounds.y;

    for (let n = 0; n < count; n++) {
      const obj = this.createInto(opts);
      const i = obj.index;
      const cx = n % cols;
      const cy = (n / cols) | 0;
      world.tx[i] = baseX + (cx + Math.random()) * cellW;
      world.ty[i] = baseY + (cy + Math.random()) * cellH;
      if (world.bkind[i] === KIND_CIRCULAR) {
        world.boriX[i] = world.tx[i];
        world.boriY[i] = world.ty[i];
      }
      out[n] = obj;
    }

    return out;
  }
}
