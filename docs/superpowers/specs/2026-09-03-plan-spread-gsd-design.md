# Auto Scheduler plan spread (GSD) — design

**Date:** 2026-09-03
**Status:** Awaiting review

## Problem

The Auto Scheduler's Summary row is supposed to tell you how uncertain the plan's finish date is. On
many real plans it instead reads `Confidence: n/a`, and during a run it visibly flickers between a
number and `n/a` before settling on `n/a` permanently.

The cause is structural, not a bug in the arithmetic.
`src/react/reports/AutoScheduler/scheduler/fit-lognormal.ts` fits a lognormal to the whole-plan
finish days, measures a Kolmogorov–Smirnov statistic against that fit, and suppresses the number
whenever `fitError > 0.05`. But the plan finish computed in `monte-carlo.ts` is

```
lastDay = max over chains (finish of that chain)
```

A maximum of lognormals is not lognormal. Along a single chain the finish is a _sum_ of positive
durations and is approximately lognormal (Fenton–Wilkinson); across competing chains it is a
mixture, and its CDF has a kink no single lognormal can follow. Simulating an 86/14 two-chain split
(the criticality weights this report currently shows for `issue in (IMP-99, IMP-100)`) gives a KS
statistic of ~0.105 at every sample size tested from n=100 to n=10,000, against a threshold of 0.05.
The gate can never pass for such a plan.

The flicker is a second, independent defect in the same gate:

1. **KS with estimated parameters is invalid.** KS critical values assume μ and σ are known a
   priori. `fitLognormal` plugs in MLEs from the same data, which makes the statistic stochastically
   smaller; the correct reference is the Lilliefors distribution, not the KS table.
2. **The 0.05 threshold ignores n.** `dataForUI()` refits after every 20-run batch, so the first few
   evaluations are dominated by sampling noise and cross the fixed threshold at random.

## Goals

- A measure of finish-date spread that is **always available** — no shape gate, no `n/a`.
- Expressed in a form statistically literate users recognise on sight.
- Reconcilable with the per-issue confidence number people already reason about.

## Non-goals

- Distinguishing "wide because two competing chains" from "wide because of diffuse uncertainty". A
  single scalar cannot do this and we are accepting that. The Critical Paths card already surfaces
  the competing-chain structure separately.
- Changing the date-window range selector. That already exists and is unaffected.
- Changing per-issue confidence, its storage, or its team configuration.

## Background

### The confidence scale is already a log-spread scale

`src/utils/math/confidence.js` maps confidence to a lognormal σ with a straight line —
confidence 100 → σ = 0, confidence 10 → σ = 1.3:

```
σ = (100 − confidence) · (1.3 / 90)
confidence = 100 − σ · (90 / 1.3)
```

So "confidence" in this codebase is a relabelling of log-scale spread. Nothing about _computing_
that spread requires the data to be lognormal — `sd(ln x)` is a sample statistic defined for any set
of positive numbers. The lognormal assumption only buys the _interpretation_ (the 68%/95% interval
labels). That is precisely why the current gate is over-reaching: it suppresses a valid spread
measurement in order to protect an interpretation nobody asked for.

### Geometric standard deviation

For positive, multiplicatively-varying data the standard dispersion measure is the geometric
standard deviation:

```
GSD = exp( sd(ln x) )
```

It is dimensionless and ≥ 1, so it is directly comparable between a three-week plan and a
three-year one, and 1.00 means every run finished on the same day. It is the conventional reporting
form in pharmacokinetics, aerosol science, particle sizing and reliability. The `×/÷` notation
proposed by Limpert, Stahel & Abbt (2001) is _not_ widely recognised and will not be used as the
primary label; the plain `GSD` label is.

## Design

### 1. New module: `scheduler/log-spread.ts`

Replaces `scheduler/fit-lognormal.ts`.

```ts
export interface LogSpread {
  /** Number of positive samples measured. */
  sampleCount: number;
  /** Median finish, in working days. */
  median: number;
  /** Robust estimate of sd(ln days), from the log interquartile range. */
  sigma: number;
  /** exp(sigma). 1 = every run finished on the same day. */
  gsd: number;
  /** Middle 50% of runs, in working days — the band `sigma` was measured from. */
  q25: number;
  q75: number;
  /** `sigma` remapped onto the 0–100 per-issue confidence scale, clamped to [0, 100]. */
  confidence: number;
}

export function computeLogSpread(sortedPositiveDays: number[]): LogSpread | null;
```

Estimator:

```
σ̂ = ( ln(q75) − ln(q25) ) / 1.3489795003921634
```

The divisor is the interquartile range of a standard normal, `2 · Φ⁻¹(0.75)`. It rescales an IQR
back into an SD, making σ̂ a consistent estimator of `sd(ln x)` when the data is lognormal.

**Why quantiles rather than the plug-in MLE.** The MLE (`sd` of the logs, what `fitLognormal` uses
today) is more efficient — roughly 2.7× — on clean lognormal data, but gives every sample equal
leverage. The plan finish is a _maximum_, which manufactures tail outliers by construction. With
10,000 samples the efficiency is free and the robustness is not.

Behaviour:

- Filters to `day > 0` before taking logs (`ln 0` is `−∞`). Same guard `fitLognormal` has today.
- Returns `null` below 2 positive samples.
- When `q25 === q75`, short-circuits to `sigma: 0, gsd: 1, confidence: 100` rather than taking a log
  of a zero-width band.
- `confidence` reuses `toConfidenceFromStandardDeviations` and keeps the existing `[0, 100]` clamp,
  since a spread wider than the calibration's low-confidence anchor would otherwise go negative.

`percentile()` moves across from `fit-lognormal.ts` unchanged. It is currently exercised only by its
own test and has no production caller; this gives it one.

**Deleted:** `fitLognormal`, `normalCdf`, the KS loop, `isFitGood`, `maxFitError`, `LognormalFit`,
and the corresponding cases in `fit-lognormal.test.ts`. Nothing outside that file and its test
imports them.

No minimum-sample gate. Unlike a threshold test there is nothing to cross, so early batches settle
smoothly toward the final value instead of flickering.

### 2. Wiring: `scheduler/stats-analyzer.ts`

`dataForUI()` replaces

```ts
const fit = fitLognormal(this.lastDays);
const overallConfidence = fit && { confidence: fit.confidence, isFitGood: fit.isFitGood };
```

with

```ts
const planSpread = computeLogSpread(this.lastDays);
```

and returns `planSpread` in place of `overallConfidence`. `this.lastDays` is already maintained in
ascending order by `insertSortedArrayInPlace`, which is what `percentile()` requires.

### 3. Display: `AutoScheduler.tsx` Summary row

The row is `flex flex-row-reverse`, so DOM order runs right to left. Rendered result:

> **91 working days · average** **GSD 1.18** **Confidence: 88%**

(Numbers illustrative — 91 days is the current reading for this plan; the rest depend on the
measured spread.)

Tooltip on `GSD 1.18`:

> Geometric standard deviation — the multiplicative spread of simulated finish dates (×÷ 1.18 around
> the median, the multiplicative analogue of ±). The middle 50% of runs finish in 84–99 working days.

Tooltip on `Confidence: 88%`:

> The same spread expressed on the 0–100 scale used for per-issue confidence.

Both tooltip claims are exact and make no assumption about distribution shape. The "middle 50%"
phrasing is the empirical interquartile range — the same `q25`/`q75` σ̂ was derived from — rather
than the `GM ×÷ GSD` band, which would be a lognormal-shape assertion.

GSD renders to 2 decimal places; confidence to 0, as today.

**Incidental fix.** Today the whole block is gated on `uiData.overallConfidence &&`, so when the fit
returned `null` the `91 working days · average` text disappeared along with the confidence. The plan
estimate does not depend on the spread measurement, so it will now render unconditionally and only
the two spread figures will be conditional on `planSpread`.

## Testing

`log-spread.test.ts`:

- `percentile` — the four existing cases move over unchanged.
- Returns `null` for empty, single-sample, and all-non-positive input.
- Recovers a known σ from a synthetic lognormal sample within tolerance.
- `gsd === Math.exp(sigma)`.
- `confidence` matches `toConfidenceFromStandardDeviations({ standardDeviations: sigma })` and is
  clamped at both ends.
- Zero-spread input (all samples identical) → `gsd: 1, confidence: 100`, no `NaN`.
- **Robustness characterisation:** appending one extreme outlier to a clean sample moves `sigma`
  substantially less than the plug-in MLE would. This is the property that motivated the quantile
  estimator, so it should be pinned.

`AutoScheduler` renders both figures and never renders `n/a`.

## Risks

- **Users who learned to read `Confidence: n/a` as "this plan is bimodal"** lose that signal. Judged
  acceptable: it was never labelled as such, the tooltip described it as a fit failure, and the
  Critical Paths card states the competing-chain split directly and in more detail.
- **A pooled GSD understates the risk of a strongly bimodal plan** — it describes neither branch. The
  number is still honest about the range being wide; it just cannot attribute the width. Explicitly
  accepted in Non-goals.
- **`GSD` is unfamiliar to non-statistical readers.** Mitigated by showing confidence alongside it
  and defining GSD in the tooltip.
