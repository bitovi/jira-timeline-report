import { toConfidenceFromStandardDeviations } from '../../../../utils/math/confidence';

export interface LognormalFit {
  /** Number of positive samples the fit was computed from. */
  sampleCount: number;
  /** Mean of ln(x) — the log-scale location. The fitted median is e^mu. */
  mu: number;
  /** Standard deviation of ln(x) — the log-scale spread the confidence is derived from. */
  sigma: number;
  /** Fitted lognormal median in days (= e^mu, the geometric mean of the samples). */
  median: number;
  /**
   * Composite confidence 0–100, derived from `sigma` using the same calibration the
   * per-issue confidence uses (see {@link toConfidenceFromStandardDeviations}). Clamped
   * to [0, 100] because a plan spread wider than the calibration's low-confidence anchor
   * would otherwise map to a negative value.
   */
  confidence: number;
  /**
   * Kolmogorov–Smirnov statistic between the empirical samples and the fitted lognormal
   * CDF (0 = perfect fit, larger = worse). Flags distributions a single lognormal can't
   * describe well — e.g. multimodal completion times from competing critical paths.
   */
  fitError: number;
  /** True when `fitError` is within `maxFitError`, i.e. the lognormal is a fair description. */
  isFitGood: boolean;
}

/** Standard normal CDF via the Abramowitz & Stegun 7.1.26 erf approximation (max error ~1.5e-7). */
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/**
 * Returns the value at percentile `p` (0–100) of an ascending-sorted array using linear
 * interpolation between the two nearest ranks.
 */
export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return NaN;
  if (sortedValues.length === 1) return sortedValues[0];
  const clampedP = Math.min(100, Math.max(0, p));
  const rank = (clampedP / 100) * (sortedValues.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sortedValues[low];
  return sortedValues[low] + (rank - low) * (sortedValues[high] - sortedValues[low]);
}

/**
 * Maximum-likelihood fit of a lognormal distribution to a set of completion-day samples,
 * translated into a composite confidence on the same 0–100 scale the per-issue estimates use.
 *
 * The MLE parameters are just the mean and standard deviation of the sample logs, so this is
 * closed-form (no optimizer). `sigma` is independent of the samples' scale, so it maps directly
 * to a confidence via the shared calibration.
 *
 * @param sortedPositiveDays Ascending-sorted completion-day samples (the simulation's `lastDays`).
 * @returns The fit, or `null` when there are fewer than two positive samples to fit.
 */
export function fitLognormal(sortedPositiveDays: number[], { maxFitError = 0.05 } = {}): LognormalFit | null {
  const positive = sortedPositiveDays.filter((day) => day > 0);
  if (positive.length < 2) return null;

  const logs = positive.map(Math.log);
  const mu = logs.reduce((sum, l) => sum + l, 0) / logs.length;
  const variance = logs.reduce((sum, l) => sum + (l - mu) ** 2, 0) / logs.length;
  const sigma = Math.sqrt(variance);

  const confidence = Math.min(100, Math.max(0, toConfidenceFromStandardDeviations({ standardDeviations: sigma })));

  // Kolmogorov–Smirnov: largest gap between the empirical CDF and the fitted lognormal CDF.
  let fitError = 0;
  const n = positive.length;
  for (let i = 0; i < n; i++) {
    const fitted = sigma === 0 ? (logs[i] < mu ? 0 : 1) : normalCdf((logs[i] - mu) / sigma);
    fitError = Math.max(fitError, Math.abs(fitted - i / n), Math.abs(fitted - (i + 1) / n));
  }

  return {
    sampleCount: n,
    mu,
    sigma,
    median: Math.exp(mu),
    confidence,
    fitError,
    isFitGood: fitError <= maxFitError,
  };
}
