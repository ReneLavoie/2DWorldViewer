declare module 'pixi-msdf-textfield' {
  export type PerformanceLevel =
    | 'ultra_low'
    | 'mobile_low'
    | 'mobile_mid'
    | 'mobile_high'
    | 'desktop'
    | 'ultra';

  export interface PerformanceMonitorOptions {
    targetFPS?: number;
    sampleSize?: number;
    adjustmentInterval?: number;
    autoAdjust?: boolean;
    autoUpdateGlobalConfig?: boolean;
    checkMemoryPressure?: boolean;
    checkThermalState?: boolean;
    checkBatteryState?: boolean;
    checkGPUMemoryPressure?: boolean;
    respectReducedMotion?: boolean;
    reducedMotionMaxLevel?: PerformanceLevel;
    initialLevel?: PerformanceLevel;
    minLevel?: PerformanceLevel;
    maxLevel?: PerformanceLevel;
    gl?: WebGLRenderingContext | WebGL2RenderingContext | null;
    debug?: boolean;
    enableConsole?: boolean;
    onPerformanceChange?: (preset: string, fps: number) => void;
    onCircuitBreakerTrip?: () => void;
  }

  export class PerformanceMonitor {
    constructor(options?: PerformanceMonitorOptions);
    start(): void;
    stop(): void;
    pause(): void;
    resume(): void;
    destroy(): void;
    tick(timestamp?: number): void;
    setAutoAdjust(enabled: boolean): void;
    setLevel(level: PerformanceLevel): void;
    getCurrentLevel(): PerformanceLevel;
    suggestLevel(): PerformanceLevel;
    getAverageFPS(): number;
    getMinFPS(): number;
    getMaxFPS(): number;
    getPercentileFPS(percentile: number): number;
    getFrameTimeStdDev(): number;
    getStats(): Record<string, unknown>;
    getDetailedMetrics(): Record<string, unknown>;
    setConsoleEnabled(enabled: boolean): void;
    isConsoleEnabled(): boolean;
  }
}
