import 'reflect-metadata';
import { Application, Texture } from 'pixi.js';
import { container } from './di/container';
import { TYPES } from './di/types';
import { AssetLoader } from './assets/AssetLoader';
import { World } from './ecs/World';
import { GameObjectFactory } from './ecs/GameObjectFactory';
import { SpatialIndexSystem } from './spatial/SpatialIndexSystem';
import { RenderingSystem } from './systems/RenderingSystem';
import { BackgroundSystem } from './systems/BackgroundSystem';
import { CameraSystem } from './systems/CameraSystem';
import { FrameScheduler } from './systems/FrameScheduler';
import { CameraController } from './ui/CameraController';
import { AtlasRegistry } from './rendering/AtlasRegistry';
import { DrawCallCounter } from './rendering/DrawCallCounter';

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

  const drawCalls = new DrawCallCounter();
  // app.renderer.type is 1 for WebGL, 2 for WebGPU in Pixi v8.
  const rendererAny = app.renderer as unknown as { gl?: WebGL2RenderingContext };
  if (rendererAny.gl) {
    drawCalls.installWebGL(rendererAny.gl);
  } else {
    drawCalls.installWebGPU();
  }
  let lastDrawCalls = 0;

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
  const rendering = container.get<RenderingSystem>(TYPES.RenderingSystem);
  const background = container.get<BackgroundSystem>(TYPES.BackgroundSystem);
  const camera = container.get<CameraSystem>(TYPES.CameraSystem);
  const cameraController = container.get<CameraController>(TYPES.CameraController);
  const scheduler = container.get<FrameScheduler>(TYPES.FrameScheduler);

  const worldBounds = { x: -10000, y: -10000, width: 20000, height: 20000 };
  spatialIndex.setWorldBounds(worldBounds);
  camera.setWorldBounds(worldBounds);
  scheduler.setViewport(window.innerWidth, window.innerHeight);
  background.init(window.innerWidth, window.innerHeight);

  background.attach(app.stage);
  rendering.attach(app.stage);

  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    scheduler.setViewport(window.innerWidth, window.innerHeight);
  });

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

  cameraController.attach(canvas, uiOverlay, () => world.count(), () => lastDrawCalls);

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;

    // Snapshot draw calls accumulated by the previous frame's render, then
    // reset for the upcoming render that Pixi auto-runs after this callback.
    lastDrawCalls = drawCalls.value;
    drawCalls.begin();

    cameraController.update(dt);
    scheduler.tick(dt);
  });
}

init().catch((err) => console.error('[2DWorldViewer] init failed', err));
