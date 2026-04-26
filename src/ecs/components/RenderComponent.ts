import type { Particle } from 'pixi.js';
import { ComponentStore } from '../ComponentStore';

export class RenderComponent extends ComponentStore {
  public texIdx = this.u8('texIdx');
  public tint = this.u32('tint');
  public particles = this.refs<Particle>('particles');

  public onSlotAllocated(slot: number): void {
    this.particles[slot] = null;
  }
}