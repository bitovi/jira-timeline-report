# A confidence-aware dependency floor

Written 2026-09-13. Follows [dependency-floor.md](./dependency-floor.md) and the rail shipped in
[plans/2026-09-12-critical-path-rail.md](./plans/2026-09-12-critical-path-rail.md).

> **This document un-supersedes [dependency-floor.md](./dependency-floor.md) §2 "Outputs".**
>
> That section originally asked for exactly what is proposed here:
>
> > **Dependency floor**, per iteration — the length of that path. Keep all 10,000 and report at the
> > selected uncertainty percentile, so it's a real distribution and lines up with the grid.
>
> It was then superseded by `mockups/earliest-finish.html` §7 in favour of averages throughout,
> **so that the per-epic days-added figures sum exactly to the path length**. That was a deliberate,
> well-reasoned trade. This document argues the trade should be revisited now that the consequence is
> visible in the shipped UI — and §5 below is a direct attempt to keep both properties.

---

## 1. The bug

At any confidence setting other than **Average**, the rail prints a "floor" that is larger than the
plan finish sitting a few hundred pixels to its left:

| Where              | What it reads              |
| ------------------ | -------------------------- |
| Summary row        | `126–161 working days`     |
| Critical path rail | `Dependency floor 198.0 d` |

A floor 37 days _above_ the number it is supposedly a floor on reads as a straightforward defect. The
`FLOOR_TOOLTIP` in [`CriticalPathRail.tsx`](../../src/react/reports/AutoScheduler/CriticalPathRail/CriticalPathRail.tsx)
does say "Always an average. It does not follow the confidence slider," but that is hover-only text
doing the work of excusing a number that visibly contradicts the headline.

The two values are not comparable because they are different statistics of different distributions:

```js
// Summary row — an order statistic of the plan-finish distribution.
dueDayTop = sortedFinishes[round((n * p) / 100)];

// Rail — a mean, unconditionally.
floorDays = totalDaysSum / n;
```

[`summariseFloor`](../../src/react/reports/AutoScheduler/CriticalPathRail/dependency-floor.ts)
already recognises the mismatch and suppresses the **queueing** figure off-Average, because
`percentile − mean` is not a quantity. It does not suppress the floor itself, so the user is left
with the one number that can't be reconciled and without the one that would have explained it.

### Why the asymmetry is not the real problem

An obvious reading is "queueing is hidden but the floor isn't — make them consistent." That framing
is wrong. The floor is a standalone statistic and is perfectly well-defined on its own; queueing is a
_difference_ and genuinely isn't. The suppression rule is locally correct. The defect is that the
floor is being **displayed next to a number it cannot be compared with**, and hiding queueing removes
the only cue that would have made the mismatch legible.

---

## 2. Why this is fixable — the slider is a real order statistic

This whole proposal rests on one fact about how the slider works, and it is worth stating explicitly
because the alternative would sink it.

[`getUncertaintyThresholdData`](../../src/react/reports/AutoScheduler/scheduler/stats-analyzer.ts)
receives `endDaySimulation.dueDays = this.lastDays` — the sorted array of **per-iteration plan
finishes** — and indexes into it:

```js
const uncertaintyIndex = Math.min(Math.round((length * uncertaintyWeight) / 100), length - 1);
dueDayTop = simulationIssue.dueDays[uncertaintyIndex];
```

So the headline is a percentile **of the distribution of simulated finishes**. It is _not_ a schedule
re-derived from per-issue percentile durations.

That distinction is load-bearing. Had the slider worked the other way, the analogous floor would have
to be "the longest chain computed from per-issue p-th-percentile durations" — which is the sum-of-
quantiles fallacy and would overstate the chain badly (see §4). Because the slider is an order
statistic over whole-plan outcomes, the honest counterpart is an order statistic over whole-plan
chain lengths, and that is a legitimate quantity.

---

## 3. The floor stays a floor at every percentile

Not just "both are percentiles so they're comparable" — the _floor_ property is preserved, which is
what makes the label honest.

Within a single iteration, the longest chain ignores track contention, and contention can only ever
delay work. So per iteration:

```js
chainLength(j) <= planFinish(j); // true for every iteration j
```

Sorting preserves that, element by element:

```js
// If a[j] <= b[j] for every j, then after sorting both ascending,
// sortedA[i] <= sortedB[i] for every index i.
//
// Therefore, for any p:
percentile(chainLengths, p) <= percentile(planFinishes, p);
```

Two consequences:

1. **`Dependency floor` remains literally true at every slider position.** This is exactly the
   property broken today.
2. **Queueing becomes non-negative by construction at every setting**, so the `Math.max(0, …)` clamp
   in `summariseFloor` goes from a defensive fudge to provably dead code. It should be deleted, and
   its "something upstream is wrong" comment with it.

### One thing to not get wrong in the copy

```js
percentile(planFinishes, p) - percentile(chainLengths, p); // what we will show
percentile(
  planFinishes.map((f, j) => f - chainLength(j)),
  p,
); // a DIFFERENT number
```

Both are computable once the array is retained. The **difference of quantiles** is the right one for
this header, because it reconciles with the date on screen: "at this confidence, how much of that
date is contention?" The **quantile of differences** answers "how bad does queueing get?" — a
different question. The UI must not label the first as "the p-th percentile of queueing."

---

## 4. The cost — additivity in the epics table

This is the reason the original spec was superseded, and it does not go away.

### Why the table reconciles today

[`critical-path-accumulator.ts`](../../src/react/reports/AutoScheduler/scheduler/critical-path-accumulator.ts)
divides `daysAdded` by **every** iteration, not only the ones an epic appeared in. Unrolled:

```js
// The whole table, as a double loop over (epic, iteration).
let tableTotal = 0;
for (const k of allEpics) for (const j of allIterations) tableTotal += days(j, k) / N; // days(j,k) is 0 when k wasn't on the path in run j

// Swap the loop order — nothing changes, addition doesn't care about order.
for (const j of allIterations) for (const k of allEpics) tableTotal += days(j, k) / N;

// The inner loop is now just "the chain length for run j":
for (const j of allIterations) tableTotal += chainLength(j) / N; // === meanPathLength()
```

**Swapping the loop order is the entire trick**, and it works only because the operation is `+=`
followed by a divide. That is what the "deliberately divides by every iteration" comment is
protecting.

### Why a percentile breaks it

A percentile is a **sort-then-index**, and you cannot swap loops around a `sort`. Concretely, with
two anti-correlated epics:

| Iter | X   | Y   | chainLength |
| ---- | --- | --- | ----------- |
| 1    | 10  | 30  | **40**      |
| 2    | 30  | 10  | **40**      |
| 3    | 10  | 30  | **40**      |
| 4    | 30  | 10  | **40**      |

```js
percentile(chainLengths, 75); // [40,40,40,40] -> 40
percentile(xDays, 75) + percentile(yDays, 75); // 30 + 30       -> 60
```

The chain is **deterministically 40 days** — zero variance — yet naive per-epic percentiles claim 60.
The per-epic view assumes every epic runs long _simultaneously_, which is precisely what cancels out
along a chain. Flip the correlation (both long together, both short together) and the two agree
exactly. **So the error is a function of correlation structure**, which varies per plan and which a
per-epic column has no way to know. There is no per-epic correction factor.

### What the user would see

Taking the four-iteration example from §4 of this document at the 75% tick, where
`min(round(4 * 75 / 100), 3) = 3`:

> Dependency floor **60.0 d**
>
> | Epic | Days added |
> | ---- | ---------- |
> | X    | 20.0       |
> | Y    | 20.0       |

The column sums to 40 under a header saying 60. Today's defect at least _looks_ wrong. This one looks
fine until a reader adds up the column — which a column named "Days added" actively invites. **That
is trading a visible inconsistency for a subtler one**, and it is the whole reason to think carefully
here rather than just shipping the percentile.

---

## 5. Options

### Option A — percentile floor, mean table (hybrid)

Header follows the slider; the epics table keeps `meanPathLength` semantics and is explicitly
relabelled so it never claims to sum to the header (e.g. "Days added **(average)**", with the mean
floor shown in the table's own caption as the figure it sums to).

- **Pro:** smallest change; the floor/plan contradiction is fixed; additivity is preserved _against
  a stated anchor_.
- **Con:** two different statistics visible in one panel. Requires disciplined copy to stay honest.

### Option B — conditional subset (percentile-aware table)

Restore accumulate-then-divide, but over a subset of iterations instead of all of them:

```js
const target = percentile(chainLengths, p);
const S = allIterations.filter((j) => Math.abs(chainLength(j) - target) < tolerance);

function daysAddedAtPercentile(k) {
  let sum = 0;
  for (const j of S) sum += days(j, k);
  return sum / S.length; // divide by |S|, not N
}

// Additivity restored — it's a mean again, over a different sample:
//   sum over k of daysAddedAtPercentile(k) === average chainLength over S ≈ target
```

- **Pro:** header and table reconcile at _every_ slider position. Arguably more informative — at 90%
  the dominant route may be a different chain than at 50%, which is real signal.
- **Con:** `S` is a slice of the runs, so tail percentiles get noisy. `onPathIndex` ("On path %")
  must become conditional on `S` too or it will contradict the new `daysAdded`. **The table's rows
  change as the user drags the slider** — a genuine behaviour change, not a refactor. Needs a
  `tolerance` policy (fixed band? nearest _k_ runs? quantile bucket?) that is itself a design
  decision.

### Option C — status quo minus the contradiction

Keep everything mean-based; hide **both** floor and queueing off-Average and say so in the header
("floor unavailable at this confidence").

- **Pro:** trivial; nothing can be misread.
- **Con:** the panel goes blank for most slider positions, which is most of the time. Abandons the
  original §2 intent permanently.

---

## 6. Recommendation

**Option A now, Option B behind a follow-up.**

Option A removes the defect and is a contained change. Option B is the better end state but carries a
real UX question (slider-dependent table rows) plus a tolerance policy, and neither should be decided
by whoever happens to pick up the ticket. Option C is a reasonable fallback only if we decide the
floor isn't worth showing off-Average at all.

---

## 7. Cost

Effectively free, and **gating on panel state would not help**.

```js
// Per iteration:
pathLengths.push(path.totalDays); // one float

// Per batch (500 times) — the pattern lastDays already uses:
insertSortedArrayInPlace(pathLengths, batch.pathLengths);

// Per render:
pathLengths[Math.round((pathLengths.length * p) / 100)]; // O(1)
```

[`monte-carlo.ts`](../../src/react/reports/AutoScheduler/scheduler/monte-carlo.ts) defaults to
`batchSize = 20, batches = 500` → **10,000 iterations**.

- **Memory:** 10,000 floats ≈ 80 KB.
- **CPU:** one more sorted merge per batch. `StatsAnalyzer.onBatch` already merges `lastDays` **plus
  four arrays per issue**; at ~20 issues that is 81 sorted arrays already. This adds an 82nd.
- **Render:** reading a percentile is an array index, so `dataForUI()` — which runs on all 500
  batches — does not get slower.

### Gating is aimed at the wrong cost

`findLongestPath` is O(V+E) and, per its own doc comment, "runs once per Monte Carlo iteration
(10,000 times per simulation)" — **unconditionally, open panel or not**. Gating this change on panel
state would skip ~1% of the critical-path work while leaving 100% of the real cost in place.

The only meaningful lever is gating the whole subsystem, and [status.md](./status.md) already records
why that is awkward: the pass must run inside the iteration loop, because `onBatch` sorts each epic's
`daysOfWork` independently and destroys the per-iteration alignment. Since the accumulator builds up
across 500 batches, enabling it mid-run would leave no history for batches already completed — so it
would mean either restarting the simulation or silently reporting on a partial sample. If this is
ever worth doing, it belongs at `runMonteCarlo` start-up (off a persisted preference or flag), not as
a mid-run toggle.

**Conclusion: add `pathLengths` unconditionally.** It rides along with work already being done.

---

## 8. Decisions needed before implementation

1. **Option A, B, or C?** (§5). Recommendation is A.
2. If A: what exactly does the epics table's caption say, so that "Days added" never appears to sum
   to the header?
3. Does the collapsed spine show the percentile floor too, or stay on the mean? It currently shows
   `floor {n} d` and drops queueing for width.
4. Should the floor/queueing pair move out of the rail and into the Summary row? It is arguably the
   most decision-useful number in the feature (per dependency-floor.md §1) and is currently invisible
   until the user expands a panel that defaults closed.
5. Confirm the percentile index policy matches `getUncertaintyThresholdData` exactly
   (`min(round(n * p / 100), n - 1)`) so the floor and the plan finish are read off their arrays the
   same way. Any divergence here reintroduces off-by-one mismatches at the extremes.
