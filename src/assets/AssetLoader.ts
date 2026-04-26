import { injectable } from 'inversify';
import { Assets, type ProgressCallback } from 'pixi.js';
import { manifest } from './manifest';

// Thin DI-friendly wrapper around Pixi's global Assets API. Centralises
// initialization, bundle bookkeeping, and texture lookup so the rest of the
// app never touches the Assets singleton directly.
@injectable()
export class AssetLoader {
  // Guards against double-initialization of Pixi's Assets system.
  private initialized = false;
  // Tracks which bundles have completed loading (used by isBundleLoaded).
  private loadedBundles = new Set<string>();

  // Initializes Pixi's Assets system with this app's manifest.
  // Safe to call multiple times; subsequent calls are no-ops.
  public async init(basePath = 'assets/'): Promise<void> {
    if (this.initialized) return;
    await Assets.init({ manifest, basePath });
    this.initialized = true;
  }

  // Loads one or more bundles and waits for completion. Optional progress
  // callback fires as Pixi resolves individual assets within the bundle(s).
  public async loadBundle(
    name: string | string[],
    onProgress?: ProgressCallback,
  ): Promise<void> {
    const names = Array.isArray(name) ? name : [name];
    await Assets.loadBundle(names, onProgress);
    names.forEach((n) => this.loadedBundles.add(n));
  }

  // Kicks off bundle loading at low priority without blocking the caller.
  // Useful for assets that aren't required for the first frame (e.g. UI).
  public async backgroundLoadBundle(name: string | string[]): Promise<void> {
    await Assets.backgroundLoadBundle(name);
  }

  // Frees GPU/CPU memory for the given bundle(s) and forgets them locally.
  public async unloadBundle(name: string | string[]): Promise<void> {
    const names = Array.isArray(name) ? name : [name];
    await Assets.unloadBundle(names);
    names.forEach((n) => this.loadedBundles.delete(n));
  }

  // Resolves a previously loaded asset by its manifest alias.
  public get<T = unknown>(alias: string): T {
    return Assets.get<T>(alias);
  }

  public isBundleLoaded(name: string): boolean {
    return this.loadedBundles.has(name);
  }
}
