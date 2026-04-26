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

const PADDING = 2;

function nextPow2(v: number): number {
  let n = 1;
  while (n < v) n <<= 1;
  return n;
}

export class AtlasRegistry {
  private atlasTexture: Texture | null = null;
  private subTextures = new Map<Texture, Texture>();
  private subByAlias = new Map<string, Texture>();

  build(entries: AtlasEntry[]): Texture {
    if (entries.length === 0) {
      throw new Error('AtlasRegistry.build requires at least one entry');
    }

    const sorted = entries.slice().sort((a, b) => {
      const ah = (a.texture.frame?.height ?? a.texture.height) | 0;
      const bh = (b.texture.frame?.height ?? b.texture.height) | 0;
      return bh - ah;
    });

    const widths = sorted.map((e) => (e.texture.frame?.width ?? e.texture.width) | 0);
    const heights = sorted.map((e) => (e.texture.frame?.height ?? e.texture.height) | 0);
    const totalArea = widths.reduce((s, w, i) => s + (w + PADDING * 2) * (heights[i] + PADDING * 2), 0);

    let atlasW = nextPow2(Math.max(...widths) + PADDING * 2);
    let atlasH = atlasW;
    while (atlasW * atlasH < totalArea) {
      if (atlasW <= atlasH) atlasW <<= 1;
      else atlasH <<= 1;
    }

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
      while (cursorY + h + PADDING > atlasH) {
        atlasH <<= 1;
      }
      rects.push({ x: cursorX, y: cursorY, w, h });
      cursorX += w + PADDING * 2;
      if (h > rowH) rowH = h;
    }

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

    const atlasTex = Texture.from(canvas);
    atlasTex.source.scaleMode = 'linear';
    this.atlasTexture = atlasTex;
    const atlasSource: TextureSource = atlasTex.source;

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

    return atlasTex;
  }

  getAtlasTexture(): Texture {
    if (!this.atlasTexture) throw new Error('AtlasRegistry.build() must be called first');
    return this.atlasTexture;
  }

  getByOriginal(original: Texture): Texture | undefined {
    return this.subTextures.get(original);
  }

  getByAlias(alias: string): Texture | undefined {
    return this.subByAlias.get(alias);
  }

  resolveAll(originals: Texture[]): Texture[] {
    return originals.map((t) => {
      const sub = this.subTextures.get(t);
      if (!sub) throw new Error('AtlasRegistry.resolveAll: texture not in atlas');
      return sub;
    });
  }
}
