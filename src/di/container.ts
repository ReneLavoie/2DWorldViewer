import { Container } from 'inversify';
import { TYPES } from './types';
import { AssetLoader } from '../assets/AssetLoader';
import { World } from '../ecs/World';
import { GameObjectFactory } from '../ecs/GameObjectFactory';
import { SpatialIndexSystem } from '../spatial/SpatialIndexSystem';
import { TransformSystem } from '../systems/TransformSystem';
import { BehaviorSystem } from '../systems/BehaviorSystem';
import { RenderingSystem } from '../systems/RenderingSystem';
import { BackgroundSystem } from '../systems/BackgroundSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { CameraController } from '../ui/CameraController';

export const container = new Container({ defaultScope: 'Singleton' });

container.bind<AssetLoader>(TYPES.AssetLoader).to(AssetLoader);
container.bind<World>(TYPES.World).to(World);
container.bind<GameObjectFactory>(TYPES.GameObjectFactory).to(GameObjectFactory);
container.bind<SpatialIndexSystem>(TYPES.SpatialIndexSystem).to(SpatialIndexSystem);
container.bind<TransformSystem>(TYPES.TransformSystem).to(TransformSystem);
container.bind<BehaviorSystem>(TYPES.BehaviorSystem).to(BehaviorSystem);
container.bind<RenderingSystem>(TYPES.RenderingSystem).to(RenderingSystem);
container.bind<BackgroundSystem>(TYPES.BackgroundSystem).to(BackgroundSystem);
container.bind<CameraSystem>(TYPES.CameraSystem).to(CameraSystem);
container.bind<CameraController>(TYPES.CameraController).to(CameraController);