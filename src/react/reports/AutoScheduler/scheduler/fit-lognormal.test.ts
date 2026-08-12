import { describe, it, expect } from 'vitest';
import { fitLognormal, percentile } from './fit-lognormal';

describe('percentile', () => {
  it('returns NaN for an empty array', () => {
    expect(percentile([], 50)).toBeNaN();
  });

  it('returns the only value for a single-element array', () => {
    expect(percentile([7], 80)).toBe(7);
  });

  it('interpolates between ranks', () => {
    const sorted = [0, 10, 20, 30, 40];
    expect(percentile(sorted, 0)).toBe(0);
    expect(percentile(sorted, 100)).toBe(40);
    expect(percentile(sorted, 50)).toBe(20);
    expect(percentile(sorted, 80)).toBeCloseTo(32, 10);
  });

  it('clamps out-of-range percentiles', () => {
    const sorted = [1, 2, 3];
    expect(percentile(sorted, -10)).toBe(1);
    expect(percentile(sorted, 200)).toBe(3);
  });
});

describe('fitLognormal', () => {
  it('returns null with fewer than two positive samples', () => {
    expect(fitLognormal([])).toBeNull();
    expect(fitLognormal([5])).toBeNull();
    expect(fitLognormal([0, 0, -1])).toBeNull();
  });

  it('recovers mu and sigma from a symmetric two-point sample', () => {
    // logs are mu ± sigma → population mean = mu, population std = sigma.
    const mu = Math.log(100);
    const sigma = 0.4;
    const samples = [Math.exp(mu - sigma), Math.exp(mu + sigma)].sort((a, b) => a - b);

    const fit = fitLognormal(samples)!;

    expect(fit.mu).toBeCloseTo(mu, 10);
    expect(fit.sigma).toBeCloseTo(sigma, 10);
    expect(fit.median).toBeCloseTo(100, 8);
    expect(fit.sampleCount).toBe(2);
  });

  it('maps sigma to the same confidence the per-issue calibration uses', () => {
    // Confidence 70 corresponds to sigma = (100 - 70) * (1.3 / 90).
    const sigma = 30 * (1.3 / 90);
    const mu = Math.log(50);
    const samples = [Math.exp(mu - sigma), Math.exp(mu + sigma)].sort((a, b) => a - b);

    const fit = fitLognormal(samples)!;

    expect(fit.confidence).toBeCloseTo(70, 6);
  });

  it('clamps confidence to [0, 100]', () => {
    // Zero spread → maximum confidence.
    const tight = fitLognormal([100, 100, 100])!;
    expect(tight.sigma).toBe(0);
    expect(tight.confidence).toBe(100);

    // Very wide spread → sigma beyond the calibration floor, clamped up from negative.
    const mu = Math.log(100);
    const wide = fitLognormal([Math.exp(mu - 2), Math.exp(mu + 2)])!;
    expect(wide.confidence).toBe(0);
  });

  it('flags a bimodal distribution as a poor fit', () => {
    const lowCluster = new Array(100).fill(1); // log = 0
    const highCluster = new Array(100).fill(Math.exp(4)); // log = 4
    const samples = [...lowCluster, ...highCluster];

    const fit = fitLognormal(samples)!;

    expect(fit.isFitGood).toBe(false);
    expect(fit.fitError).toBeGreaterThan(0.2);
  });

  it('accepts a genuinely lognormal sample as a good fit', () => {
    // Evenly spaced probabilities mapped through the lognormal quantile function
    // produce a near-perfect lognormal sample.
    const mu = Math.log(120);
    const sigma = 0.35;
    const n = 500;
    const samples = Array.from({ length: n }, (_, i) => {
      const p = (i + 0.5) / n;
      return Math.exp(mu + sigma * inverseNormalCdf(p));
    }).sort((a, b) => a - b);

    const fit = fitLognormal(samples)!;

    expect(fit.mu).toBeCloseTo(mu, 1);
    expect(fit.sigma).toBeCloseTo(sigma, 1);
    expect(fit.isFitGood).toBe(true);
  });
});

/** Acklam's rational approximation of the standard-normal quantile function (test helper). */
function inverseNormalCdf(p: number): number {
  const a = [
    -39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924,
  ];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [
    -0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878,
  ];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}
