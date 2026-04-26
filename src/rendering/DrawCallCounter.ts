// Counts draw calls per frame by patching the underlying graphics API.
// Supports both WebGL2 (drawElements/drawArrays + instanced variants) and
// WebGPU (GPURenderPassEncoder.draw / drawIndexed + indirect variants).
export class DrawCallCounter {
  private count = 0;
  private installed = false;

  begin(): void {
    this.count = 0;
  }

  get value(): number {
    return this.count;
  }

  installWebGL(gl: WebGL2RenderingContext | WebGLRenderingContext): void {
    if (this.installed) return;
    this.installed = true;
    const self = this;
    const methods = [
      'drawElements',
      'drawArrays',
      'drawElementsInstanced',
      'drawArraysInstanced',
    ] as const;
    for (const name of methods) {
      const orig = (gl as unknown as Record<string, ((...args: unknown[]) => unknown) | undefined>)[name];
      if (typeof orig !== 'function') continue;
      (gl as unknown as Record<string, (...args: unknown[]) => unknown>)[name] = function (
        this: unknown,
        ...args: unknown[]
      ): unknown {
        self.count++;
        return orig.apply(this, args);
      };
    }
  }

  installWebGPU(): void {
    if (this.installed) return;
    if (typeof (globalThis as { GPURenderPassEncoder?: unknown }).GPURenderPassEncoder === 'undefined') return;
    this.installed = true;
    const self = this;
    const proto = (globalThis as unknown as { GPURenderPassEncoder: { prototype: Record<string, unknown> } })
      .GPURenderPassEncoder.prototype;
    const methods = ['draw', 'drawIndexed', 'drawIndirect', 'drawIndexedIndirect'] as const;
    for (const name of methods) {
      const orig = proto[name];
      if (typeof orig !== 'function') continue;
      proto[name] = function (this: unknown, ...args: unknown[]): unknown {
        self.count++;
        return (orig as (...a: unknown[]) => unknown).apply(this, args);
      };
    }
  }
}
