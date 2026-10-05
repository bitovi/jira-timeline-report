# How the critical-path model works, and the decision in front of us

Written 2026-08-12, on resuming the paused POC. Companion to [README.md](./README.md) (the design)
and [issues-and-concerns.md](./issues-and-concerns.md) (what went wrong in the smoke test).

This document exists because the report's output is currently wrong in a way that isn't a bug in any
one function — it comes from two halves of the feature disagreeing about what a "critical path" is.
Understanding that disagreement is the whole decision.

---

## 1. The question the report answers

> Which chain of epics is deciding my finish date, and what would I have to change to move it?

Two things have to come out of that: a **ranking** (which chain matters most) and a **duration** (how
long that chain takes, split into working time vs. waiting time).

> **A sharper framing exists**, and it changes the answer: _which single epic, if shortened, pulls
> the plan in the most — and is the reason capacity or sequencing?_ It is developed separately in
> [shortening-leverage.md](./shortening-leverage.md), which depends on the machinery explained
> below. Read this document first.
>
> That report is capacity-aware, and so cannot answer _"how fast could this go if nothing ever waited
> for a free track?"_ — the longest chain of epics ignoring contention entirely. That is
> [dependency-floor.md](./dependency-floor.md). The two are complements; the gap between them tells
> a user whether they have a sequencing problem or a contention one.

---

## 2. The simulation, and the backward walk

The Auto-Scheduler runs a Monte Carlo simulation — by default 500 batches × 20 iterations = 10,000
schedules ([`monte-carlo.ts`](../../src/react/reports/AutoScheduler/scheduler/monte-carlo.ts)).

Each iteration:

1. **Re-samples every epic's duration.** `resetLinkedIssue` draws a new `daysOfWork` from the epic's
   estimate and confidence, so a "10 day" epic might be 8 days this time and 14 the next.
2. **Schedules everything**, respecting two independent constraints:
   - **`Blocks` links** — B cannot start until A finishes.
   - **Team capacity** — a team with one track runs one epic at a time, so epics queue behind each
     other even with no link between them. When an epic is pushed past its blocker-ready date this
     way, the scheduler marks it `artificiallyDelayed`.
3. **Finds the single last-finishing epic** in the whole plan, and **walks backward** from it,
   asking at each step: _what made you start when you did?_

That walk is [`traceDrivingChain`](../../src/react/reports/AutoScheduler/scheduler/critical-path-trace.ts).
Every epic it visits gets a tally mark for that iteration.

### Criticality index

After all 10,000 iterations, for each epic:

```
criticalityIndex = (iterations in which this epic was on the driving chain) / 10,000
```

So 78% means "in 78% of simulated futures, this epic was part of the reason the plan ended when it
did." That's the number that replaced the old `blocksWorkDepth` ranking, and it's the one thing the
simulation was added to produce.

Accumulation lives in
[`criticality-accumulator.ts`](../../src/react/reports/AutoScheduler/scheduler/criticality-accumulator.ts),
which also tracks each epic's mean work days and mean queued days — **averaged only over the
iterations where it was on the chain**. That conditioning matters later.

### Span, work, and queued — the three duration words

These three terms carry the rest of the document, so pin them down here.

All three are properties of a **chain**, not of an epic. A chain is a sequence in which each epic is
held up by the one before it — under today's walk, always by a `Blocks` link; under the original
design, possibly by team capacity as well (that difference is the whole of §4). So yes: **span is
measured over a sequence of blocked epics.**

**Span** is the chain's elapsed calendar length: **from the day its first epic starts to the day its
last epic ends.** Wall-clock time, not effort. It includes every gap in the middle.

#### Where the gaps come from

A gap needs two things to be true at once: an epic is **unblocked** — its blocker has finished — and
its **team still has no free track**. Something else in the plan is sitting on that track.

This is worth being precise about, because it does _not_ generally happen between two epics of the
same team. If `A` blocks `B` and both belong to a one-track team, that team is free the instant `A`
ends, so `B` starts immediately and queues for zero days. A dependency chain that stays inside one
team is normally gap-free.

Gaps show up when the chain **hops to a different team** — one that is busy with work of its own.
Three epics, three teams, one iteration:

```
day:        0    5    10   15   20   25   30   35   40
            ├────┼────┼────┼────┼────┼────┼────┼────┤
Alpha   A:  [==== 10 d work ====]                          ← chain
Beta    X:  [============ 25 d work ============]          ← NOT on the chain
Beta    B:                      ....15 d queued....[== 15 d work ==]   ← chain
                                 ↑ A finished on day 10, so B was unblocked then —
                                   but Beta's only track was busy with X until day 25
```

The chain is `A → B`. `X` is not on it; `X` is just what Beta happened to be doing. And that is the
point of the README's insistence that the orange segment reads **"Queued behind other plan work"**
and never "waiting on team" — the thing occupying the track is another epic in this same plan, which
you can see and reschedule.

- **Work** = 10 + 15 = **25 days.** Time somebody on the chain was actually doing something.
- **Queued** = **15 days.** `startDay − earliestStartFromBlockers` — day 25 minus day 10.
- **Span** = day 0 → day 40 = **40 days.** What the calendar says. What a stakeholder feels.

(The same-team case isn't impossible — the scheduler can slot an unrelated epic onto the track
between `A` and `B` — but cross-team hops are where queueing routinely comes from.)

#### The identity the design leans on

```
span = work + queued          (40 = 25 + 15)
```

That holds **only if the chain is contiguous** — every epic on it started either exactly when its
predecessor ended, or later, with the gap counted as queued. A traced driving chain is contiguous by
construction, which is why the README states the invariant, and why the "Total days" column can be
split into a blue work bar and an orange queued bar that add up to the number printed beside them.

#### A consequence worth knowing before you choose an option

Read the two paragraphs above together and something uncomfortable falls out. The **driving** chain
is by definition the path where nothing was wasted — each hop started the moment it could. So the
higher a row ranks, the closer its queued time is to zero, and the **#1 row's orange bar is
structurally almost always empty**. Meanwhile the epics that _did_ wait (`X`'s neighbours, the
siblings queued behind the chain) are fan-out, where the UI prints one raw total with no work/queued
split at all.

That is [issues-and-concerns.md](./issues-and-concerns.md) §3 — "queued time is never visible where
the user expects it" — and it is not a rendering bug. It's a direct consequence of defining queued
against a chain that was selected for having no queueing. Whichever option §5 lands on has to say
where a user sees waiting time.

#### Picking one number out of 10,000

The report shows one span, but the simulation produced 10,000 of them. It uses the **uncertainty
percentile** selected in the Auto-Scheduler — the same slider driving the bars above it. At 80%:
sort the 10,000 spans ascending and take the one 80% of the way up. "This chain takes 40 days or
less in 80% of futures." `getUncertaintyThresholdData` (`stats-analyzer.ts`) already does exactly
this indexing for start and due dates, so spans should reuse it and agree with the grid.

**What the report prints today is none of this.** `totalWorkDays` and `totalQueuedDays` sum
per-issue _means_, and each of those means is conditioned on a different subset of iterations (§2's
"averaged only over the iterations where it was on the chain"). Adding numbers with different
denominators doesn't yield a duration — it's the same category error the README already calls out in
the _old_ report's `totalDaysInCriticalPath`.

---

## 3. How the UI groups epics into rows

This is the half that was under-explained. The report doesn't show one line per epic — it shows one
line per **chain**, e.g. `Epic X.1 → … → Epic X.6`. Those chains are assembled _after_ the
simulation, by [`buildCriticalPaths`](../../src/react/reports/AutoScheduler/CriticalPathsReport/build-critical-paths.ts).

Two rules govern it:

- **Every epic lands in exactly one row.** Once used, it's off the table for later rows. The code
  tracks this with a single `excludedKeys` set.
- **Rows are claimed in descending criticality order.** The most critical epic gets first pick of
  everything downstream of it; whatever's left over forms the next row, and so on.

The procedure, precisely:

1. Sort **every** epic by criticality index, descending. (Ties break on `blocksWorkDepth`, purely so
   the output is stable run to run.)
2. Walk that sorted list. Skip any epic already claimed by an earlier row. The first unclaimed epic
   becomes this row's **root** — and the row's headline percentage is _the root's_ criticality
   index, not the chain's.
3. From the root, walk **forward** along `Blocks` — i.e. through `linkedBlocks`, the epics this one
   blocks. At each step, among the unclaimed epics this one blocks, the **highest-criticality one
   becomes the next link in the chain**.
4. The _other_ epics it blocks — the losing siblings — become the row's **fan-out**: shown under the
   expander as "other epics blocked by this chain," not as chain members. Everything downstream of
   them is pulled into the fan-out too, and marked claimed.
5. Keep stepping forward until the current epic blocks nothing unclaimed. That row is done; return
   to step 2.

### Worked example

Five epics. `A` blocks `B` and `C`; `C` blocks `D`; `E` is unlinked. Criticality after the
simulation:

| Epic | Blocks | Criticality |
| ---- | ------ | ----------- |
| E    | —      | 90%         |
| A    | B, C   | 60%         |
| C    | D      | 60%         |
| D    | —      | 55%         |
| B    | —      | 10%         |

Sorted order is `E, A, C, D, B`.

- **E** is unclaimed → root of row 1. It blocks nothing, so the chain ends immediately.
  → **Row 1: `E`, 90%.**
- **A** is unclaimed → root of row 2. A blocks `B` (10%) and `C` (60%); `C` wins, so the chain
  becomes `A → C`. `B` is the losing sibling → fan-out. Now from `C`: it blocks `D` (unclaimed), so
  the chain becomes `A → C → D`. `D` blocks nothing. Done.
  → **Row 2: `A → C → D`, 60%, fan-out `[B]`.**
- **C, D, B** are all claimed → skipped. No more rows.

### The sharp edge: a row's root is not necessarily a chain's start

Step 2 picks whatever unclaimed epic ranks highest — it never checks whether that epic has blockers.
So if the numbers above changed to `A: 40%, C: 60%`, the sorted order becomes `E, C, D, A, B` and
the same code produces:

- **Row 1: `C → D`, 60%** — presented as a chain that starts at `C`, even though `C` cannot start
  until `A` finishes.
- **Row 2: `A → B`, 40%** — because `C` was already claimed, `A`'s only remaining successor is `B`.

One real dependency chain, `A → C → D`, split across two rows, with the second-half fragment ranked
above the piece that actually gates it. This is the mechanism behind the "why is this 1-day task
showing 100%?" confusion in the smoke test, and it's a direct consequence of ranking by root
criticality while assembling chains greedily.

---

## 4. Where it goes wrong: the two halves disagree

Re-read sections 2 and 3 together and the problem is visible:

|                      | What it uses                                    |
| -------------------- | ----------------------------------------------- |
| **Criticality** (§2) | The **dynamic** schedule — links _and_ capacity |
| **Row chains** (§3)  | The **static** `Blocks` graph — links only      |

Criticality can say "these three epics jointly drove the finish," but if they're linked by capacity
rather than by `Blocks`, the row builder has no way to put them on the same row.

### The example that shows it

One team, **Platform**, with a single track (one epic at a time), holding three unrelated 20-day
epics. Plus a separate team, **Web**, with a genuine dependency.

```
Platform:  [--P1 20d--][--P2 20d--][--P3 20d--]     day 0 ────────────► 60
Web:       [-Q1 10d-][-Q2 10d-]                     day 0 ────► 20

           Q1 Blocks Q2.  P1 / P2 / P3 have no links at all.
```

The plan finishes on **day 60**, and the last-finishing epic is **P3**.

#### Variant 1 — the walk follows `Blocks` links only (what's in the code today)

Walk back from P3: P3 has no blockers, so the chain is just `[P3]`. Stop.

| Row     | Criticality | Total |
| ------- | ----------- | ----- |
| P3      | 100%        | 20 d  |
| P1      | 0%          | 0 d   |
| P2      | 0%          | 0 d   |
| Q1 → Q2 | 0%          | 0 d   |

Two failures. It reports **20 d for a 60-day plan**. And it claims P1 and P2 are irrelevant — but
delete P1 and the plan finishes on day 40.

The `0 d` on rows 2–4 isn't a separate bug: `meanWorkDays` and `meanQueuedDays` average over the
iterations an epic was on the chain, and for these that count is zero.

This is exactly what the live app shows today on sample data — `Upselling 100% · 14 d`, and eleven
rows of `0% · 0 d` beneath it.

#### Variant 2 — the walk also steps sideways on capacity (the original README design)

P3 was `artificiallyDelayed`: it was ready on day 0 and capacity pushed it to day 40. So the walk
steps to P3's track predecessor, P2; then P2 → P1; then stops. The chain is `[P3, P2, P1]` — 60
days, which is right.

But then the row builder gets hold of it:

| Row     | Criticality | Total |
| ------- | ----------- | ----- |
| P1      | 100%        | 20 d  |
| P2      | 100%        | 20 d  |
| P3      | 100%        | 20 d  |
| Q1 → Q2 | 0%          | 20 d  |

**The walk found the right chain and the row builder threw it away.** P1/P2/P3 are linked by
capacity, not by `Blocks`, so §3 step 3 finds nothing to follow — each becomes its own single-epic
row, each inheriting 100%.

That is the "13 unrelated leaf epics all at 100%" defect from
[issues-and-concerns.md](./issues-and-concerns.md) §1. **It was never a bug in the walk.** The fix
applied at the time removed capacity hops from the walk, which treats the symptom — and produces
Variant 1's starved output instead.

---

## 5. The options

### Option 1 — Rows follow the trace

Restore capacity hops in the walk, **and delete §3 entirely.** Rows stop being assembled from the
static `Blocks` graph; they become the chains the walk actually found.

**How that works.** Today each iteration's walk produces a chain, tallies its epics, and throws the
chain itself away. Instead, keep it — as an ordered list of issue keys, joined into a single string
so it can be used as a map key:

```
iteration 1:   "P3←P2←P1"      iteration 5:   "P3←P2←P1"
iteration 2:   "P3←P2←P1"      iteration 6:   "P3←P2←P1"
iteration 3:   "P3←P2←P1"      ...
iteration 4:   "P3←P2←P1"
```

Count them in a `Map<string, number>` exactly as criticality is counted today, just keyed on the
whole chain instead of on each epic:

| Chain          | Times seen | Share    |
| -------------- | ---------- | -------- |
| `P1 → P2 → P3` | 10,000     | **100%** |
| _(others)_     | 0          | 0%       |

Each distinct chain becomes one row, and **its share of iterations _is_ the row's criticality
index** — no longer inherited from whichever epic the greedy pass happened to name as root. The span
is accumulated the same way: record `lastEpic.dueDay − firstEpic.startDay` per iteration, keep the
10,000 values, report the one at the selected percentile.

A richer plan wouldn't be so unanimous — you'd see something like:

| Chain               | Times seen | Share   |
| ------------------- | ---------- | ------- |
| `P1 → P2 → P3`      | 6,200      | **62%** |
| `P1 → P2 → P3 → P4` | 2,400      | **24%** |
| `Q1 → Q2 → Q3`      | 1,400      | **14%** |

…and the first two are obviously the same story told twice, which is the clustering problem below.

Rows to display are then just the top few by share, plus "Show more".

| Row          | Criticality | Total |
| ------------ | ----------- | ----- |
| P1 → P2 → P3 | 100%        | 60 d  |
| Q1 → Q2      | 0%          | 20 d  |

- **For it:** the thing ranked and the thing measured are the same object. `span = work + queued`
  becomes true by construction rather than by hope. Both §3's "root isn't a chain start" edge and
  §4's mismatch disappear, because §3 goes away. Percentages gain a plain-English reading: "this
  exact chain drove the finish in 62% of futures."
- **Against it:** chains differ between iterations — one long draw on P4 appends it and mints a
  whole new chain string — so near-identical chains need clustering (e.g. by prefix, or by their
  highest-criticality members) or the table fragments into dozens of 1%-rows. A row also stops being
  a fixed set of Jira issues you can point at, which affects grid highlighting. Largest change of
  the three.

### Option 2 — Static rows, measured honestly

Leave row assembly (§3) exactly as it is. Change only where the durations come from: stop deriving
them from the trace, and instead **measure each row's own chain, in every iteration, as a span** —
first epic's start to last epic's end — then report the value at the selected uncertainty
percentile.

Concretely, for the row `Q1 → Q2`: in each iteration read `Q1.startDay` and `Q2.dueDay`, subtract,
and keep the 10,000 differences. That's a real distribution of a real elapsed time, so the
percentile means something and includes any queueing inside the chain. Criticality is untouched and
stays dependency-only.

The catch is a plumbing one. Computing `Q2.dueDay − Q1.startDay` requires both values **from the
same iteration**, and `stats-analyzer.ts` currently stores each epic's samples through
`insertSortedArrayInPlace` — which sorts every epic's array independently, so index 7 of `Q1.startDays`
and index 7 of `Q2.dueDays` come from unrelated iterations. Alignment is already destroyed by the
time the report sees the data.

| Row     | Criticality | Total                                        |
| ------- | ----------- | -------------------------------------------- |
| P3      | 100%        | 60 d ← its real start-to-end, queue included |
| P1      | 0%          | 20 d                                         |
| P2      | 0%          | 20 d                                         |
| Q1 → Q2 | 0%          | 20 d                                         |

- **For it:** kills the `0 d` tail; every printed number becomes a real duration. Smallest change,
  and it stops the report lying about durations without committing to a model rewrite.
- **Against it:** the ranking is unchanged, so it still can't tell you that P1 and P2 are _why_ P3
  is late. And it needs `stats-analyzer.ts` to retain raw, iteration-ordered `startDays` / `dueDays`
  arrays alongside the sorted ones — roughly 50% more memory across those two series — purely to
  restore the alignment described above.

### Option 3 — Two signals, two columns

Keep criticality dependency-only, and add a separate capacity/queue metric beside it. P3 reads
`100% critical · 40 d queued`; P1 and P2 read `0% critical` but surface in the **Team load** section
the README already calls for, as the reason P3 queued.

- **For it:** criticality keeps a single clean meaning. Capacity pressure gets reported where the
  design already wanted it, rather than smeared into the ranking.
- **Against it:** two numbers to teach instead of one, and the user still has to connect them
  manually. Middle-sized change.

---

## 6. Recommendation

**Option 1**, because it's the only one where the number we rank by and the number we print describe
the same object, and the only one under which the README's central promise holds.

**Option 2** is the right increment if we'd rather stop the report printing false durations before
committing to a model rewrite. It is not a step _toward_ Option 1 — the per-iteration retention it
needs is thrown away if rows later come from the trace — so choosing it is choosing to spend that
work knowingly.

---

## 7. Independent of the decision

These are broken regardless of which option wins:

1. **`probabilisticallySelectIssueTiming` is dead.** `linkIssues(issues, flag)` accepts the
   parameter and never reads it, and `resetLinkedIssue` always samples probabilistically. The
   README's "the trace is exactly the known chain, deterministically" test cannot be written until
   this works. Related: `scheduleIssues` calls `resetLinkedIssue` again, so `runBatch`'s own reset
   loop re-samples every issue twice per iteration.
2. **The fan-out total has no work/queued split.** It sums raw `adjustedDaysOfWork`, which hides
   exactly the queueing users ask about — see [issues-and-concerns.md](./issues-and-concerns.md) §3.
3. **`scheduler/fixtures.ts` still doesn't exist.** Every scheduler test runs on `[]`, so there is
   no coverage of scheduling behavior at all. The README calls this out as the real cost of the
   model work, and neither option can be validated without it.
