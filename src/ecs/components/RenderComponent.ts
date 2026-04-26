import type { Particle } from 'pixi.js';
import { ComponentStore, growU8, growU32, growRefs } from '../ComponentStore';

export class RenderComponent extends ComponentStore {
  texIdx!: Uint8Array;
  tint!: Uint32Array;
  particles!: (Particle | null)[];

  protected grow(next: number): void {
    this.texIdx = growU8(this.texIdx, next);
    this.tint = growU32(this.tint, next);
    this.particles = growRefs(this.particles, next);
  }

  onSlotAllocated(slot: number): void {
    this.particles[slot] = null;
  }
}
