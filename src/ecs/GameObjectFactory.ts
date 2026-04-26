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
    const t = world.transform;
    const b = world.behavior;
    const r = world.render;

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

    t.tx[i] = bx + Math.random() * bw;
    t.ty[i] = by + Math.random() * bh;
    t.tw[i] = size;
    t.th[i] = size;
    t.tsx[i] = 0.8 + Math.random() * 0.4;
    t.tsy[i] = 0.8 + Math.random() * 0.4;
    t.trot[i] = Math.random() * Math.PI * 2;
    t.tvx[i] = 0;
    t.tvy[i] = 0;
    t.tvr[i] = 0;
    t.tdirty[i] = 1;

    const texIndex = (Math.random() * textures.length) | 0;
    r.texIdx[i] = texIndex;
    r.tint[i] = 0xffffff;

    const kind = BEHAVIOR_CODES[(Math.random() * BEHAVIOR_CODES.length) | 0];
    b.bkind[i] = kind;
    b.belapsed[i] = 0;
    b.bspeed[i] = 0;
    b.bamp[i] = 0;
    b.bfreq[i] = 0;
    b.brad[i] = 0;
    b.boriX[i] = 0;
    b.boriY[i] = 0;
    b.bphase[i] = 0;

    if (kind === KIND_LINEAR) {
      const speed = 20 + Math.random() * 100;
      const direction = Math.random() * Math.PI * 2;
      b.bspeed[i] = speed;
      t.tvx[i] = Math.cos(direction) * speed;
      t.tvy[i] = Math.sin(direction) * speed;
      if (speed > world.maxSpeed) world.maxSpeed = speed;
    } else if (kind === KIND_SINUSOIDAL) {
      const sp = 20 + Math.random() * 60;
      const amp = 20 + Math.random() * 60;
      b.bspeed[i] = sp;
      b.bamp[i] = amp;
      b.bfreq[i] = 0.2 + Math.random() * 1.3;
      b.bphase[i] = Math.random() * Math.PI * 2;
      // Peak speed magnitude is sqrt(sp^2 + amp^2) (vertical speed = amp*cos).
      const sinSpeed = Math.sqrt(sp * sp + amp * amp);
      if (sinSpeed > world.maxSpeed) world.maxSpeed = sinSpeed;
    } else if (kind === KIND_CIRCULAR) {
      const rad = 30 + Math.random() * 90;
      const freq = 0.1 + Math.random() * 0.7;
      b.brad[i] = rad;
      b.bfreq[i] = freq;
      b.boriX[i] = t.tx[i];
      b.boriY[i] = t.ty[i];
      b.bphase[i] = Math.random() * Math.PI * 2;
      const tangential = Math.PI * 2 * freq * rad;
      if (tangential > world.maxSpeed) world.maxSpeed = tangential;
    } else if (kind === KIND_SPIN) {
      const spinSpeed = -3 + Math.random() * 6;
      b.bspeed[i] = spinSpeed;
      t.tvr[i] = spinSpeed;
    }

    // Track largest possible diagonal half-extent (accounts for rotation).
    const halfExt = 0.5 * Math.sqrt(
      (size * t.tsx[i]) * (size * t.tsx[i]) +
      (size * t.tsy[i]) * (size * t.tsy[i]),
    );
    if (halfExt > world.maxHalfExtent) world.maxHalfExtent = halfExt;

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

    const t = world.transform;
    const b = world.behavior;

    for (let n = 0; n < count; n++) {
      const obj = this.createInto(opts);
      const i = obj.index;
      const cx = n % cols;
      const cy = (n / cols) | 0;
      t.tx[i] = baseX + (cx + Math.random()) * cellW;
      t.ty[i] = baseY + (cy + Math.random()) * cellH;
      if (b.bkind[i] === KIND_CIRCULAR) {
        b.boriX[i] = t.tx[i];
        b.boriY[i] = t.ty[i];
      }
      out[n] = obj;
    }

    return out;
  }
}
