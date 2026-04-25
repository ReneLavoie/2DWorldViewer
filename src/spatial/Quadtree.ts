export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QuadtreeItem {
  id: number;
  bounds: Bounds;
}

export class Quadtree {
  private readonly maxItems: number;
  private readonly maxDepth: number;
  private readonly depth: number;
  private readonly bounds: Bounds;

  private items: QuadtreeItem[] = [];
  private nodes: Quadtree[] | null = null;

  constructor(bounds: Bounds, maxItems = 8, maxDepth = 6, depth = 0) {
    this.bounds = bounds;
    this.maxItems = maxItems;
    this.maxDepth = maxDepth;
    this.depth = depth;
  }

  clear(): void {
    this.items.length = 0;
    this.nodes = null;
  }

  insert(item: QuadtreeItem): void {
    if (!this.intersects(this.bounds, item.bounds)) return;

    if (this.nodes) {
      for (const n of this.nodes) n.insert(item);
      return;
    }

    this.items.push(item);

    if (this.items.length > this.maxItems && this.depth < this.maxDepth) {
      this.split();
      const items = this.items;
      this.items = [];
      for (const it of items) {
        for (const n of this.nodes!) n.insert(it);
      }
    }
  }

  query(range: Bounds, out: QuadtreeItem[] = []): QuadtreeItem[] {
    const seen = new Set<number>();
    this.queryInto(range, out, seen);
    return out;
  }

  private queryInto(range: Bounds, out: QuadtreeItem[], seen: Set<number>): void {
    if (!this.intersects(this.bounds, range)) return;

    if (this.nodes) {
      for (const n of this.nodes) n.queryInto(range, out, seen);
      return;
    }

    for (const it of this.items) {
      if (seen.has(it.id)) continue;
      if (this.intersects(it.bounds, range)) {
        seen.add(it.id);
        out.push(it);
      }
    }
  }

  private split(): void {
    const { x, y, width, height } = this.bounds;
    const hw = width / 2;
    const hh = height / 2;
    const d = this.depth + 1;
    this.nodes = [
      new Quadtree({ x, y, width: hw, height: hh }, this.maxItems, this.maxDepth, d),
      new Quadtree({ x: x + hw, y, width: hw, height: hh }, this.maxItems, this.maxDepth, d),
      new Quadtree({ x, y: y + hh, width: hw, height: hh }, this.maxItems, this.maxDepth, d),
      new Quadtree({ x: x + hw, y: y + hh, width: hw, height: hh }, this.maxItems, this.maxDepth, d),
    ];
  }

  private intersects(a: Bounds, b: Bounds): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }
}
