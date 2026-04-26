import { inject, injectable } from 'inversify';
import { Container, Particle, ParticleContainer, Texture } from 'pixi.js';
import { TYPES } from '../di/types';
import { World } from '../ecs/World';

// Renders the active subset of entities through a single ParticleContainer
// backed by a runtime-built atlas texture, so the entire world is one batched
// draw call. Entity transforms are pushed into Particle instances each frame;
// Particles are pooled per-texture and stale ones are reclaimed periodically
// to keep memory bounded as the camera moves around.
@injectable()
export class RenderingSystem {
  private stage: Container | null = null;
  // Outer layer carrying the camera transform; the ParticleContainer is its child.
  private layer = new Container();

  // The actual GPU batch. Recreated when the atlas texture changes.
  private container: ParticleContainer | null = null;
  // Direct handle on the ParticleContainer's child array; we resize it in place
  // each frame to avoid Pixi's add/removeChild overhead.
  private childrenArr: Particle[] = [];
  private atlasTexture: Texture | null = null;

  // Slot-textures table parallel to world.render.texIdx.
  private textures: Texture[] = [];

  // Frame counter + per-slot last-rendered frame for stale-particle sweeping.
  private frame = 0;
  private lastSeen: Uint32Array = new Uint32Array(0);

  // Sweep configuration (in frames; assumes ~60fps).
  private lastSweepFrame = 0;
  private readonly sweepIntervalFrames = 300; // ~5s
  private readonly staleThresholdFrames = 600; // ~10s

  // Per-texture-index pool of reusable Particle instances. Keyed by texIdx so
  // we never have to swap a Particle's texture (which Pixi treats as a batch
  // break in some configurations).
  private pool: Particle[][] = [];
  private readonly maxPoolPerTex = 256;

  public constructor(
    @inject(TYPES.World) private readonly world: World,
  ) {
    // Disable Pixi's per-child sorting and culling: we manage iteration order
    // and culling ourselves via CameraSystem's active-id selection.
    this.layer.sortableChildren = false;
    this.layer.cullable = false;
    this.layer.cullableChildren = false;
  }

  public attach(stage: Container): void {
    this.stage = stage;
    if (!this.layer.parent) stage.addChild(this.layer);
  }

  public setTextures(textures: Texture[]): void {
    this.textures = textures;
  }

  // Replaces the atlas texture; rebuilds the ParticleContainer because Pixi
  // binds the texture at construction time. Pool entries reference the old
  // atlas so they're discarded too.
  public setAtlasTexture(tex: Texture): void {
    if (this.atlasTexture === tex && this.container !== null) return;
    this.atlasTexture = tex;
    if (this.container) {
      this.layer.removeChild(this.container as unknown as Container);
      this.container.destroy();
    }
    const c = new ParticleContainer({
      texture: tex,
      // Only position+rotation change per frame; uvs/color/vertex are static
      // so Pixi can skip uploading them. This is the main throughput knob.
      dynamicProperties: {
        position: true,
        rotation: true,
        uvs: false,
        color: false,
        vertex: false,
      },
    });
    c.cullable = false;
    c.cullableChildren = false;
    this.container = c;
    this.childrenArr = c.particleChildren as Particle[];
    this.layer.addChild(c as unknown as Container);
    // Atlas changed: existing pooled particles reference stale textures.
    this.pool.length = 0;
  }

  // World->screen transform applied via the layer (inverse of camera).
  public setCameraTransform(x: number, y: number, zoom = 1): void {
    this.layer.position.set(-x * zoom, -y * zoom);
    this.layer.scale.set(zoom);
  }

  // `slots` holds `count` slot indices into the World's component arrays.
  // Renders exactly those slots in order, allocating Particles on demand
  // from per-texture pools and stamping each slot's last-seen frame for
  // periodic stale sweeping.
  public renderSlots(slots: Int32Array, count: number): void {
    if (!this.stage || !this.container) return;

    const world = this.world;
    const t = world.transform;
    const r = world.render;
    const tx = t.tx;
    const ty = t.ty;
    const trot = t.trot;
    const tsx = t.tsx;
    const tsy = t.tsy;
    const tdirty = t.tdirty;
    const texIdx = r.texIdx;
    const tints = r.tint;
    const particles = r.particles;
    const textures = this.textures;

    const frame = ++this.frame;
    const worldSize = world.size;
    // Grow the lastSeen buffer geometrically as the world expands.
    if (this.lastSeen.length < worldSize) {
      const grown = new Uint32Array(Math.max(worldSize, (this.lastSeen.length || 1024) * 2));
      grown.set(this.lastSeen);
      this.lastSeen = grown;
    }
    const lastSeen = this.lastSeen;
    const pool = this.pool;

    const children = this.childrenArr;
    if (children.length < count) children.length = count;

    let n = 0;
    for (let k = 0; k < count; k++) {
      const i = slots[k];
      let p = particles[i];
      if (p === null) {
        // Slot has no live Particle: reuse one from the pool or allocate.
        const ti = texIdx[i];
        const tex = textures[ti];
        if (tex === undefined) continue;
        const bucket = pool[ti];
        if (bucket !== undefined && bucket.length > 0) {
          p = bucket.pop()!;
          p.tint = tints[i];
          p.alpha = 1;
        } else {
          p = new Particle({
            texture: tex,
            anchorX: 0.5,
            anchorY: 0.5,
            tint: tints[i],
            alpha: 1,
          });
        }
        particles[i] = p;
      }

      // Push the latest transform into the Particle.
      p.x = tx[i];
      p.y = ty[i];
      p.rotation = trot[i];
      p.scaleX = tsx[i];
      p.scaleY = tsy[i];

      children[n++] = p;
      lastSeen[i] = frame;
      tdirty[i] = 0;
    }
    // Truncate any leftover children slots from a higher-count previous frame.
    if (children.length !== n) children.length = n;

    if (frame - this.lastSweepFrame >= this.sweepIntervalFrames) {
      this.lastSweepFrame = frame;
      this.sweepStale(worldSize, frame);
    }

    // Tells the ParticleContainer to upload the dirty position/rotation buffers.
    this.container.update();
  }

  // Reclaim Particle instances for slots that haven't been rendered recently.
  // Keeps a bounded per-texture pool so a long zoom-out doesn't accumulate
  // unbounded GC pressure when the camera comes back.
  private sweepStale(size: number, frame: number): void {
    const threshold = this.staleThresholdFrames;
    if (frame <= threshold) return;
    const staleBefore = frame - threshold;
    const particles = this.world.render.particles;
    const texIdx = this.world.render.texIdx;
    const lastSeen = this.lastSeen;
    const pool = this.pool;
    const maxPool = this.maxPoolPerTex;
    for (let i = 0; i < size; i++) {
      const p = particles[i];
      if (p === null) continue;
      if (lastSeen[i] < staleBefore) {
        const ti = texIdx[i];
        let bucket = pool[ti];
        if (bucket === undefined) {
          bucket = [];
          pool[ti] = bucket;
        }
        if (bucket.length < maxPool) bucket.push(p);
        particles[i] = null;
      }
    }
  }
}
