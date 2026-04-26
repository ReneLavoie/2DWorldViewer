import 'reflect-metadata';
import { Application, Texture } from 'pixi.js';
import { container } from './di/container';
import { TYPES } from './di/types';
import { AssetLoader } from './assets/AssetLoader';
import { World } from './ecs/World';
import { GameObjectFactory } from './ecs/GameObjectFactory';
import { SpatialIndexSystem } from './spatial/SpatialIndexSystem';
import { TransformSystem } from './systems/TransformSystem';
import { BehaviorSystem } from './systems/BehaviorSystem';
import { RenderingSystem } from './systems/RenderingSystem';
import { BackgroundSystem } from './systems/BackgroundSystem';
import { CameraSystem } from './systems/CameraSystem';
import { CameraController } from './ui/CameraController';
import { AtlasRegistry } from './rendering/AtlasRegistry';

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
    // Prefer WebGPU; Pixi v8 transparently falls back to WebGL when unavailable.
    preference: 'webgpu',
  });
  console.log(`[2DWorldViewer] renderer: ${app.renderer.type}`);

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
  const spatialIndex = container.get<SpatialIndexSystem>(TYPES.SpatialIndexSystem);
  const transformSystem = container.get<TransformSystem>(TYPES.TransformSystem);
  const behaviorSystem = container.get<BehaviorSystem>(TYPES.BehaviorSystem);
  const rendering = container.get<RenderingSystem>(TYPES.RenderingSystem);
  const background = container.get<BackgroundSystem>(TYPES.BackgroundSystem);
  const camera = container.get<CameraSystem>(TYPES.CameraSystem);
  const cameraController = container.get<CameraController>(TYPES.CameraController);

  const worldBounds = { x: -10000, y: -10000, width: 20000, height: 20000 };
  spatialIndex.setWorldBounds(worldBounds);
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
  const gameObjOriginals = gameObjAliases
    .map((a) => ({ alias: a, texture: assetLoader.get<Texture>(a) }))
    .filter((e): e is { alias: string; texture: Texture } => !!e.texture);

  const atlas = new AtlasRegistry();
  const atlasTexture = atlas.build(gameObjOriginals);
  rendering.setAtlasTexture(atlasTexture);

  const gameObjTextures = gameObjOriginals.map((e) => atlas.getByOriginal(e.texture)!);
  rendering.setTextures(gameObjTextures);

  const OBJECT_COUNT = 1_000_000;
  factory.createMany(OBJECT_COUNT, {
    worldBounds,
    textures: gameObjTextures,
  });
  // Bulk-insert all entities into the spatial grid once. Subsequent frames
  // only re-bucket entities whose transform actually changed.
  spatialIndex.rebuildAll();

  cameraController.attach(canvas, uiOverlay, () => world.count());

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;

    cameraController.update(dt);

    // 1) Decide which entities to simulate AND render this frame.
    camera.beginFrame(world);

    // 2) Simulate only the active subset.
    behaviorSystem.update(world, dt);
    transformSystem.update(world, dt);

    // 3) Re-bucket only the simulated subset; skip when the camera covers the
    //    whole world (rendering uses stride sampling, not the spatial grid).
    if (!camera.isCoveringWorld() && world.dirtyTransforms > 0) {
      spatialIndex.update();
    }

    // 4) Push camera transform and render the active subset.
    camera.flush(world);

    world.resetFrameDirty();
  });
}

init();
