import type { Component } from '../Component';

export const BehaviorType = 'Behavior' as const;

export type BehaviorKind = 'idle' | 'linear' | 'sinusoidal' | 'circular' | 'spin';

export interface BehaviorDescriptor {
  kind: BehaviorKind;
  speed?: number;
  amplitude?: number;
  frequency?: number;
  radius?: number;
  originX?: number;
  originY?: number;
  phase?: number;
  direction?: number;
}

export class BehaviorComponent implements Component {
  readonly type = BehaviorType;

  descriptor: BehaviorDescriptor;
  elapsed = 0;

  constructor(descriptor: BehaviorDescriptor) {
    this.descriptor = descriptor;
  }
}
