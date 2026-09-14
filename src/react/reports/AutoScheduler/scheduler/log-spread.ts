import { toConfidenceFromStandardDeviations } from '../../../../utils/math/confidence';

/** Interquartile range of a standard normal, `2 * inverseNormalCdf(0.75)`. Rescales an IQR to an SD. */
const NORMAL_IQR = 1.3489795003921634;

export interface LogSpread {
  /** Number of positive samples measured. */
  sampleCount: number;
  /** Median finish, in working days. */
  median: number;
  /** Robust estimate of the standard deviation of ln(days), from the log interquartile range. */
  sigma: number;
  /** exp(sigma) — the geometric standard deviation. 1 means every run finished on the same day. */
  gsd: number;
  /** Middle 50% of runs, in working days — the band `sigma` was measured from. */
  q25: number;
  q75: number;
  /**
   * `sigma` remapped onto the 0–100 per-issue confidence scale (see
   * {@link toConfidenceFromStandardDeviations}). Clamped to [0, 100] because a plan spread wider
   * than the calibration's low-confidence anchor would otherwise map to a negative value.
   */
  confidence: number;
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
 * Measures the multiplicative spread of a set of completion-day samples as a geometric standard
 * deviation, plus the equivalent value on the per-issue confidence scale.
 *
 * This is a sample statistic, not a fit — `sd(ln x)` is defined for any set of positive numbers, so
 * there is no shape assumption to violate and no goodness-of-fit gate. That matters because the plan
 * finish is a *maximum* over competing chains, which is not lognormal even though each chain's own
 * finish approximately is.
 *
 * `sigma` comes from the log interquartile range rather than the plug-in MLE. The MLE is ~2.7x more
 * efficient on clean lognormal data, but gives every sample equal leverage, and a maximum
 * manufactures tail outliers by construction. At simulation sample sizes the efficiency is free and
 * the robustness is not.
 *
 * @param sortedPositiveDays Ascending-sorted completion-day samples (the simulation's `lastDays`).
 * @returns The spread, or `null` when there are fewer than two positive samples.
 */
export function computeLogSpread(sortedPositiveDays: number[]): LogSpread | null {
  const positive = sortedPositiveDays.filter((day) => day > 0);
  if (positive.length < 2) return null;

  const median = percentile(positive, 50);
  const q25 = percentile(positive, 25);
  const q75 = percentile(positive, 75);

  // Short-circuit rather than take the log of a zero-width band.
  const sigma = q75 === q25 ? 0 : (Math.log(q75) - Math.log(q25)) / NORMAL_IQR;

  return {
    sampleCount: positive.length,
    median,
    sigma,
    gsd: Math.exp(sigma),
    q25,
    q75,
    confidence: Math.min(100, Math.max(0, toConfidenceFromStandardDeviations({ standardDeviations: sigma }))),
  };
}
