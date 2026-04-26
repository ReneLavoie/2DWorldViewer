export const TYPES = {
  AssetLoader: Symbol.for('AssetLoader'),
  World: Symbol.for('World'),
  GameObjectFactory: Symbol.for('GameObjectFactory'),
  SpatialIndexSystem: Symbol.for('SpatialIndexSystem'),
  TransformSystem: Symbol.for('TransformSystem'),
  BehaviorSystem: Symbol.for('BehaviorSystem'),
  RenderingSystem: Symbol.for('RenderingSystem'),
  BackgroundSystem: Symbol.for('BackgroundSystem'),
  CameraSystem: Symbol.for('CameraSystem'),
  CameraController: Symbol.for('CameraController'),
} as const;