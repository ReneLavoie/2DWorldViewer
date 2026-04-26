import { inject, injectable } from 'inversify';
import { TYPES } from '../di/types';
import { CameraSystem } from '../systems/CameraSystem';

export interface CameraControllerOptions {
  panSpeed?: number;
  buttonPanStep?: number;
  zoomStep?: number;
  minZoom?: number;
  maxZoom?: number;
  panSmoothing?: number;
  zoomSmoothing?: number;
}

@injectable()
export class CameraController {
  private keys = new Set<string>();
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private panSpeed = 600;
  private zoomStep = 1.15;
  private minZoom = 0.05;
  private maxZoom = 4;

  // Exponential smoothing rates (per second). Larger = stiffer / less inertia.
  // Time-constant ~= 1 / rate. ~18 -> ~55ms settle, feels responsive but smooth.
  private panSmoothing = 18;
  private zoomSmoothing = 14;

  // Target state. Camera lerps toward these every frame in update().
  private targetX = 0;
  private targetY = 0;
  private targetZoom = 1;
  private targetInit = false;

  private target: HTMLElement | null = null;
  private camInfo: HTMLElement | null = null;
  private zoomInfo: HTMLElement | null = null;
  private countInfo: HTMLElement | null = null;
  private drawsInfo: HTMLElement | null = null;
  private getCount: () => number = () => 0;
  private getDrawCalls: () => number = () => 0;

  private activePans = new Set<string>();
  private activeZooms = new Set<string>();

  public constructor(
    @inject(TYPES.CameraSystem) private readonly camera: CameraSystem,
  ) {}

  public configure(opts: CameraControllerOptions = {}): void {
    if (opts.panSpeed !== undefined) this.panSpeed = opts.panSpeed;
    if (opts.zoomStep !== undefined) this.zoomStep = opts.zoomStep;
    if (opts.minZoom !== undefined) this.minZoom = opts.minZoom;
    if (opts.maxZoom !== undefined) this.maxZoom = opts.maxZoom;
    if (opts.panSmoothing !== undefined) this.panSmoothing = opts.panSmoothing;
    if (opts.zoomSmoothing !== undefined) this.zoomSmoothing = opts.zoomSmoothing;
  }

  public attach(target: HTMLElement, overlay: HTMLElement, getObjectCount?: () => number, getDrawCalls?: () => number): void {
    this.target = target;
    if (getObjectCount) this.getCount = getObjectCount;
    if (getDrawCalls) this.getDrawCalls = getDrawCalls;
    this.camInfo = overlay.querySelector<HTMLElement>('#ui-cam');
    this.zoomInfo = overlay.querySelector<HTMLElement>('#ui-zoom');
    this.countInfo = overlay.querySelector<HTMLElement>('#ui-count');
    this.drawsInfo = overlay.querySelector<HTMLElement>('#ui-draws');

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    target.addEventListener('wheel', this.onWheel, { passive: false });

    const bindHold = (
      btn: HTMLButtonElement,
      onStart: () => void,
      onStop: () => void,
    ): void => {
      let active = false;
      const start = (e: Event): void => {
        if (active) return;
        active = true;
        e.preventDefault();
        onStart();
      };
      const stop = (): void => {
        if (!active) return;
        active = false;
        onStop();
      };
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', stop);
      btn.addEventListener('mouseleave', stop);
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', stop);
      btn.addEventListener('touchcancel', stop);
      window.addEventListener('blur', stop);
    };

    overlay.querySelectorAll<HTMLButtonElement>('button[data-pan]').forEach((btn) => {
      const dir = btn.dataset.pan!;
      bindHold(btn, () => this.activePans.add(dir), () => this.activePans.delete(dir));
    });
    overlay.querySelectorAll<HTMLButtonElement>('button[data-zoom]').forEach((btn) => {
      const dir = btn.dataset.zoom!;
      bindHold(btn, () => this.activeZooms.add(dir), () => this.activeZooms.delete(dir));
    });
    overlay.querySelectorAll<HTMLButtonElement>('button[data-reset]').forEach((btn) => {
      btn.addEventListener('click', () => this.reset());
    });
  }

  update(dt: number): void {
    if (!this.targetInit) {
      this.targetX = this.camera.x;
      this.targetY = this.camera.y;
      this.targetZoom = this.camera.zoom;
      this.targetInit = true;
    }

    let dx = 0;
    let dy = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a') || this.activePans.has('left')) dx -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d') || this.activePans.has('right')) dx += 1;
    if (this.keys.has('arrowup') || this.keys.has('w') || this.activePans.has('up')) dy -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s') || this.activePans.has('down')) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      // Pan against target zoom so movement feels consistent regardless of
      // current animated zoom value.
      const amount = (this.panSpeed * dt) / this.targetZoom;
      this.targetX += (dx / len) * amount;
      this.targetY += (dy / len) * amount;
    }
    if (this.keys.has('q') || this.keys.has('-') || this.activeZooms.has('out')) {
      this.zoomTargetAt(this.camera.width / 2, this.camera.height / 2, Math.pow(1 / this.zoomStep, dt * 4));
    }
    if (this.keys.has('e') || this.keys.has('=') || this.keys.has('+') || this.activeZooms.has('in')) {
      this.zoomTargetAt(this.camera.width / 2, this.camera.height / 2, Math.pow(this.zoomStep, dt * 4));
    }

    // Exponential approach: alpha = 1 - exp(-rate * dt) is framerate-independent.
    const aPan = 1 - Math.exp(-this.panSmoothing * dt);
    const aZoom = 1 - Math.exp(-this.zoomSmoothing * dt);

    // Smooth zoom in log-space so multiplicative steps animate uniformly.
    const curZoom = this.camera.zoom;
    const logCur = Math.log(curZoom);
    const logTarget = Math.log(this.targetZoom);
    let nextZoom = Math.exp(logCur + (logTarget - logCur) * aZoom);
    if (Math.abs(nextZoom - this.targetZoom) / this.targetZoom < 1e-4) nextZoom = this.targetZoom;

    // Lerp the *screen-center world anchor* rather than camera.x/y directly.
    // Then derive camera.x/y from the anchor + live zoom. This keeps the world
    // point under the screen center stable while zoom is interpolating, even
    // though pan and zoom use different smoothing rates. Without this, camera.x
    // catches up faster than camera.zoom and the view appears to drift toward
    // the bottom-right while zooming in, then "settle back" on release.
    const sx = this.camera.width * 0.5;
    const sy = this.camera.height * 0.5;
    const liveAnchorX = this.camera.x + sx / curZoom;
    const liveAnchorY = this.camera.y + sy / curZoom;
    const targetAnchorX = this.targetX + sx / this.targetZoom;
    const targetAnchorY = this.targetY + sy / this.targetZoom;
    const newAnchorX = liveAnchorX + (targetAnchorX - liveAnchorX) * aPan;
    const newAnchorY = liveAnchorY + (targetAnchorY - liveAnchorY) * aPan;

    if (nextZoom !== curZoom) this.camera.setZoom(nextZoom);

    const desiredX = newAnchorX - sx / this.camera.zoom;
    const desiredY = newAnchorY - sy / this.camera.zoom;
    const snapX = Math.abs(desiredX - this.targetX) < 1e-3 ? this.targetX : desiredX;
    const snapY = Math.abs(desiredY - this.targetY) < 1e-3 ? this.targetY : desiredY;
    this.camera.setPosition(snapX, snapY);

    // Re-sync targets from camera in case setPosition/setZoom clamped them
    // against world bounds; otherwise targets would drift outside reachable area.
    this.targetX = this.camera.x + (this.targetX - snapX);
    this.targetY = this.camera.y + (this.targetY - snapY);
    if (this.targetZoom !== this.camera.zoom && nextZoom === this.targetZoom) {
      this.targetZoom = this.camera.zoom;
    }

    if (this.camInfo) this.camInfo.textContent = `${Math.round(this.camera.x)}, ${Math.round(this.camera.y)}`;
    if (this.zoomInfo) this.zoomInfo.textContent = `${this.camera.zoom.toFixed(2)}x`;
    if (this.countInfo) this.countInfo.textContent = String(this.getCount());
    if (this.drawsInfo) this.drawsInfo.textContent = String(this.getDrawCalls());
  }

  reset(): void {
    this.targetX = 0;
    this.targetY = 0;
    this.targetZoom = 1;
    this.targetInit = true;
  }


  // Adjust the *target* zoom while keeping the world point under (screenX,screenY)
  // anchored. Anchor against the *target* camera (not the live one) so that
  // successive calls while a zoom button is held compose without drifting:
  // the live camera lags behind the target due to smoothing, so anchoring
  // against the live camera would re-anchor at a stale position every frame
  // and the target would slide toward the bottom-right.
  private zoomTargetAt(screenX: number, screenY: number, factor: number): void {
    const prevTarget = this.targetZoom;
    const nextTarget = Math.min(this.maxZoom, Math.max(this.minZoom, prevTarget * factor));
    if (nextTarget === prevTarget) return;
    const worldX = this.targetX + screenX / prevTarget;
    const worldY = this.targetY + screenY / prevTarget;
    this.targetZoom = nextTarget;
    this.targetX = worldX - screenX / nextTarget;
    this.targetY = worldY - screenY / nextTarget;
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
    // Move the target; the camera lerps toward it for a slight glide on release.
    this.targetX -= dx / this.targetZoom;
    this.targetY -= dy / this.targetZoom;
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
    this.zoomTargetAt(sx, sy, factor);
  };
}