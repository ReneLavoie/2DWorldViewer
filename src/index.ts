import 'reflect-metadata';
import { Application, Texture } from 'pixi.js';
import { container } from './di/container';
import { TYPES } from './di/types';
import { AssetLoader } from './assets/AssetLoader';
import { World } from './ecs/World';
import { GameObjectFactory } from './ecs/GameObjectFactory';
import { QuadtreeSystem } from './spatial/QuadtreeSystem';
import { TransformSystem } from './systems/TransformSystem';
import { BehaviorSystem } from './systems/BehaviorSystem';
import { RenderingSystem } from './systems/RenderingSystem';
import { BackgroundSystem } from './systems/BackgroundSystem';
import { CameraSystem } from './systems/CameraSystem';
import { CameraController } from './ui/CameraController';

async function init() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiOverlay = document.getElementById('ui-overlay') as HTMLElement;

  const app = new Application();

  await app.init({
    canvas,
    width: window.innerWidth,
    height: window.innerHeight,
    background: 0xffffff,
    resolution: 1,
    autoDensity: false,
    antialias: false,
    powerPreference: 'high-performance',
  });

  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    camera.setViewport(window.innerWidth, window.innerHeight);
  });

  const assetLoader = container.get<AssetLoader>(TYPES.AssetLoader);

  await assetLoader.init();
  await assetLoader.loadBundle('loader', (progress: number) => {
    console.log(`Loader bundle: ${Math.round(progress * 100)}%`);
  });

  await assetLoader.loadBundle('game');
  assetLoader.backgroundLoadBundle('ui');

  const world = container.get<World>(TYPES.World);
  const factory = container.get<GameObjectFactory>(TYPES.GameObjectFactory);
  const quadtree = container.get<QuadtreeSystem>(TYPES.QuadtreeSystem);
  const transformSystem = container.get<TransformSystem>(TYPES.TransformSystem);
  const behaviorSystem = container.get<BehaviorSystem>(TYPES.BehaviorSystem);
  const rendering = container.get<RenderingSystem>(TYPES.RenderingSystem);
  const background = container.get<BackgroundSystem>(TYPES.BackgroundSystem);
  const camera = container.get<CameraSystem>(TYPES.CameraSystem);
  const cameraController = container.get<CameraController>(TYPES.CameraController);

  const worldBounds = { x: -10000, y: -10000, width: 20000, height: 20000 };
  quadtree.setWorldBounds(worldBounds);
  camera.setWorldBounds(worldBounds);
  camera.setViewport(window.innerWidth, window.innerHeight);

  background.attach(app.stage);
  background.init(window.innerWidth, window.innerHeight);
  rendering.attach(app.stage);

  const gameObjAliases = [
    'blue_swirl',
    'gold_triangle',
    'green_ring',
    'purple_diamond',
  ];
  const gameObjTextures = gameObjAliases
    .map((a) => assetLoader.get<Texture>(a))
    .filter((t): t is Texture => !!t);

  rendering.setZBucketCount(10);

  const OBJECT_COUNT = 1_000_000;
  factory.createMany(OBJECT_COUNT, {
    worldBounds,
    textures: gameObjTextures,
  });
  // Bulk-insert all entities into the spatial grid once. Subsequent frames
  // only re-bucket entities whose transform actually changed.
  quadtree.rebuildAll();

  cameraController.attach(canvas, uiOverlay, () => world.count());

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;

    cameraController.update(dt);
    behaviorSystem.update(world, dt);
    transformSystem.update(world, dt);

    const transformsDirty = world.dirtyTransforms > 0 || world.structuralDirty;
    const cameraDirty = camera.isDirty();

    if (transformsDirty) {
      quadtree.update();
    }
    if (transformsDirty || cameraDirty) {
      camera.update(world);
    }

    world.resetFrameDirty();
  });
}

init();
