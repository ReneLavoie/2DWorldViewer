# 2DWorldViewer

A large-scale 2D world viewer built with **Pixi.js** and **TypeScript**, organized around an **Entity-Component-System (ECS)** architecture. It uses **InversifyJS** for dependency injection and includes spatial indexing, rendering systems, and UI components for efficiently visualizing and interacting with large numbers of entities.

## Project Structure

```
src/
├── assets/      Static assets used at runtime
├── di/          Inversify dependency-injection container & bindings
├── ecs/         Core ECS primitives (entities, ComponentStore, etc.)
├── mathUtils/   Math helpers (vectors, transforms, etc.)
├── rendering/   Pixi.js rendering layer
├── spatial/     Spatial indexing / culling structures
├── systems/     ECS systems (update logic)
├── types/       Shared TypeScript types
├── ui/          UI overlays and controls
├── index.html   App HTML entry point
└── index.ts     App TypeScript entry point
```

## Requirements

- Node.js 18+ and npm

## Installation

```bash
npm install
```

## Running the Project

Start the development server with hot reload:

```bash
npm run dev
```

Then open the URL printed in the terminal (typically `http://localhost:8080`).

## Building for Production

Generate an optimized bundle in the `dist/` folder:

```bash
npm run build
```

## Tech Stack

- [Pixi.js](https://pixijs.com/) — 2D WebGL rendering
- [TypeScript](https://www.typescriptlang.org/)
- [InversifyJS](https://inversify.io/) — dependency injection
- [Webpack](https://webpack.js.org/) — bundling & dev server

## License

See [LICENSE](./LICENSE).
