// Enables decorator metadata reflection required by InversifyJS for the DI container.
import 'reflect-metadata';
import { Application, Texture } from 'pixi.js';
// DI container and the symbol map used to resolve registered services.
import { container } from './di/container';
import { TYPES } from './di/types';
import { AssetLoader } from './assets/AssetLoader';
// ECS layer: the World owns entities/components, the factory creates game objects in bulk.
import { World } from './ecs/World';
import { GameObjectFactory } from './ecs/GameObjectFactory';
// Broad-phase spatial index used to cull off-screen entities each frame.
import { SpatialIndexSystem } from './spatial/SpatialIndexSystem';
// Per-frame systems: rendering pipeline, parallax/grid background, and camera transform.
import { RenderingSystem } from './systems/RenderingSystem';
import { BackgroundSystem } from './systems/BackgroundSystem';
import { CameraSystem } from './systems/CameraSystem';
// Orchestrates the order in which systems run each tick.
import { FrameScheduler } from './systems/FrameScheduler';
// Input handling for panning/zooming the camera and HUD overlay.
import { CameraController } from './ui/CameraController';
// Runtime-built texture atlas so all sprites can share a single GPU texture (fewer draw calls).
import { AtlasRegistry } from './rendering/AtlasRegistry';
// Backend-agnostic counter that hooks into WebGL/WebGPU to measure draw calls per frame.
import { DrawCallCounter } from './rendering/DrawCallCounter';

async function init() {
  // Grab the canvas the renderer will draw into and the DOM layer used for HUD/UI.
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiOverlay = document.getElementById('ui-overlay') as HTMLElement;

  // Create and asynchronously initialize the Pixi application.
  const app = new Application();

  await app.init({
    canvas,
    width: window.innerWidth,
    height: window.innerHeight,
    background: 0xffffff,
    // Force 1:1 device pixel ratio: avoids extra fragment work on HiDPI displays
    // which matters when rendering up to 1M sprites.
    resolution: 1,
    autoDensity: false,
    antialias: false,
    powerPreference: 'high-performance',
    // Prefer WebGPU; Pixi v8 transparently falls back to WebGL when unavailable.
    preference: 'webgpu',
  });

  console.log(`[2DWorldViewer] renderer: ${app.renderer.type}`);

  // Install the appropriate draw-call counter depending on which backend Pixi picked.
  const drawCalls = new DrawCallCounter();
  // app.renderer.type is 1 for WebGL, 2 for WebGPU in Pixi v8.
  const rendererAny = app.renderer as unknown as { gl?: WebGL2RenderingContext };
  if (rendererAny.gl) {
    // WebGL path: monkey-patch the GL context's draw* entry points.
    drawCalls.installWebGL(rendererAny.gl);
  } else {
    // WebGPU path: hook into the GPUCommandEncoder's render pass draw calls.
    drawCalls.installWebGPU();
  }
  // Latest snapshot of draw calls, exposed to the HUD via a getter below.
  let lastDrawCalls = 0;

  // Resolve the asset loader from the DI container and load required bundles.
  const assetLoader = container.get<AssetLoader>(TYPES.AssetLoader);

  await assetLoader.init();
  // Load the minimal "loader" bundle first (e.g. progress UI assets).
  await assetLoader.loadBundle('loader', (progress: number) => {
    console.log(`Loader bundle: ${Math.round(progress * 100)}%`);
  });

  // Block on the gameplay assets, then kick off UI assets in the background
  // so the main scene can start immediately without waiting on the UI bundle.
  await assetLoader.loadBundle('game');
  assetLoader.backgroundLoadBundle('ui');

  // Resolve all gameplay services up-front so we can wire them together.
  const world = container.get<World>(TYPES.World);
  const factory = container.get<GameObjectFactory>(TYPES.GameObjectFactory);
  const spatialIndex = container.get<SpatialIndexSystem>(TYPES.SpatialIndexSystem);
  const rendering = container.get<RenderingSystem>(TYPES.RenderingSystem);
  const background = container.get<BackgroundSystem>(TYPES.BackgroundSystem);
  const camera = container.get<CameraSystem>(TYPES.CameraSystem);
  const cameraController = container.get<CameraController>(TYPES.CameraController);
  const scheduler = container.get<FrameScheduler>(TYPES.FrameScheduler);

  // Define the playable area (world-space rectangle) and propagate it to systems
  // that need it for clamping (camera) and bucket sizing (spatial index).
  const worldBounds = { x: -10000, y: -10000, width: 20000, height: 20000 };
  spatialIndex.setWorldBounds(worldBounds);
  camera.setWorldBounds(worldBounds);
  scheduler.setViewport(window.innerWidth, window.innerHeight);
  background.init(window.innerWidth, window.innerHeight);

  // Attach scene graphs in draw order: background first (under), entities on top.
  background.attach(app.stage);
  rendering.attach(app.stage);

  // Keep the renderer and culling viewport in sync with the window size.
  window.addEventListener('resize', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    scheduler.setViewport(window.innerWidth, window.innerHeight);
  });

  // Look up the textures we want to use for the demo entities. Filter out any
  // missing aliases defensively in case a manifest entry was removed.
  const gameObjAliases = [
    'blue_swirl',
    'gold_triangle',
    'green_ring',
    'purple_diamond',
  ];
  const gameObjOriginals = gameObjAliases
    .map((a) => ({ alias: a, texture: assetLoader.get<Texture>(a) }))
    .filter((e): e is { alias: string; texture: Texture } => !!e.texture);

  // Pack the loaded source textures into a single runtime atlas so the
  // RenderingSystem can issue one draw call per batch instead of one per texture.
  const atlas = new AtlasRegistry();
  const atlasTexture = atlas.build(gameObjOriginals);
  rendering.setAtlasTexture(atlasTexture);

  // Map originals to their atlas-backed sub-textures (with adjusted UVs).
  const gameObjTextures = gameObjOriginals.map((e) => atlas.getByOriginal(e.texture)!);
  rendering.setTextures(gameObjTextures);

  // Stress-test target: spawn one million entities scattered across the world.
  const OBJECT_COUNT = 1_000_000;
  factory.createMany(OBJECT_COUNT, {
    worldBounds,
    textures: gameObjTextures,
  });
  // Bulk-insert all entities into the spatial grid once. Subsequent frames
  // only re-bucket entities whose transform actually changed.
  spatialIndex.rebuildAll();

  // Wire the camera controller to the canvas for input and to the overlay for HUD,
  // passing live getters so the HUD can display current entity / draw-call counts.
  cameraController.attach(canvas, uiOverlay, () => world.count(), () => lastDrawCalls);

  // Main loop: Pixi's ticker invokes this just before its automatic render.
  app.ticker.add((ticker) => {
    // Convert frame delta from milliseconds to seconds for system math.
    const dt = ticker.deltaMS / 1000;

    // Snapshot draw calls accumulated by the previous frame's render, then
    // reset for the upcoming render that Pixi auto-runs after this callback.
    lastDrawCalls = drawCalls.value;
    drawCalls.begin();

    // Apply input (pan/zoom) before stepping the simulation/rendering systems.
    cameraController.update(dt);
    scheduler.tick(dt);
  });
}

// Top-level entry: surface any initialization failure to the console.
init().catch((err) => console.error('[2DWorldViewer] init failed', err));
