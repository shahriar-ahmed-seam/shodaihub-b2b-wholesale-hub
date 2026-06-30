/** Injectable clock so time-dependent logic (lockout, expiry) is deterministic in tests. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};

/** A controllable clock for tests. */
export class FixedClock implements Clock {
  constructor(private current: number) {}
  now(): number {
    return this.current;
  }
  set(value: number): void {
    this.current = value;
  }
  advance(ms: number): void {
    this.current += ms;
  }
}
