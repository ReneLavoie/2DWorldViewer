export class GameObject {
  public id: number;
  public index: number = -1;

  constructor(id: number) {
    this.id = id;
  }

  reset(): void {
    this.index = -1;
  }
}
