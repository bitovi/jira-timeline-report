# Shortening leverage — ranking epics by how much cutting them pulls the plan in

Written 2026-08-12. Depends on [model-explainer.md](./model-explainer.md) — read that first for
what the simulation does, what the backward walk is, and what _span_, _work_ and _queued_ mean.

This report is **capacity-aware**. Its capacity-blind complement — the longest chain of epics
ignoring teams entirely — is [dependency-floor.md](./dependency-floor.md). Both are needed; see that
document's §5 for how they pair up.

---

## 1. The reframing

The report was built to answer:

> Which chain of epics is deciding my finish date?

What a user actually wants:

> **Which single epic, if I shortened it, would pull the whole plan in the most — and is the reason
> capacity or sequencing?**

These are not the same question. The second is strictly more useful, it is directly answerable from
data the simulation already produces, and — critically — **its answer is not always on a dependency
chain.**

### The example that shows the difference

Straight from [model-explainer.md](./model-explainer.md) §2. `A` blocks `B`. `X` blocks nothing and
is blocked by nothing; it just happens to share Beta's single track with `B`.

```
day:        0    5    10   15   20   25   30   35   40
            ├────┼────┼────┼────┼────┼────┼────┼────┤
Alpha   A:  [==== 10 d work ====]
Beta    X:  [============ 25 d work ============]
Beta    B:                      ....15 d queued....[== 15 d work ==]
```

Plan finishes day 40. Now cut each epic by 10% and see what actually happens:

| Cut          | By    | Effect                                                  | Plan finishes | **Saved** |
| ------------ | ----- | ------------------------------------------------------- | ------------- | --------- |
| **X** (25 d) | 2.5 d | X ends day 22.5 → Beta frees up → B starts 22.5         | 37.5          | **2.5 d** |
| **B** (15 d) | 1.5 d | B still starts day 25 (Beta busy), ends 38.5            | 38.5          | **1.5 d** |
| **A** (10 d) | 1.0 d | A ends day 9; B was never waiting on A, still starts 25 | 40            | **0 d**   |

**`X` is the best epic to shorten, and `X` is on no dependency chain at all.** Every dependency-only
model in the codebase — the old `blocksWorkDepth` report and the current `traceDrivingChain` — is
structurally incapable of naming it. Meanwhile `A`, which _is_ a genuine `Blocks` predecessor of a
critical epic, is worth exactly nothing.

This is what the user's instinct was pointing at: sometimes the constraint is **capacity** (X hogging
Beta) and sometimes it's **sequencing** (a long chain you'd want to break up). A useful report has to
detect which, not assume one.

---

## 2. The metric

### The claim

With **capacity hops restored** in the backward walk (see §4), the driving chain in a given iteration
is exactly the set of epics whose shortening moves the finish date in that iteration. Everything off
it has slack; shortening it changes nothing.

That gives the whole thing. For a small fractional cut `f`:

$$
\text{daysSaved}_i(f) \;\approx\; f \cdot \mathbb{E}\!\left[\, d_i \cdot \mathbb{1}\{i \text{ on driving chain}\} \,\right]
$$

where $d_i$ is epic $i$'s sampled duration in that iteration. Define the epic's **leverage** as that
expectation:

$$
\text{leverage}_i \;=\; \frac{1}{N}\sum_{n=1}^{N} d_i^{(n)} \cdot \mathbb{1}\{i \in \text{chain}^{(n)}\}
$$

and the reported number is just `f × leverage`.

### It's already being accumulated

[`criticality-accumulator.ts`](../../src/react/reports/AutoScheduler/scheduler/criticality-accumulator.ts)
already keeps `workDaysSum` (sum of durations over on-chain iterations) and `iterations`. So:

```ts
leverage(key) {
  return (this.workDaysSum.get(key) ?? 0) / this.iterations;
}
```

One line. Note it is the **existing numerator over a different denominator** — `meanWorkDays`
divides by `onChainCount`, leverage divides by `iterations`. Equivalently:

```
leverage = criticalityIndex × meanWorkDays
```

which is worth stating in the UI, because it decomposes the ranking into its two causes: _how often
this epic matters_ × _how big it is when it does_.

It also quietly fixes [issues-and-concerns.md](./issues-and-concerns.md)'s "row totals aren't a real
duration" complaint. That defect came from summing means with **different denominators**. Leverage
has one denominator — `iterations` — for every epic, so leverages are comparable and additive.

### Checked against the example

Chain in the diagram, walking back from the last-finishing epic `B`: `B` was `artificiallyDelayed`,
so its driver is its track predecessor `X`, not its blocker `A`. `X` has no blockers and wasn't
delayed, so the walk stops. **Chain = `[B, X]`. `A` is not on it.**

| Epic | On chain | Duration | Leverage | Predicted saving at 10% | Actual (from §1) |
| ---- | -------- | -------- | -------- | ----------------------- | ---------------- |
| X    | 100%     | 25 d     | 25.0     | **2.5 d**               | 2.5 d ✓          |
| B    | 100%     | 15 d     | 15.0     | **1.5 d**               | 1.5 d ✓          |
| A    | 0%       | 10 d     | 0.0      | **0 d**                 | 0 d ✓            |

Exact on all three. And the ranking `X > B > A` is the answer a planner would give by eye.

### Why this also handles the "just break up the chain" case

Take a plan with no capacity pressure at all — one long dependency chain, every team idle. Then
every chain member has criticality 1.0, and leverage reduces to plain duration: **the biggest epic on
the chain ranks first.** Which is exactly the other piece of the user's framing — target the largest
item in the chain, or split it.

One metric, both failure modes, no mode switch.

---

## 3. Naming the cause: capacity or sequencing

Ranking says _which_ epic. The user also asked _why_, because the remedy differs completely.

The walk can know, cheaply. `Hop` today carries only `hopType: 'dependency' | 'root'`, which describes
the _outgoing_ edge — what drove _this_ epic's start. What's needed for a cause is the **incoming**
edge: what role this epic played in delaying its successor. That's a separate field,
**`arrivedVia: 'tip' | 'dependency' | 'capacity'`**.

> An `arrivedVia` field was written during the earlier round of fixes and then removed along with
> capacity hops, so it has to come back with them. `Hop` in
> [`critical-path-trace.ts`](../../src/react/reports/AutoScheduler/scheduler/critical-path-trace.ts)
> has no such field today — do not assume it's there.

| `arrivedVia` | What it means                                               | The remedy                                                           |
| ------------ | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `capacity`   | This epic was occupying the team track its successor needed | Move it to another team, raise that team's velocity, or descope it   |
| `dependency` | This epic's `Blocks` link gated its successor               | Break the link, split the epic, or start the independent parts early |
| `tip`        | This epic _is_ the last-finishing item                      | Nothing structural — it's simply last                                |

> Deliberately absent from the `capacity` remedy: _"add a track."_ In
> [`normalize.ts`](../../src/jira/normalized/normalize.ts),
> `pointsPerDayPerTrack = totalPointsPerDay / parallelWorkLimit` — a team's throughput is fixed and
> tracks only divide it. Adding one relieves queueing while making every epic on that team
> proportionally slower, which is often a wash or worse. See
> [dependency-floor.md](./dependency-floor.md), "The gap is a diagnosis, not a target."

Tally these per epic alongside the leverage, and each row can carry a plain-English cause:

```
X   2.5 d saved per 10% cut   ·  100% capacity     → Beta has one track and X is on it
B   1.5 d saved per 10% cut   ·  100% tip          → last item; shrink it or accept it
```

The split can be mixed — an epic that's a capacity blocker in 60% of iterations and a dependency
gate in 40% is a real and interesting finding, and the bar can show it.

This also resolves the awkwardness in [model-explainer.md](./model-explainer.md) §2 about queued time
being invisible: the user no longer has to find the waiting themselves. `X` gets named directly, with
"capacity" as the reason, instead of being buried in a fan-out list.

---

## 4. What has to change

1. **Restore capacity hops in `traceDrivingChain`.** When `artificiallyDelayed` is set, the driver is
   the track predecessor. This needs the `WorkItem → ScheduledWorkNode` back-pointer the
   [README](./README.md) describes (~4 lines in `workplan.ts`'s `append`/`prepend`).
   - The earlier fix removed capacity hops because they made ~every epic report 100% criticality.
     **Under this design that is no longer a problem** — 100% criticality doesn't mean "ranks first",
     it means "always matters", and leverage separates the 25-day epic from the 2-day one. The
     original defect was never the hops; it was ranking rows by a raw probability. See
     [model-explainer.md](./model-explainer.md) §4.
2. **Re-add `arrivedVia` to `Hop`** (§3) — distinct from the existing `hopType`, which describes the
   outgoing edge rather than the incoming one.
3. **`CriticalityAccumulator`: add `leverage(key)` and the `arrivedVia` tallies.** Both are sums over
   data already flowing through `addIteration`; `merge` extends the same way.
4. **`stats-analyzer.ts`: surface `leverage` and `causeBreakdown` on `SimulationIssueResult`**,
   beside the existing `criticalityIndex`.
5. **The report becomes a ranked list of epics, not of chains.** Chains move into the expander as
   context ("X sits on Beta's track ahead of B → C"). This is a real departure from
   [the mockup](./mockups/critical-paths.html) and needs a design pass.

### What this avoids

- **No chain clustering.** Ranking epics sidesteps the "near-identical chains fragment the table"
  problem that is the main cost of model-explainer.md's Option 1.
- **No per-iteration sample retention.** Leverage is a running sum, so `insertSortedArrayInPlace`
  destroying cross-issue alignment doesn't matter — which is the main cost of Option 2.
- **No second simulation.** The naive way to answer "what if I shortened this?" is to re-run the plan
  once per epic. Leverage gets the same first-order answer from the run we already do.

---

## 5. Where it is approximate, and how to prove it

**It is a first-order, local estimate.** It assumes the binding structure doesn't change — that
shrinking the epic doesn't hand the constraint to some other path. True for small cuts, false for
large ones. Consequences:

- **Quote a small, fixed cut (10%) rather than "if this epic disappeared."** Removal is exactly where
  the linearity breaks, so the UI should never phrase it that way.
- **Savings are not additive across epics.** Cutting the top two by 10% each does not save the sum;
  after the first cut the schedule is different. The UI must not invite that reading.
- **It is an expectation over futures**, not a promise about the one that happens.

**The test that settles it** — and the reason `scheduler/fixtures.ts` finally has to exist. On a
small fixture, brute-force the ground truth:

1. Run the simulation, record the mean finish day and every epic's leverage.
2. For each epic, re-run with that epic's sampled duration scaled by 0.9, and record the new mean
   finish day.
3. Assert `meanFinish − meanFinish′ ≈ 0.1 × leverage` within tolerance.

Cheap on a four-epic fixture, and it pins the central claim of this document rather than assuming it.
Worth doing before any UI work. The §1 diagram is the obvious first fixture, since its expected
answers (2.5 / 1.5 / 0) are already worked out by hand.

Additional cases worth pinning:

| Test                                         | Asserts                                                               |
| -------------------------------------------- | --------------------------------------------------------------------- |
| §1 fixture                                   | ranking is `X > B > A`; `A` scores exactly 0                          |
| §1 fixture                                   | `X`'s cause is 100% `capacity`, not `dependency`                      |
| no-capacity-pressure chain                   | leverage collapses to duration; biggest epic on the chain ranks first |
| brute-force comparison, all epics            | predicted saving matches measured saving within tolerance             |
| `leverage = criticalityIndex × meanWorkDays` | the decomposition shown in the UI actually holds                      |

---

## 6. Open questions

- **Does the ranked-epic list replace the chain rows, or sit above them?** The chains are still the
  best explanation of _why_ an epic has leverage; they're just a poor primary ranking.
- **What cut fraction to quote?** 10% is arbitrary but concrete. An alternative is "days saved per
  day cut", which is just `criticalityIndex` and dodges the size question — but then a 2-day epic and
  a 60-day epic both read 100%, which is the readability problem we started with.
- **Should leverage respect the uncertainty slider?** It's an expectation, so it's percentile-free by
  construction — which is either a feature (one stable ranking) or an inconsistency with every other
  number on the page.
- **Story points vs. days.** "Shorten by 10%" is a scope conversation, and the estimate the user
  edits is in points. Whether to present leverage in days, points, or both is a UI question.
