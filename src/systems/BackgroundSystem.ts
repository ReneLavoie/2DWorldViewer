import { inject, injectable } from 'inversify';
import { Container, Texture, TilingSprite } from 'pixi.js';
import { TYPES } from '../di/types';
import { AssetLoader } from '../assets/AssetLoader';

const TILE_ALIASES = [
  'tile_blue_ornate',
  'tile_brick',
  'tile_gold_cross',
  'tile_green_lattice',
  'tile_purple_diamond',
];

@injectable()
export class BackgroundSystem {
  private readonly layer = new Container();
  private sprite: TilingSprite | null = null;
  private stage: Container | null = null;
  private width = 0;
  private height = 0;

  public constructor(
    @inject(TYPES.AssetLoader) private readonly assets: AssetLoader,
  ) {}

  public attach(stage: Container): void {
    this.stage = stage;
    if (!this.layer.parent) stage.addChildAt(this.layer, 0);
  }

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

  public setCamera(x: number, y: number, zoom = 1): void {
    if (!this.sprite) return;
    this.sprite.tilePosition.set(-x * zoom, -y * zoom);
    this.sprite.tileScale.set(zoom, zoom);
  }
}