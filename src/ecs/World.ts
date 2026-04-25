import { injectable } from 'inversify';
import { GameObject } from './GameObject';

@injectable()
export class World {
  private objects = new Map<number, GameObject>();

  add(obj: GameObject): void {
    this.objects.set(obj.id, obj);
  }

  remove(id: number): void {
    this.objects.delete(id);
  }

  get(id: number): GameObject | undefined {
    return this.objects.get(id);
  }

  all(): GameObject[] {
    return Array.from(this.objects.values());
  }

  size(): number {
    return this.objects.size;
  }

  clear(): void {
    this.objects.clear();
  }
}
