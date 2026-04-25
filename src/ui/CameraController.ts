import { inject, injectable } from 'inversify';
import { TYPES } from '../di/types';
import { CameraSystem } from '../systems/CameraSystem';

export interface CameraControllerOptions {
  panSpeed?: number;
  buttonPanStep?: number;
  zoomStep?: number;
  minZoom?: number;
  maxZoom?: number;
}

@injectable()
export class CameraController {
  private keys = new Set<string>();
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private panSpeed = 600;
  private buttonPanStep = 60;
  private zoomStep = 1.15;
  private minZoom = 0.25;
  private maxZoom = 4;

  private target: HTMLElement | null = null;
  private camInfo: HTMLElement | null = null;
  private zoomInfo: HTMLElement | null = null;
  private countInfo: HTMLElement | null = null;
  private getCount: () => number = () => 0;

  constructor(
    @inject(TYPES.CameraSystem) private readonly camera: CameraSystem,
  ) {}

  configure(opts: CameraControllerOptions = {}): void {
    if (opts.panSpeed !== undefined) this.panSpeed = opts.panSpeed;
    if (opts.buttonPanStep !== undefined) this.buttonPanStep = opts.buttonPanStep;
    if (opts.zoomStep !== undefined) this.zoomStep = opts.zoomStep;
    if (opts.minZoom !== undefined) this.minZoom = opts.minZoom;
    if (opts.maxZoom !== undefined) this.maxZoom = opts.maxZoom;
  }

  attach(target: HTMLElement, overlay: HTMLElement, getObjectCount?: () => number): void {
    this.target = target;
    if (getObjectCount) this.getCount = getObjectCount;
    this.camInfo = overlay.querySelector<HTMLElement>('#ui-cam');
    this.zoomInfo = overlay.querySelector<HTMLElement>('#ui-zoom');
    this.countInfo = overlay.querySelector<HTMLElement>('#ui-count');

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    target.addEventListener('wheel', this.onWheel, { passive: false });

    overlay.querySelectorAll<HTMLButtonElement>('button[data-pan]').forEach((btn) => {
      btn.addEventListener('click', () => this.nudge(btn.dataset.pan!));
    });
    overlay.querySelectorAll<HTMLButtonElement>('button[data-zoom]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.zoom;
        this.zoomAt(this.camera.width / 2, this.camera.height / 2, dir === 'in' ? this.zoomStep : 1 / this.zoomStep);
      });
    });
    overlay.querySelectorAll<HTMLButtonElement>('button[data-reset]').forEach((btn) => {
      btn.addEventListener('click', () => this.reset());
    });
  }

  update(dt: number): void {
    let dx = 0;
    let dy = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) dx -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) dx += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) dy -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      const amount = (this.panSpeed * dt) / this.camera.zoom;
      this.camera.setPosition(
        this.camera.x + (dx / len) * amount,
        this.camera.y + (dy / len) * amount,
      );
    }
    if (this.keys.has('q') || this.keys.has('-')) {
      this.zoomAt(this.camera.width / 2, this.camera.height / 2, Math.pow(1 / this.zoomStep, dt * 4));
    }
    if (this.keys.has('e') || this.keys.has('=') || this.keys.has('+')) {
      this.zoomAt(this.camera.width / 2, this.camera.height / 2, Math.pow(this.zoomStep, dt * 4));
    }

    if (this.camInfo) this.camInfo.textContent = `${Math.round(this.camera.x)}, ${Math.round(this.camera.y)}`;
    if (this.zoomInfo) this.zoomInfo.textContent = `${this.camera.zoom.toFixed(2)}x`;
    if (this.countInfo) this.countInfo.textContent = String(this.getCount());
  }

  reset(): void {
    this.camera.setPosition(0, 0);
    this.camera.zoom = 1;
  }

  private nudge(dir: string): void {
    const step = this.buttonPanStep / this.camera.zoom;
    if (dir === 'left') this.camera.setPosition(this.camera.x - step, this.camera.y);
    else if (dir === 'right') this.camera.setPosition(this.camera.x + step, this.camera.y);
    else if (dir === 'up') this.camera.setPosition(this.camera.x, this.camera.y - step);
    else if (dir === 'down') this.camera.setPosition(this.camera.x, this.camera.y + step);
  }

  private zoomAt(screenX: number, screenY: number, factor: number): void {
    const prev = this.camera.zoom;
    const next = Math.min(this.maxZoom, Math.max(this.minZoom, prev * factor));
    if (next === prev) return;
    const worldX = this.camera.x + screenX / prev;
    const worldY = this.camera.y + screenY / prev;
    this.camera.zoom = next;
    this.camera.setPosition(worldX - screenX / next, worldY - screenY / next);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    this.keys.add(e.key.toLowerCase());
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.camera.setPosition(
      this.camera.x - dx / this.camera.zoom,
      this.camera.y - dy / this.camera.zoom,
    );
  };

  private onPointerUp = (): void => {
    this.dragging = false;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = (this.target as HTMLElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? this.zoomStep : 1 / this.zoomStep;
    this.zoomAt(sx, sy, factor);
  };
}
