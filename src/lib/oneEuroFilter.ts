/**
 * 1-Euro Filter for 1D and 3D signal smoothing.
 * Reference: Géry Casiez, Nicolas Roussel, Daniel Vogel (2012)
 */

class LowPassFilter {
  private hatXPrev: number | null = null;

  filter(x: number, alpha: number): number {
    if (this.hatXPrev === null) {
      this.hatXPrev = x;
      return x;
    }
    const hatX = alpha * x + (1 - alpha) * this.hatXPrev;
    this.hatXPrev = hatX;
    return hatX;
  }

  reset() {
    this.hatXPrev = null;
  }
}

export class OneEuroFilter1D {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private lastTime: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  filter(x: number, timestamp: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return this.xFilter.filter(x, 1.0);
    }

    const dt = Math.max((timestamp - this.lastTime) / 1000.0, 0.001);
    this.lastTime = timestamp;

    const prevX = (this.xFilter as any).hatXPrev ?? x;
    const dx = (x - prevX) / dt;
    const edx = this.dxFilter.filter(dx, this.alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);

    return this.xFilter.filter(x, this.alpha(cutoff, dt));
  }

  reset() {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}

export class OneEuroFilter3D {
  private fx: OneEuroFilter1D;
  private fy: OneEuroFilter1D;
  private fz: OneEuroFilter1D;

  constructor(
    minCutoffXY = 1.0,
    betaXY = 0.02,
    minCutoffZ = 0.5,
    betaZ = 0.04,
    dCutoff = 1.0
  ) {
    this.fx = new OneEuroFilter1D(minCutoffXY, betaXY, dCutoff);
    this.fy = new OneEuroFilter1D(minCutoffXY, betaXY, dCutoff);
    this.fz = new OneEuroFilter1D(minCutoffZ, betaZ, dCutoff);
  }

  filter(x: number, y: number, z: number, timestamp = performance.now()): [number, number, number] {
    return [
      this.fx.filter(x, timestamp),
      this.fy.filter(y, timestamp),
      this.fz.filter(z, timestamp),
    ];
  }

  reset() {
    this.fx.reset();
    this.fy.reset();
    this.fz.reset();
  }
}
