import type { Component } from '../Component';

export const TransformType = 'Transform' as const;

export class TransformComponent implements Component {
  readonly type = TransformType;

  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;

  width: number;
  height: number;

  vx = 0;
  vy = 0;
  vr = 0;

  dirty = true;

  constructor(
    x = 0,
    y = 0,
    width = 32,
    height = 32,
    scaleX = 1,
    scaleY = 1,
    rotation = 0,
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.scaleX = scaleX;
    this.scaleY = scaleY;
    this.rotation = rotation;
  }
}
