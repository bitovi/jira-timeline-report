# The dependency floor — the longest chain of epics, ignoring capacity

Written 2026-08-12. Third of three:

1. [model-explainer.md](./model-explainer.md) — how the current model works and why its output is
   wrong.
2. [shortening-leverage.md](./shortening-leverage.md) — ranking epics by which one, if shortened,
   pulls the plan in most. **Capacity-aware.**
3. **This document** — the longest sequence of epics from start to finish. **Capacity-blind.**

> **Partly superseded.** `mockups/earliest-finish.html` §7 was written later and overrides this
> document in two places, both marked inline below:
>
> - §2 "Outputs" asks for the dependency floor at the selected uncertainty percentile. The mockup
>   uses **averages throughout, not percentiles**.
> - §1 and §4 treat the contention gap as this report's headline. The mockup moves the gap to the
>   **capacity-aware** report, leaving this one to rank epics by days added.
>
> The implementation plan, `plans/2026-08-12-critical-path-epics.md`, follows the mockup.

---

## 1. Why this is a separate report, not a variant of the other one

[shortening-leverage.md](./shortening-leverage.md) answers _"given my actual teams, where's the best
single lever?"_ — and the answer is often about capacity, because capacity is usually what's binding.

This report answers a different question:

> **If nothing ever waited for a free track, how fast could this plan go — and what sequence of epics
> sets that floor?**

It's the textbook CPM critical path: the **longest path through the `Blocks` DAG, measured by summed
duration, with track contention ignored entirely.** In the same vocabulary, the schedule the
auto-scheduler already produces is Goldratt's _critical chain_ — the resource-constrained version.
The two reports are the two halves of a distinction the scheduling literature already draws, and the
folder is already named `024-critical-path`.

### Careful — "capacity" means two different things in this model

[`normalize.ts`](../../src/jira/normalized/normalize.ts) derives a team's rates like this:

```ts
const totalPointsPerDay = velocity / daysPerSprint;
const pointsPerDayPerTrack = totalPointsPerDay / parallelWorkLimit;
```

A team's throughput is fixed by `velocity`, and `parallelWorkLimit` **divides** it into lanes. So the
two knobs a user thinks of as "more capacity" do opposite things to this number:

| Change                              | Effect on the floor                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| Raise `velocity` (actually hire)    | **Lowers it** — every epic on that team gets shorter, path ones included      |
| Raise `parallelWorkLimit` (a track) | **Raises it** — the same throughput split more ways, so each epic runs slower |

So the floor is **not** "the plan with unlimited people," and it is not irreducible by staffing. It is
the plan with **unlimited lanes at today's per-epic durations** — the finish you'd get if no epic ever
queued for a track. The only thing it is truly immune to is _ordering_: no amount of resequencing or
reprioritising moves it. Everything else reaches it through durations — descope, split an epic, break
a `Blocks` link, tighten estimates on path epics, or raise a team's real throughput.

### The headline these two reports produce together

> **Superseded placement.** This section, and section 4, read as though the gap belongs on _this_
> report. `mockups/earliest-finish.html` §7 puts it on the **capacity-aware** report instead. The
> argument below for why the gap matters is unchanged; only where it is displayed has moved.

Run both and subtract. Using the same fixture as the other documents:

```
day:        0    5    10   15   20   25   30   35   40
            ├────┼────┼────┼────┼────┼────┼────┼────┤
Alpha   A:  [==== 10 d work ====]
Beta    X:  [============ 25 d work ============]
Beta    B:                      ....15 d queued....[== 15 d work ==]

            A Blocks B.  X is linked to nothing.
```

| Measure                                      | Value    |
| -------------------------------------------- | -------- |
| **Plan finish** (scheduled, capacity-bound)  | 40 d     |
| **Dependency floor** (longest chain `A → B`) | **25 d** |
| **Gap**                                      | **15 d** |

Fifteen of those forty days exist **only** because Beta has one track. There is no sequencing problem
here worth solving — `A → B` at 25 days is nearly half the plan already, and the rest is queueing.

Flip the ratio on a different plan — floor 180 d against a 200 d finish — and the advice inverts
completely: adding people buys you almost nothing, and the only way to move is to attack the chain.

**That ratio is the single most decision-useful number in the whole feature**, and it's precisely the
"cut dependencies or add capacity?" question the [README](./README.md) names as the most actionable
output of this work. Neither report produces it alone.

### The gap is a diagnosis, not a target

It is tempting to read a large gap as "add tracks until it closes." That is wrong, and the model
shows why. Team Beta at `velocity` 10 over a 10-day sprint, so `totalPointsPerDay = 1`. `A` (10 d,
team Alpha) blocks `B` (15 pts). `X` is 25 pts, unlinked, also on Beta.

| Beta's `parallelWorkLimit` | `pointsPerDayPerTrack` | `X`  | `B`  | Plan finish | Floor | Gap      |
| -------------------------- | ---------------------- | ---- | ---- | ----------- | ----- | -------- |
| 1                          | 1.0                    | 25 d | 15 d | 40 d        | 25 d  | **15 d** |
| 2                          | 0.5                    | 50 d | 30 d | **50 d**    | 50 d  | **0 d**  |

The gap closed completely and the plan got **ten days worse**. Nothing queues for a lane any more,
because the lanes were carved out of the same throughput and everything simply runs slower.

So the two numbers must be read together, and the honest remedies for a large gap are **rebalancing
work across teams** or **raising a team's velocity** — not raising `parallelWorkLimit`, which trades
queue time for duration at roughly par.

---

## 2. It has to be measured per iteration, not once

The obvious implementation is to compute the longest path once, using each epic's estimate. That is
what the codebase does today, and the [README](./README.md) already explains why it's wrong. Repeating
the case, because it's the whole justification for the extra work:

```
Path A:  10 days → [9 days, 9 days, 9 days in parallel] → 10 days
Path B:  10 days → 10 days → 10 days
```

Deterministically, A's middle stage is 9 days, so A totals 29 and B totals 30. **B ranks above A,
permanently, at every uncertainty setting.**

But A's middle stage doesn't finish in 9 days — it finishes when the _slowest of three_ finishes, and
`E[max]` of three draws exceeds their mean. With realistic variance, A is the longer pole often
enough to matter, and a single-shot computation can never see it.

So: recompute the longest path **inside each Monte Carlo iteration**, on that iteration's sampled
durations, and tally.

### Outputs

- **Sequencing criticality index**, per epic — the fraction of iterations in which it lay on the
  longest dependency path. Distinct from the capacity-aware criticality in the other documents; both
  can be shown, and disagreement between them is informative.
- **Dependency floor**, per iteration — the length of that path. Keep all 10,000 and report at the
  selected uncertainty percentile, so it's a real distribution and lines up with the grid.
  **Superseded:** `mockups/earliest-finish.html` §7 reports the mean instead — averages throughout,
  not percentiles — so that the per-epic days-added figures sum exactly to the path length.
- **Queued is zero by construction.** Capacity is ignored, so the path is pure work. This is the one
  chain in the feature where `span = work` exactly, which makes it a clean thing to display.

---

## 3. Implementation — the recurrence already exists

`setBlocksWorkDepthDeterministically` in
[`link-issues.ts`](../../src/react/reports/AutoScheduler/scheduler/link-issues.ts) is **already the
longest-path dynamic program**:

```ts
blocksWorkDepth(i) = duration(i) + max over j blocked by i of blocksWorkDepth(j)
```

That is the longest path forward from `i`, inclusive. Two things are wrong with it for our purposes,
and neither is the recurrence:

1. It runs **once**, at link time, so it can't see the parallel-branch effect above.
2. It uses `derivedTiming.deterministicTotalDaysOfWork`, which
   [`getEstimationData(issue, {})`](../../src/jira/derived/work-timing/work-timing.ts) computes at a
   hardcoded `uncertaintyWeight = 80`. So it's a **sum of per-item P80s** — which, as the README
   notes, is not a duration at all. The P80 of a sum is well below the sum of P80s.

The change is to run the same recurrence per iteration against
`mutableWorkItem.daysOfWork` — the freshly sampled value — instead of the frozen deterministic one.

- **Cost:** O(V + E) per iteration. The topological order is already established (`linkIssues` sorts
  by `blocksWorkDepth` and the scheduler relies on it), so it's one array pass plus one pass over
  links. Comparable to the backward trace, against a full schedule the iteration already pays for.
- **Recovering the path:** start at the epic with the maximum value — necessarily a source, since a
  predecessor's value always exceeds its successors' — then repeatedly step to the successor with the
  largest value. Needs the same issue-key tiebreak as the other walk so it doesn't jitter. This walk
  is **exact, not a heuristic**: within one iteration the values are true longest-path-forward
  lengths, so following the max recovers the real longest chain. (Contrast greedy descent over
  _cross-iteration_ criticality percentages, which is not exact — and which nothing here does.)
- **Where to run it:** `runBatch` pushes `daysOfWork` in iteration order, so within `batchData` index
  `i` identifies iteration `i` across every epic. `StatsAnalyzer.onBatch` then merges those with
  `insertSortedArrayInPlace`, which sorts each epic's array independently and destroys that alignment
  permanently. So this can run inside the scheduling loop **or** in `onBatch` over the already
  assembled batch arrays — but nowhere later. `onBatch` is attractive: no change to the hot loop, no
  extra memory, and it can be skipped entirely when the report isn't open.
- **Cycles:** the existing function has no visited set and would recurse forever on a `Blocks` cycle.
  It survives today only because such data would already have deadlocked the scheduler. Moving this
  into the hot loop is a good moment to make it fail safely.

---

## 4. What the report shows

### Rank epics, not paths

The natural design is a table of chains. It fragments. Forks multiply — five binary forks in series
produce 32 distinct routes, and if each wins about 3% of iterations the table becomes 32
near-identical rows carrying no signal.

Two rows are fine; a reader will spot `S→M1→E` and `S→M2→E` next to each other and add them up
themselves. Thirty-two are not. And fragmentation does something worse than look untidy: it **hides
junction epics**. Epics upstream and downstream of a fork lie on _every_ route through it, so their
importance is split across rows and never appears as a single number. Set that against a separate,
unforked chain `C1 → C2 → C3` winning 19%:

| Epic         | On the longest chain | Duration | Days of floor it owns |
| ------------ | -------------------- | -------- | --------------------- |
| `C1`         | 19%                  | 20 d     | 3.8 d                 |
| **`S`**      | **20%**              | **30 d** | **6.0 d**             |
| any mid-fork | ~0.6%                | 15 d     | 0.1 d                 |

`S` is the best single target in the plan, and it sits somewhere around row 33 of a path-sorted table
inside a wall of 1% rows. The user attacks `C1` instead — reasonable, visible, second best.

So the ranking unit is the **epic**, and the metric is _days of the floor it owns_.

### The metric, and why it's exact

Each iteration credits every epic on that iteration's longest path with the days it contributed:

```ts
onPathCount[key]++;
daysSum[key] += sampledDaysOfWork;
```

and the reported figure is `daysSum[key] / iterations`.

These numbers **sum exactly to the mean floor**. In any single iteration the floor _is_ the sum of the
durations along the winning path, so summing per epic and summing per iteration are the same total
rearranged:

$$\text{mean floor} \;=\; \frac{1}{N}\sum_{k}\;\sum_{i \in \text{path}_k} d_i(k) \;=\; \sum_i \underbrace{\frac{1}{N}\sum_{k\,:\,i \in \text{path}_k} d_i(k)}_{\text{days epic } i \text{ owns}}$$

It's an exact additive decomposition of the headline number, not an estimate of it. That kills the
clustering problem outright — no merging, no thresholds, no worrying whether a truncated list hid a
sibling. The summing a user would have had to do in their head is already done, per epic, exactly.

It is also the same formula as the capacity-aware metric in
[shortening-leverage.md](./shortening-leverage.md), computed over a different graph. Two reports, one
metric.

#### Worked example

`S` blocks `M1` and `M2`; both block `E`. Separately, `C1` blocks `C2`. Four iterations:

| Iter | S   | M1  | M2  | E   | C1  | C2  | `S→M1→E` | `S→M2→E` | `C1→C2` | Winner   | Floor |
| ---- | --- | --- | --- | --- | --- | --- | -------- | -------- | ------- | -------- | ----- |
| 1    | 10  | 22  | 18  | 10  | 14  | 16  | **42**   | 38       | 30      | `S→M1→E` | 42    |
| 2    | 9   | 19  | 24  | 11  | 15  | 15  | 39       | **44**   | 30      | `S→M2→E` | 44    |
| 3    | 11  | 18  | 17  | 9   | 20  | 22  | 38       | 37       | **42**  | `C1→C2`  | 42    |
| 4    | 10  | 25  | 20  | 10  | 16  | 14  | **45**   | 40       | 30      | `S→M1→E` | 45    |

| Epic | Won on  | Days credited     | ÷ 4 = days owned |
| ---- | ------- | ----------------- | ---------------- |
| `M1` | 1, 4    | 22 + 25 = 47      | **11.75**        |
| `E`  | 1, 2, 4 | 10 + 11 + 10 = 31 | **7.75**         |
| `S`  | 1, 2, 4 | 10 + 9 + 10 = 29  | **7.25**         |
| `M2` | 2       | 24                | **6.00**         |
| `C2` | 3       | 22                | **5.50**         |
| `C1` | 3       | 20                | **5.00**         |
|      |         |                   | **43.25**        |

Mean floor = (42 + 44 + 42 + 45) / 4 = **43.25**. The column sums to the headline.

Note `E` — a small 10-day epic — outranking `M2` and both `C` epics purely because it sits downstream
of every fork. That is exactly the junction effect a path table cannot show.

### The layout

> **Earliest possible finish: 43 d.** Plan finishes in 60 d — **17 d is track contention.**

| Epic | Days of the floor | On longest chain |
| ---- | ----------------- | ---------------- |
| `M1` | 11.8 d            | 50%              |
| `E`  | 7.8 d             | 75%              |
| `S`  | 7.3 d             | 75%              |
| `M2` | 6.0 d             | 25%              |

And beneath it, the most frequent routes — as narrative, not as ranking:

| Common route | Share |
| ------------ | ----- |
| `S → M1 → E` | 50%   |
| `S → M2 → E` | 25%   |
| `C1 → C2`    | 25%   |

Because the epic table carries the ranking, this list can be capped at a handful of rows without
hiding anything that matters. Fragmentation becomes cosmetic. Build it as a plain frequency `Map`
keyed on the joined issue keys.

### The one caveat

"Days owned" is a **marginal** measure. Shave `M1` by 10% and the floor really does drop by 1.18 d —
0.1 × 11.75, verifiable iteration by iteration in the table above.

Delete `M1` entirely and the floor does **not** drop by 11.75, because `S→M2→E` takes over as the
winner. Returns flatten as soon as the runner-up catches up. The number answers _"if I trimmed this a
bit, what would I get?"_ — not _"what if this vanished?"_ Same caveat, and the same reason, as the
capacity-aware metric.

---

## 5. How the two reports pair up

|                             | **Dependency floor** (this doc)         | **Shortening leverage** ([other doc](./shortening-leverage.md)) |
| --------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| Question                    | How fast if nothing waited for a track? | Given my teams, what's the best single lever?                   |
| Sees track contention       | No                                      | Yes                                                             |
| Ranking unit                | Epics (chains shown as context)         | Epics                                                           |
| Queued time                 | Zero by definition                      | Central                                                         |
| Remedy it points to         | Break links, split epics, descope       | Rebalance across teams, raise a team's velocity                 |
| Answer can be off any chain | No                                      | **Yes** (the `X` case)                                          |

They're complements, not alternatives, and the gap between them is the headline. Building only one
leaves the user unable to tell a sequencing problem from a staffing one — which is the actual
complaint that started 024. Note that neither report speaks to `parallelWorkLimit`: as shown above,
lane count is a third axis that trades queueing against duration, and both metrics hold durations
fixed.

---

## 6. Tests

| Test                                 | Asserts                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------ |
| §1 fixture                           | dependency floor is 25 d against a 40 d finish; gap reported as 15 d     |
| §1 fixture                           | `X` has sequencing criticality 0 — it's linked to nothing                |
| README A/B fixture, confidence < 100 | A's chain outranks B's — the defect the deterministic version can't see  |
| README A/B fixture, confidence = 100 | B outranks A, since with no variance the deterministic answer is correct |
| single chain, no capacity pressure   | floor equals plan finish; gap is 0                                       |
| heavily capacity-bound plan          | floor is far below plan finish; gap dominates                            |
| §4 diamond fixture                   | `S` and `E` have sequencing criticality 1.0; `M1` and `M2` each ≈0.5     |
| §4 diamond fixture                   | floor ≈ 10 + E[max(M1, M2)] + 10, strictly greater than 10 + 20 + 10     |
| **any fixture**                      | **sum of every epic's "days owned" equals the mean floor, to tolerance** |
| §4 diamond fixture                   | scaling `M1` to 0.9× drops the mean floor by ≈0.1 × `M1`'s days owned    |
| §1 track fixture, 1 vs 2 tracks      | doubling `parallelWorkLimit` closes the gap **and** raises the finish    |
| cycle fixture                        | terminates rather than recursing forever                                 |
| tie fixture                          | identical chain selected across repeated runs                            |

The last two are the same hazards `traceDrivingChain` has, and `setBlocksWorkDepthDeterministically`
currently handles neither.
