// Lightweight identity handle for an entity. Components live in SoA arrays on
// the World; a GameObject is just (id, slot index) so callers can hold a
// stable reference even though the underlying slot may be reassigned.
export class GameObject {
  // World-unique entity id.
  public id: number;
  // Index into the World's component arrays, or -1 if not currently allocated.
  public index: number = -1;

  public constructor(id: number) {
    this.id = id;
  }

  // Marks this object as detached from any slot. The id is intentionally kept
  // so the handle remains comparable.
  public reset(): void {
    this.index = -1;
  }
}
