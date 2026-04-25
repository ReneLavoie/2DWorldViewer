import { Texture } from 'pixi.js';
import type { Component } from '../Component';

export const RendererType = 'Renderer' as const;

export interface RendererData {
  texture: Texture;
  tint?: number;
  alpha?: number;
  anchorX?: number;
  anchorY?: number;
  zIndex?: number;
}

export class RendererComponent implements Component {
  readonly type = RendererType;

  texture: Texture;
  tint: number;
  alpha: number;
  anchorX: number;
  anchorY: number;
  zIndex: number;

  visible = false;

  constructor(data: RendererData) {
    this.texture = data.texture;
    this.tint = data.tint ?? 0xffffff;
    this.alpha = data.alpha ?? 1;
    this.anchorX = data.anchorX ?? 0.5;
    this.anchorY = data.anchorY ?? 0.5;
    this.zIndex = data.zIndex ?? 0;
  }
}
