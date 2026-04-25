import type { Component } from './Component';

let nextId = 1;

export class GameObject {
  public readonly id: number;
  private readonly components = new Map<string, Component>();

  constructor(id?: number) {
    this.id = id ?? nextId++;
  }

  addComponent<T extends Component>(component: T): T {
    this.components.set(component.type, component);
    return component;
  }

  removeComponent(type: string): void {
    this.components.delete(type);
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
}
