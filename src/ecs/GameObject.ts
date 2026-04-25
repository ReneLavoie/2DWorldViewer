import { RendererType, type RendererComponent } from './components/RendererComponent';
import type { Sprite } from 'pixi.js';

let nextId = 1;

export class GameObject {
  public id: number;
  public index: number = -1;

  renderer: RendererComponent | null = null;

  displaySprite: Sprite | null = null;
  displayTick = 0;
  displayZBucket = 0;
  displayActive = false;

  pooled = false;

  constructor(id?: number) {
    this.id = id ?? nextId++;
  }

  setRenderer(r: RendererComponent): void {
    this.renderer = r;
  }

  clearRenderer(): void {
    this.renderer = null;
  }

  hasComponent(type: string): boolean {
    return type === RendererType && this.renderer !== null;
  }

  reset(): void {
    this.renderer = null;
    this.displaySprite = null;
    this.displayTick = 0;
    this.displayZBucket = 0;
    this.displayActive = false;
    this.index = -1;
  }

  static nextId(): number {
    return nextId++;
  }
}
