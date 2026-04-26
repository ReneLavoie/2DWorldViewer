import { Rectangle, Texture, type TextureSource } from 'pixi.js';

interface AtlasEntry {
  alias: string;
  texture: Texture;
}

interface PackedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Gap in pixels between packed sub-textures. Prevents GPU bilinear filtering
// from bleeding neighbouring pixel rows into a sprite's edges.
const PADDING = 2;

// Returns the smallest power-of-two >= v. GPU textures must be power-of-two
// on many WebGL/WebGPU drivers when mipmaps are enabled (and it simplifies
// sizing math here).
function nextPow2(v: number): number {
  let n = 1;
  while (n < v) n <<= 1;
  return n;
}

// Stable cache key derived from each entry's alias, source UID and frame rect.
// Used to skip a rebuild when the same set of textures is requested twice.
function hashEntries(entries: AtlasEntry[]): string {
  const parts: string[] = [];
  for (const e of entries) {
    const t = e.texture;
    const src = t.source as unknown as { uid?: number | string; width?: number; height?: number };
    const f = t.frame;
    const fx = f ? f.x | 0 : 0;
    const fy = f ? f.y | 0 : 0;
    const fw = (f?.width ?? t.width) | 0;
    const fh = (f?.height ?? t.height) | 0;
    const sid = src.uid ?? `${src.width ?? 0}x${src.height ?? 0}`;
    parts.push(`${e.alias}|${sid}|${fx},${fy},${fw},${fh}`);
  }
  return parts.join(';');
}

// Builds a runtime canvas-backed texture atlas from a set of loaded Pixi
// textures, then vends Texture handles with corrected UV frames so the rest
// of the engine can use them as if they were separate textures. Keeping all
// sprites on one GPU texture lets ParticleContainer issue a single draw call.
export class AtlasRegistry {
  private atlasTexture: Texture | null = null;
  // Maps original Texture -> atlas sub-Texture (for getByOriginal).
  private subTextures = new Map<Texture, Texture>();
  // Maps alias string -> atlas sub-Texture (for getByAlias).
  private subByAlias = new Map<string, Texture>();
  private lastEntriesHash: string | null = null;

  // Pack all entries into a single canvas-backed atlas texture. Safe to call
  // multiple times; the atlas is rebuilt only when the entry set changes.
  public build(entries: AtlasEntry[]): Texture {
    if (entries.length === 0) {
      throw new Error('AtlasRegistry.build requires at least one entry');
    }

    // Early-out: same entries as last call, reuse the existing atlas.
    const entriesHash = hashEntries(entries);
    if (this.atlasTexture && this.lastEntriesHash === entriesHash) {
      return this.atlasTexture;
    }

    // Destroy the old atlas and sub-textures before replacing them.
    if (this.atlasTexture) {
      for (const sub of this.subByAlias.values()) sub.destroy(false);
      this.atlasTexture.destroy(true);
      this.atlasTexture = null;
    }
    this.subTextures.clear();
    this.subByAlias.clear();

    // Sort tallest-first so the shelf packer wastes as little vertical
    // space as possible on the first row.
    const sorted = entries.slice().sort((a, b) => {
      const ah = (a.texture.frame?.height ?? a.texture.height) | 0;
      const bh = (b.texture.frame?.height ?? b.texture.height) | 0;
      return bh - ah;
    });

    const widths = sorted.map((e) => (e.texture.frame?.width ?? e.texture.width) | 0);
    const heights = sorted.map((e) => (e.texture.frame?.height ?? e.texture.height) | 0);
    const totalArea = widths.reduce((s, w, i) => s + (w + PADDING * 2) * (heights[i] + PADDING * 2), 0);

    // Start with a square atlas big enough for the widest single entry, then
    // grow (always the smaller axis first) until the area is sufficient.
    let atlasW = nextPow2(Math.max(...widths) + PADDING * 2);
    let atlasH = atlasW;
    while (atlasW * atlasH < totalArea) {
      if (atlasW <= atlasH) atlasW <<= 1;
      else atlasH <<= 1;
    }

    // Shelf packer: advance a cursor left-to-right, wrapping to a new row
    // (shelf) when the next entry would overflow the right edge.
    const rects: PackedRect[] = [];
    let cursorX = PADDING;
    let cursorY = PADDING;
    let rowH = 0;
    for (let i = 0; i < sorted.length; i++) {
      const w = widths[i];
      const h = heights[i];
      if (cursorX + w + PADDING > atlasW) {
        cursorX = PADDING;
        cursorY += rowH + PADDING * 2;
        rowH = 0;
      }
      // Grow the atlas height if the current shelf overflows vertically.
      while (cursorY + h + PADDING > atlasH) {
        atlasH <<= 1;
      }
      rects.push({ x: cursorX, y: cursorY, w, h });
      cursorX += w + PADDING * 2;
      if (h > rowH) rowH = h;
    }

    // Render all source images onto a single 2-D canvas.
    const canvas = document.createElement('canvas');
    canvas.width = atlasW;
    canvas.height = atlasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('AtlasRegistry: failed to acquire 2D context');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, atlasW, atlasH);

    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      const r = rects[i];
      const src = e.texture.source as unknown as { resource?: CanvasImageSource };
      const resource = src.resource;
      if (!resource) {
        throw new Error(`AtlasRegistry: texture '${e.alias}' has no drawable resource (not loaded yet?)`);
      }
      // Handle frame-cropped textures (e.g. individual sprites inside a sheet).
      const frame = e.texture.frame;
      if (frame) {
        ctx.drawImage(
          resource,
          frame.x, frame.y, frame.width, frame.height,
          r.x, r.y, r.w, r.h,
        );
      } else {
        ctx.drawImage(resource, r.x, r.y, r.w, r.h);
      }
    }

    // Upload to Pixi's texture cache.
    const atlasTex = Texture.from(canvas);
    atlasTex.source.scaleMode = 'linear';
    this.atlasTexture = atlasTex;
    const atlasSource: TextureSource = atlasTex.source;

    // Create sub-Textures with frame rects pointing into the atlas canvas.
    // These are what callers hand to Particle/Sprite.
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      const r = rects[i];
      const sub = new Texture({
        source: atlasSource,
        frame: new Rectangle(r.x, r.y, r.w, r.h),
      });
      this.subTextures.set(e.texture, sub);
      this.subByAlias.set(e.alias, sub);
    }

    this.lastEntriesHash = entriesHash;
    return atlasTex;
  }

  public getAtlasTexture(): Texture {
    if (!this.atlasTexture) throw new Error('AtlasRegistry.build() must be called first');
    return this.atlasTexture;
  }

  // Returns the atlas sub-Texture that corresponds to `original`.
  public getByOriginal(original: Texture): Texture | undefined {
    return this.subTextures.get(original);
  }

  // Returns the atlas sub-Texture for a given alias string.
  public getByAlias(alias: string): Texture | undefined {
    return this.subByAlias.get(alias);
  }

  // Resolves an array of originals to their atlas sub-Textures in one call.
  // Throws if any texture was not included in the last build().
  public resolveAll(originals: Texture[]): Texture[] {
    return originals.map((t) => {
      const sub = this.subTextures.get(t);
      if (!sub) throw new Error('AtlasRegistry.resolveAll: texture not in atlas');
      return sub;
    });
  }
}
