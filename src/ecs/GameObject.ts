export class GameObject {
  public id: number;
  public index: number = -1;

  public constructor(id: number) {
    this.id = id;
  }

  public reset(): void {
    this.index = -1;
  }
}
