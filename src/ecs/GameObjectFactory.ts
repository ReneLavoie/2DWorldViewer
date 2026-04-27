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

// Configuration for spawning entities.
export interface FactoryOptions {
  textures: Texture[];     // sprite atlas slice(s) randomly assigned per entity
  worldBounds: Bounds;     // rectangle within which entities are spawned
  minSize?: number;        // min unscaled sprite size (default 24)
  maxSize?: number;        // max unscaled sprite size (default 64)
}

// Behavior kinds eligible for random selection on spawn.
const BEHAVIOR_CODES = [KIND_LINEAR, KIND_SINUSOIDAL, KIND_CIRCULAR, KIND_SPIN];

// Spawns randomized GameObjects into the World's SoA stores. Centralised here
// so component initialisation (and the world.maxSpeed/maxHalfExtent tracking
// the camera relies on) happens in one place.
@injectable()
export class GameObjectFactory {
  public constructor(
    @inject(TYPES.World) private readonly world: World,
  ) {}

  // Creates a single entity, allocating a slot and populating every component.
  // Returns the GameObject handle bound to the freshly-allocated slot.
  private createInto(opts: FactoryOptions): GameObject {
    const textures = opts.textures;
    if (!textures || textures.length === 0) {
      throw new Error('GameObjectFactory.create requires at least one texture');
    }
    const world = this.world;
    const t = world.transform;
    const b = world.behavior;
    const r = world.render;

    const obj = new GameObject(world.nextId());
    world.allocateSlot(obj);
    const i = obj.index;

    // Random uniform size and position within world bounds.
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

    // Random texture and default white tint.
    const texIndex = (Math.random() * textures.length) | 0;
    r.texIdx[i] = texIndex;
    r.tint[i] = 0xffffff;

    // Pick and initialise behavior. Each kind only sets the parameters it
    // actually uses; unused fields are left at zero (cleared above).
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
      // Constant velocity in a random direction.
      const speed = 20 + Math.random() * 100;
      const direction = Math.random() * Math.PI * 2;
      b.bspeed[i] = speed;
      t.tvx[i] = Math.cos(direction) * speed;
      t.tvy[i] = Math.sin(direction) * speed;
      if (speed > world.maxSpeed) world.maxSpeed = speed;
    } 
    
    if (kind === KIND_SINUSOIDAL) {
      // Linear x drift plus sine-wave y oscillation. Velocities are zeroed
      // because the BehaviorSystem writes the position directly each frame.
      const sp = 20 + Math.random() * 60;
      const amp = 20 + Math.random() * 60;
      b.bspeed[i] = sp;
      b.bamp[i] = amp;
      b.bfreq[i] = 0.2 + Math.random() * 1.3;
      b.bphase[i] = Math.random() * Math.PI * 2;
      // Peak speed magnitude is sqrt(sp^2 + amp^2) (vertical speed = amp*cos).
      const sinSpeed = Math.sqrt(sp * sp + amp * amp);
      if (sinSpeed > world.maxSpeed) world.maxSpeed = sinSpeed;
    } 
    
    if (kind === KIND_CIRCULAR) {
      // Orbits a fixed origin (the spawn position) at constant angular freq.
      const rad = 30 + Math.random() * 90;
      const freq = 0.1 + Math.random() * 0.7;
      b.brad[i] = rad;
      b.bfreq[i] = freq;
      b.boriX[i] = t.tx[i];
      b.boriY[i] = t.ty[i];
      b.bphase[i] = Math.random() * Math.PI * 2;
      // Tangential speed = 2*pi*r*f, used to bound camera frustum padding.
      const tangential = Math.PI * 2 * freq * rad;
      if (tangential > world.maxSpeed) world.maxSpeed = tangential;
    }
    
    if (kind === KIND_SPIN) {
      // Pure rotation in place; spinSpeed may be negative for reverse spin.
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

  public create(opts: FactoryOptions): GameObject {
    return this.createInto(opts);
  }

  // Bulk spawn. Reserves capacity up front, then overwrites the random
  // position chosen by createInto with a jittered grid position so entities
  // are spread evenly across world bounds (random sampling alone leaves
  // visible clumping at the millions-of-entities scale).
  public createMany(count: number, opts: FactoryOptions): GameObject[] {
    const world = this.world;
    world.reserve(world.size + count);
    const out: GameObject[] = new Array(count);

    // Choose grid dimensions so cells are roughly the same aspect ratio as
    // the world bounds, then size each cell accordingly.
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
      // Place into the n-th cell with a random sub-cell jitter.
      const cx = n % cols;
      const cy = (n / cols) | 0;
      t.tx[i] = baseX + (cx + Math.random()) * cellW;
      t.ty[i] = baseY + (cy + Math.random()) * cellH;
      // Circular orbits anchor on spawn position, so refresh the origin
      // after we relocated the entity.
      if (b.bkind[i] === KIND_CIRCULAR) {
        b.boriX[i] = t.tx[i];
        b.boriY[i] = t.ty[i];
      }
      out[n] = obj;
    }

    return out;
  }
}
