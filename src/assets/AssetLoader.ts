import { injectable } from 'inversify';
import { Assets, type ProgressCallback } from 'pixi.js';
import { manifest } from './manifest';

@injectable()
export class AssetLoader {
  private initialized = false;
  private loadedBundles = new Set<string>();

  async init(basePath = 'assets/'): Promise<void> {
    if (this.initialized) return;
    await Assets.init({ manifest, basePath });
    this.initialized = true;
  }

  async loadBundle(
    name: string | string[],
    onProgress?: ProgressCallback,
  ): Promise<void> {
    const names = Array.isArray(name) ? name : [name];
    await Assets.loadBundle(names, onProgress);
    names.forEach((n) => this.loadedBundles.add(n));
  }

  async backgroundLoadBundle(name: string | string[]): Promise<void> {
    await Assets.backgroundLoadBundle(name);
  }

  async unloadBundle(name: string | string[]): Promise<void> {
    const names = Array.isArray(name) ? name : [name];
    await Assets.unloadBundle(names);
    names.forEach((n) => this.loadedBundles.delete(n));
  }

  get<T = unknown>(alias: string): T {
    return Assets.get<T>(alias);
  }

  isBundleLoaded(name: string): boolean {
    return this.loadedBundles.has(name);
  }
}
