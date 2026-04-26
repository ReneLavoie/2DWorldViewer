import type { Particle } from 'pixi.js';
import { ComponentStore } from '../ComponentStore';

// Per-entity rendering data. `particles` holds the Pixi Particle instance
// currently used to draw the entity (or null if not currently rendered, e.g.
// after being culled and reclaimed by RenderingSystem's stale-particle sweep).
export class RenderComponent extends ComponentStore {
  public texIdx = this.u8('texIdx');                  // index into RenderingSystem.textures
  public tint = this.u32('tint');                     // 0xRRGGBB tint
  public particles = this.refs<Particle>('particles');

  // New slots start without an associated Particle; one is allocated lazily
  // by RenderingSystem the first time the entity is actually drawn.
  public onSlotAllocated(slot: number): void {
    this.particles[slot] = null;
  }
}
