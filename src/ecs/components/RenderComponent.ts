import type { Particle } from 'pixi.js';
import { ComponentStore } from '../ComponentStore';

export class RenderComponent extends ComponentStore {
  texIdx = this.u8('texIdx');
  tint = this.u32('tint');
  particles = this.refs<Particle>('particles');

  onSlotAllocated(slot: number): void {
    this.particles[slot] = null;
  }
}
