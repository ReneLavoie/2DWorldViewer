let nextId = 1;

export class GameObject {
  public id: number;
  public index: number = -1;

  constructor(id?: number) {
    this.id = id ?? nextId++;
  }

  reset(): void {
    this.index = -1;
  }

  static nextId(): number {
    return nextId++;
  }
}
