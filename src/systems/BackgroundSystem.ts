import { inject, injectable } from 'inversify';
import { Container, Texture, TilingSprite } from 'pixi.js';
import { TYPES } from '../di/types';
import { AssetLoader } from '../assets/AssetLoader';

// Background tile aliases. One is randomly picked unless a specific alias is
// passed to init().
const TILE_ALIASES = [
  'tile_blue_ornate',
  'tile_brick',
  'tile_gold_cross',
  'tile_green_lattice',
  'tile_purple_diamond',
];

// Renders an infinite tiled background that scrolls/zooms with the camera.
// Uses a Pixi TilingSprite so the whole background is a single draw call
// regardless of how much of the world is visible.
@injectable()
export class BackgroundSystem {
  // Container kept separate from the entity layer so it can be inserted at
  // index 0 in the stage without affecting other layer ordering.
  private readonly layer = new Container();
  private sprite: TilingSprite | null = null;
  private stage: Container | null = null;
  private width = 0;
  private height = 0;

  public constructor(
    @inject(TYPES.AssetLoader) private readonly assets: AssetLoader,
  ) {}

  // Adds the background layer underneath whatever else has been attached.
  public attach(stage: Container): void {
    this.stage = stage;
    if (!this.layer.parent) stage.addChildAt(this.layer, 0);
  }

  // Builds (or rebuilds) the tiling sprite. Safe to call repeatedly to swap
  // tile textures or react to viewport changes.
  public init(viewportWidth: number, viewportHeight: number, alias?: string): void {
    const pickedAlias =
      alias ?? TILE_ALIASES[Math.floor(Math.random() * TILE_ALIASES.length)];
    const texture = this.assets.get<Texture>(pickedAlias);
    if (!texture) return;

    if (this.sprite) {
      this.layer.removeChild(this.sprite);
      this.sprite.destroy();
    }

    this.sprite = new TilingSprite({
      texture,
      width: viewportWidth,
      height: viewportHeight,
    });
    this.width = viewportWidth;
    this.height = viewportHeight;
    this.layer.addChild(this.sprite);
  }

  public setViewport(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.sprite) {
      this.sprite.width = width;
      this.sprite.height = height;
    }
  }

  // Translate/scale the tile pattern so the background appears to scroll with
  // the camera. The sprite itself stays anchored to the screen; only its
  // tilePosition/tileScale change.
  public setCamera(x: number, y: number, zoom = 1): void {
    if (!this.sprite) return;
    this.sprite.tilePosition.set(-x * zoom, -y * zoom);
    this.sprite.tileScale.set(zoom, zoom);
  }
}
