import type { AssetsManifest } from 'pixi.js';

export const manifest: AssetsManifest = {
  bundles: [
    {
      name: 'loader',
      assets: [],
    },
    {
      name: 'game',
      assets: [
        {
          alias: 'blue_swirl',
          src: 'images/gameObjImg/blue_swirl.png',
        },
        {
          alias: 'gold_triangle',
          src: 'images/gameObjImg/gold_triangle.png',
        },
        {
          alias: 'green_ring',
          src: 'images/gameObjImg/green_ring.png',
        },
        {
          alias: 'purple_diamond',
          src: 'images/gameObjImg/purple_diamond.png',
        },
        {
          alias: 'tile_blue_ornate',
          src: 'images/tiles/tile_blue_ornate.png',
        },
        {
          alias: 'tile_brick',
          src: 'images/tiles/tile_brick.png',
        },
        {
          alias: 'tile_gold_cross',
          src: 'images/tiles/tile_gold_cross.png',
        },
        {
          alias: 'tile_green_lattice',
          src: 'images/tiles/tile_green_lattice.png',
        },
        {
          alias: 'tile_purple_diamond',
          src: 'images/tiles/tile_purple_diamond.png',
        },
      ],
    },
    {
      name: 'ui',
      assets: [],
    },
  ],
};
