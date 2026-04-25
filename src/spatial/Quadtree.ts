import type { GameObject } from '../ecs/GameObject';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class QuadtreeItem {
  id = 0;
  obj: GameObject | null = null;
  x = 0;
  y = 0;
  w = 0;
  h = 0;
  lastQueryTick = 0;
}

class QuadNode {
  x = 0;
  y = 0;
  w = 0;
  h = 0;
  depth = 0;
  items: QuadtreeItem[] = [];
  children: QuadNode[] | null = null;

  reset(x: number, y: number, w: number, h: number, depth: number): void {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.depth = depth;
    this.items.length = 0;
    this.children = null;
  }
}

export class Quadtree {
  private readonly maxItems: number;
  private readonly maxDepth: number;
  private root: QuadNode;

  private readonly nodePool: QuadNode[] = [];
  private queryTick = 0;

  constructor(bounds: Bounds, maxItems = 16, maxDepth = 8) {
    this.maxItems = maxItems;
    this.maxDepth = maxDepth;
    this.root = this.acquireNode(bounds.x, bounds.y, bounds.width, bounds.height, 0);
  }

  setBounds(bounds: Bounds): void {
    this.releaseTree(this.root);
    this.root = this.acquireNode(bounds.x, bounds.y, bounds.width, bounds.height, 0);
  }

  clear(): void {
    const oldRoot = this.root;
    const x = oldRoot.x;
    const y = oldRoot.y;
    const w = oldRoot.w;
    const h = oldRoot.h;
    this.releaseTree(oldRoot);
    this.root = this.acquireNode(x, y, w, h, 0);
  }

  insert(item: QuadtreeItem): void {
    this.insertInto(this.root, item);
  }

  query(rx: number, ry: number, rw: number, rh: number, out: QuadtreeItem[]): QuadtreeItem[] {
    out.length = 0;
    this.queryTick++;
    if (this.queryTick === 0) this.queryTick = 1; // wraparound safety
    this.queryInto(this.root, rx, ry, rw, rh, out, this.queryTick);
    return out;
  }

  private insertInto(node: QuadNode, item: QuadtreeItem): void {
    if (!aabbIntersect(node.x, node.y, node.w, node.h, item.x, item.y, item.w, item.h)) return;

    if (node.children) {
      const c = node.children;
      this.insertInto(c[0], item);
      this.insertInto(c[1], item);
      this.insertInto(c[2], item);
      this.insertInto(c[3], item);
      return;
    }

    node.items.push(item);

    if (node.items.length > this.maxItems && node.depth < this.maxDepth) {
      this.splitNode(node);
      const items = node.items;
      const c = node.children!;
      for (let i = 0, n = items.length; i < n; i++) {
        const it = items[i];
        this.insertInto(c[0], it);
        this.insertInto(c[1], it);
        this.insertInto(c[2], it);
        this.insertInto(c[3], it);
      }
      items.length = 0;
    }
  }

  private queryInto(
    node: QuadNode,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    out: QuadtreeItem[],
    tick: number,
  ): void {
    if (!aabbIntersect(node.x, node.y, node.w, node.h, rx, ry, rw, rh)) return;

    if (node.children) {
      const c = node.children;
      this.queryInto(c[0], rx, ry, rw, rh, out, tick);
      this.queryInto(c[1], rx, ry, rw, rh, out, tick);
      this.queryInto(c[2], rx, ry, rw, rh, out, tick);
      this.queryInto(c[3], rx, ry, rw, rh, out, tick);
      return;
    }

    const items = node.items;
    for (let i = 0, n = items.length; i < n; i++) {
      const it = items[i];
      if (it.lastQueryTick === tick) continue;
      if (aabbIntersect(it.x, it.y, it.w, it.h, rx, ry, rw, rh)) {
        it.lastQueryTick = tick;
        out.push(it);
      }
    }
  }

  private splitNode(node: QuadNode): void {
    const hw = node.w / 2;
    const hh = node.h / 2;
    const d = node.depth + 1;
    const x = node.x;
    const y = node.y;
    node.children = [
      this.acquireNode(x, y, hw, hh, d),
      this.acquireNode(x + hw, y, hw, hh, d),
      this.acquireNode(x, y + hh, hw, hh, d),
      this.acquireNode(x + hw, y + hh, hw, hh, d),
    ];
  }

  private acquireNode(x: number, y: number, w: number, h: number, depth: number): QuadNode {
    const n = this.nodePool.pop() ?? new QuadNode();
    n.reset(x, y, w, h, depth);
    return n;
  }

  private releaseTree(node: QuadNode): void {
    if (node.children) {
      this.releaseTree(node.children[0]);
      this.releaseTree(node.children[1]);
      this.releaseTree(node.children[2]);
      this.releaseTree(node.children[3]);
      node.children = null;
    }
    node.items.length = 0;
    this.nodePool.push(node);
  }
}

function aabbIntersect(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
