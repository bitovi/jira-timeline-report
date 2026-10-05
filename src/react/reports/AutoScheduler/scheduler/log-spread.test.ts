import { describe, it, expect } from 'vitest';
import { computeLogSpread, percentile } from './log-spread';

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

/** Evenly spaced probabilities through the lognormal quantile function → a near-exact sample. */
function lognormalSample(mu: number, sigma: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.exp(mu + sigma * inverseNormalCdf((i + 0.5) / n))).sort(
    (a, b) => a - b,
  );
}

describe('computeLogSpread', () => {
  it('returns null with fewer than two positive samples', () => {
    expect(computeLogSpread([])).toBeNull();
    expect(computeLogSpread([5])).toBeNull();
    expect(computeLogSpread([0, 0, -1])).toBeNull();
  });

  it('recovers sigma and the median from a lognormal sample', () => {
    const samples = lognormalSample(Math.log(120), 0.35, 1000);

    const spread = computeLogSpread(samples)!;

    expect(spread.sigma).toBeCloseTo(0.35, 2);
    expect(spread.median).toBeCloseTo(120, 0);
    expect(spread.sampleCount).toBe(1000);
  });

  it('reports the quartiles sigma was measured from', () => {
    const samples = lognormalSample(Math.log(90), 0.2, 1000);

    const spread = computeLogSpread(samples)!;

    expect(spread.q25).toBeCloseTo(percentile(samples, 25), 10);
    expect(spread.q75).toBeCloseTo(percentile(samples, 75), 10);
    expect(spread.q25).toBeLessThan(spread.median);
    expect(spread.q75).toBeGreaterThan(spread.median);
  });

  it('reports gsd as exp(sigma)', () => {
    const spread = computeLogSpread(lognormalSample(Math.log(50), 0.5, 500))!;

    expect(spread.gsd).toBeCloseTo(Math.exp(spread.sigma), 12);
    expect(spread.gsd).toBeGreaterThan(1);
  });

  it('maps sigma to the same confidence the per-issue calibration uses', () => {
    // Confidence 70 corresponds to sigma = (100 - 70) * (1.3 / 90).
    const sigma = 30 * (1.3 / 90);

    const spread = computeLogSpread(lognormalSample(Math.log(50), sigma, 2000))!;

    expect(spread.confidence).toBeCloseTo(70, 0);
  });

  it('clamps confidence to [0, 100]', () => {
    const tight = computeLogSpread([100, 100, 100])!;
    expect(tight.sigma).toBe(0);
    expect(tight.gsd).toBe(1);
    expect(tight.confidence).toBe(100);

    // Spread beyond the calibration's low-confidence anchor would map below zero.
    const wide = computeLogSpread(lognormalSample(Math.log(100), 2, 2000))!;
    expect(wide.confidence).toBe(0);
  });

  it('is barely moved by a single extreme outlier', () => {
    // The property that motivates the quantile estimator over the plug-in MLE: the plan finish is a
    // maximum, so runaway samples in the upper tail are expected and must not dominate the spread.
    const samples = lognormalSample(Math.log(90), 0.15, 1000);
    const withOutlier = [...samples, 100_000].sort((a, b) => a - b);

    const clean = computeLogSpread(samples)!;
    const contaminated = computeLogSpread(withOutlier)!;

    expect(contaminated.sigma).toBeCloseTo(clean.sigma, 2);

    const mleSigma = (values: number[]) => {
      const logs = values.map(Math.log);
      const mu = logs.reduce((sum, l) => sum + l, 0) / logs.length;
      return Math.sqrt(logs.reduce((sum, l) => sum + (l - mu) ** 2, 0) / logs.length);
    };
    // Same contamination roughly doubles the MLE.
    expect(mleSigma(withOutlier)).toBeGreaterThan(mleSigma(samples) * 1.5);
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
