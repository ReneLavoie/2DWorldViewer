import { ComponentStore } from '../ComponentStore';

// Behavior kind codes. Stored as bytes per slot so the BehaviorSystem can
// switch on them in a tight loop without virtual dispatch.
export const KIND_LINEAR = 1;     // constant-velocity drift
export const KIND_SINUSOIDAL = 2; // linear x + sinusoidal y oscillation
export const KIND_CIRCULAR = 3;   // orbits a fixed origin point
export const KIND_SPIN = 4;       // rotation only, no translation

// Per-entity behavior parameters. Which fields are meaningful depends on
// `bkind` (see GameObjectFactory for assignment and BehaviorSystem for use).
export class BehaviorComponent extends ComponentStore {
  public bkind = this.u8('bkind');         // KIND_* code above
  public belapsed = this.f32('belapsed');  // accumulated time for time-based motion
  public bspeed = this.f32('bspeed');      // linear/spin speed (kind-dependent)
  public bamp = this.f32('bamp');          // sinusoidal amplitude
  public bfreq = this.f32('bfreq');        // sinusoidal/circular frequency (Hz)
  public brad = this.f32('brad');          // circular orbit radius
  public boriX = this.f32('boriX');        // circular orbit origin x
  public boriY = this.f32('boriY');        // circular orbit origin y
  public bphase = this.f32('bphase');      // initial phase offset (radians)
}
