import type { Component } from './Component';
import { TransformType, type TransformComponent } from './components/TransformComponent';
import { RendererType, type RendererComponent } from './components/RendererComponent';
import { BehaviorType, type BehaviorComponent } from './components/BehaviorComponent';
import type { QuadtreeItem } from '../spatial/Quadtree';
import type { Sprite } from 'pixi.js';

let nextId = 1;

export class GameObject {
  public id: number;
  private readonly components = new Map<string, Component>();

  transform: TransformComponent | null = null;
  renderer: RendererComponent | null = null;
  behavior: BehaviorComponent | null = null;

  // Cached spatial index entry (reused across frames; avoid per-frame alloc).
  spatial: QuadtreeItem | null = null;

  // Display slot owned by RenderingSystem. Avoids a per-object Map lookup and
  // allocating a DisplayEntry record when the object becomes visible.
  displaySprite: Sprite | null = null;
  displayTick = 0;
  displayZBucket = 0;
  // True while the object is currently a member of RenderingSystem.activeObjs.
  displayActive = false;

  // Pool flag — true when sitting in the GameObjectPool (not part of the world).
  pooled = false;

  constructor(id?: number) {
    this.id = id ?? nextId++;
  }

  addComponent<T extends Component>(component: T): T {
    this.components.set(component.type, component);
    switch (component.type) {
      case TransformType:
        this.transform = component as unknown as TransformComponent;
        break;
      case RendererType:
        this.renderer = component as unknown as RendererComponent;
        break;
      case BehaviorType:
        this.behavior = component as unknown as BehaviorComponent;
        break;
    }
    return component;
  }

  removeComponent(type: string): void {
    this.components.delete(type);
    switch (type) {
      case TransformType:
        this.transform = null;
        break;
      case RendererType:
        this.renderer = null;
        break;
      case BehaviorType:
        this.behavior = null;
        break;
    }
  }

  getComponent<T extends Component>(type: string): T | undefined {
    return this.components.get(type) as T | undefined;
  }

  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  getComponents(): Component[] {
    return Array.from(this.components.values());
  }

  reset(): void {
    this.components.clear();
    this.transform = null;
    this.renderer = null;
    this.behavior = null;
    if (this.spatial) {
      this.spatial.obj = null;
      this.spatial = null;
    }
    this.displaySprite = null;
    this.displayTick = 0;
    this.displayZBucket = 0;
    this.displayActive = false;
  }

  static nextId(): number {
    return nextId++;
  }
}