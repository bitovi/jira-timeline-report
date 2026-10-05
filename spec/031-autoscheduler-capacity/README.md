# 031 — Editable capacity and tracks in the Auto-Scheduler

Bring back the thing the original [jira-auto-scheduler](https://github.com/bitovi/jira-auto-scheduler)
had and this rewrite dropped: **change a team's capacity and track count from the schedule itself**,
watch the plan re-simulate, and keep it as a throwaway what-if unless you explicitly save it.

- [mockups/capacity-controls.html](./mockups/capacity-controls.html) — every state of the control.
  Open it in a browser.
- [plans/2026-09-13-capacity-and-tracks.md](./plans/2026-09-13-capacity-and-tracks.md) — the
  task-by-task implementation plan.

---

## What exists today

The Auto-Scheduler's team header row is read-only. [AutoScheduler.tsx](../../src/react/reports/AutoScheduler/AutoScheduler.tsx)
prints two derived numbers per team and nothing else:

```tsx
{team.teamData.parallelWorkLimit === 1
  ? `Points / Day: ${roundTo(team.teamData.pointsPerDayPerTrack, 2)}`
  : `Points / Day / Track ${team.teamData.pointsPerDayPerTrack}`}
Total Working Days: {roundTo(totalWorkingDays(team) / team.teamData.parallelWorkLimit, 0)}
```

To change either number you leave the report, open **Settings → Teams**, find the team, edit
`Capacity per sprint` or `Tracks`, and come back. That round-trip is the whole friction: capacity
is the single most interesting dial on this report and it lives in a different panel.

### What the original tool had

[`monte-carlo.js`](https://github.com/bitovi/jira-auto-scheduler/blob/main/public/monte-carlo.js) put
the controls exactly where you would want them:

| Control            | Placement                                                                               |
| ------------------ | --------------------------------------------------------------------------------------- |
| `+` add a track    | Team header, right of the team name, `title="Add a parallel work track for this team."` |
| `−` remove a track | The **first** `Track 1` label row, shown only when `tracks > 1` (`canRemoveTrack`)      |
| `Velocity: [ 21 ]` | Number input on the right of the team header, committed `on:change`                     |

Edits went into `TeamConfiguration.temporaryData` in
[`velocities-from-issue.js`](https://github.com/bitovi/jira-auto-scheduler/blob/main/public/components/velocities-from-issue.js)
— an in-memory overlay that shadowed the config read out of the Jira issue and was never persisted
(`updateConfiguration()` was a `console.log("TODO", …)`). So "temporary what-if" was the original
behavior, not a new idea; the only thing missing was a way to keep a change you liked.

---

## The model, and the one thing the UI must not lie about

[`normalize.ts`](../../src/jira/normalized/normalize.ts) derives everything from three stored fields:

```
totalPointsPerDay   = velocityPerSprint / sprintLength
pointsPerDayPerTrack = totalPointsPerDay / tracks
```

and [`work-timing.ts`](../../src/jira/derived/work-timing/work-timing.ts) turns that into duration:

```
storyPointsDaysOfWork = issuePoints / pointsPerDayPerTrack
```

Two consequences the control has to make legible:

**Adding a track does not add capacity.** `totalPointsPerDay` is untouched by `tracks`; only
`pointsPerDayPerTrack` moves. Two tracks means each _estimated_ epic takes twice as long and two run
side by side. Team throughput is identical. Tracks trade _latency on one chain_ for _parallelism
across chains_ — they help only when the plan is wide, and do nothing when it is a single dependency
chain. This is the same point [`dependency-floor.md`](../024-critical-path/dependency-floor.md)
makes about the earliest-finish gap: "It is tempting to read a large gap as 'add tracks until it
closes.' That is wrong."

**Unestimated issues are the exception, and the tooltip must not overstate it.**
[`getDefaultStoryPointsDefault`](../../src/jira/derived/work-timing/work-timing.ts) is
`team.velocity / team.parallelWorkLimit`, so an issue with no estimate gets a _smaller_ default when
you add a track — divided by the same `tracks` that `pointsPerDayPerTrack` is divided by:

```
defaultPoints / pointsPerDayPerTrack = (velocity / tracks) / (velocity / sprintLength / tracks)
                                     = sprintLength
```

The two effects cancel exactly. Changing tracks moves an unestimated issue's synthetic point
estimate but leaves its duration at one sprint. Worth a footnote in the tooltip — stated as the
cancellation it is, not as a second duration effect.

---

## The design

### Team header row — inputs left, outputs right

The row splits on the one distinction that matters: **everything you can change is on the left**,
packed against the team name; **everything the model computes is on the right.**

```
ORDER  ⟨− 2 tracks +⟩  Capacity 35 pts/sprint  [Reset] [Commit]      Points/Day 3.5   Total Working Days 23
└────────────────── inputs ───────────────────────────┘      └───────────── outputs ────────────┘
```

- **Tracks** and **Capacity** — the two things you tell the scheduler.
- **Reset / Commit** act on those inputs, so they end the left group. The row grows leftward when a
  team goes dirty and the outputs never move.
- **Points/Day** — read-only, and updates the instant capacity commits. This is the "set Points/Day
  and have it update capacity" ask answered from the other end: the two are one value seen through
  `sprintLength`, so you steer Points/Day _by_ typing a capacity and watching it move. Capacity is
  the number a team actually knows about itself; points-per-day is a unit conversion of it.
- **Total Working Days** — read-only. An output of the simulation, not an input.

Today everything is right-aligned together, which mixes the two numbers you set with the two the
model computes and leaves nothing on the row to tell you which is which. The split makes that
readable without a word of explanation — and because the outputs stay right-aligned, they line up
into columns down the report whether or not a team has pending changes.

**Points/Day is not editable.** Back-solving `velocityPerSprint = pointsPerDay × sprintLength` is
arithmetically fine and a bad idea in the UI: two editable fields bound to one stored value means
every edit silently rewrites the other, rounding makes the round-trip lossy (type `3.5`, get `35`
pts/sprint back, see `3.5`; type `2.13`, get `21` back, see `2.1`), and it invites people to tune a
derived figure rather than state a capacity they can defend. One input, one readout.

**Points/Day is the team total, not per track.** Today the label flips between `Points / Day` and
`Points / Day / Track` depending on `parallelWorkLimit`, which makes the number jump when you add a
track. Show total throughput, invariant to track count, and say nothing about per-track throughput on
the row — the tooltip on the stepper is where that belongs.

### Use the standard Jira click-to-edit

Capacity is an ordinary editable value and should look like every other one in Jira: plain text at
rest, a subtle neutral fill on hover, and a `@atlaskit/textfield` with the standard confirm / cancel
pair once clicked. No pencil, no dotted underline, no bordered chip.

That is `@atlaskit/inline-edit`, already a dependency and already used twice:

| Where                                                                                         | Notes                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [`EditableTitle.tsx`](../../src/react/SaveReports/components/EditableTitle/EditableTitle.tsx) | The plain form — `InlineEdit`'s own read view is the click target. Copy this.                                                               |
| [`SectionTitle.tsx`](../../src/react/reports/ReportOfReports/components/SectionTitle.tsx)     | Hand-rolls a pencil trigger instead, **because its row already toggles collapse on click** and the two would fight over what a click means. |

`SectionTitle`'s deviation does not apply here: the Auto-Scheduler's team header row has no click
handler of its own, so the read view can be the trigger. Follow `EditableTitle`.

Two implementation details both existing call sites carry and this one needs:

- `[&>form>div]:!m-0` on the wrapper — `InlineEdit`'s outer margin is unreachable through props and
  will blow out the header row's height.
- The team header sits under the `#dependencies` SVG, so the row needs the same `relative z-30` lift
  the Summary row already uses, or the read view will never receive a click.

A related control worth _not_ copying: the `Compare to 08/29/2026` chip in
[`CompareSlider.tsx`](../../src/react/ReportControls/components/CompareSlider/CompareSlider.tsx) is a
bare `<input type="date">` styled flat (`rounded bg-neutral-201 hover:bg-neutral-301 cursor-pointer`).
It reads as click-to-edit but is always a live input, which works for a date picker and is wrong for a
free-text number that must commit on blur.

### Track stepper

Inline `− n +` on the team header, next to the team name. Reasons to move it off the `Track 1` row
where the original put the `−`:

- Both directions are in one place, so the count is a single readable control rather than two
  buttons on different rows.
- The `Track 1` label row disappears when a track has no work, which is exactly when you would want
  to remove it.
- It leaves the track label rows as pure labels, which keeps the SVG dependency layer's row math
  unchanged.

`−` stops at 1, because a team with zero tracks cannot be scheduled. There is no upper bound — how
many parallel streams a team runs is a fact about that team, not a limit for this tool to impose.

### Uncommitted changes live on the team row

An edit takes effect in the plan immediately, but does not touch saved team settings until it is
committed. That state is marked **on the row, not on the field** — an amber fill and left edge, plus
a `Reset` / `Commit` pair that exists only while the team is dirty:

```
ORDER  ⟨− 2 tracks +⟩  Capacity 35 pts/sprint  [Reset] [Commit]      Points/Day 3.5   Total Working Days 23
```

Row-level rather than field-level is the load-bearing choice: a dirty-input style would work for
capacity and have no equivalent for a stepper, so capacity and tracks would announce themselves in
two different languages. One row treatment covers both. The buttons are the other half of the
signal — their presence _is_ the indicator, so nothing else has to shout.

- **Reset** drops this team's override; the row returns to saved settings and the plan re-solves.
- **Commit** writes capacity and tracks through the existing
  [`useSaveAllTeamData`](../../src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/hooks/useSaveAllTeamData.tsx)
  mutation — the same one the sidebar uses — and clears the row treatment.

Each team commits independently; a change to one is not entangled with a change to another. There is
no global "reset all / save all" bar: it would be a second place to commit, far from the thing being
committed, forcing an all-or-nothing decision across teams changed for unrelated reasons.

Nothing quotes the previous value back at you — no "was 21", no "(1.75 / track)". The row already
carries four numbers and three controls; the amber says something changed and `Reset` puts it back.

Overrides are session state: not in the URL, not in a saved report. A shared link that silently
showed a plan built on capacity that does not exist would be a worse bug than losing an uncommitted
what-if on reload.

---

## How hard is it

Short answer: the data plumbing is nearly free, the simulation cost is the real constraint, and the
fiddly part is the grid.

### Cheap — the override seam already exists

`routeData.normalizeOptions` is a settable observable, and the sidebar already proves the pattern:
`useSaveAllTeamData` → `createNormalizeConfiguration(allTeamData)` → `onUpdate` →
[`TimelineReport.tsx`](../../src/react/TimelineReport/TimelineReport.tsx) sets `rd.normalizeOptions`,
and every downstream stage re-runs. A what-if overlay is the same call with the override merged into
`allTeamData` and the storage write skipped. `getVelocity` / `getParallelWorkLimit` are already
per-issue functions, so an overlay is a wrapper, not a new mechanism.

Two small structural changes:

1. `AutoSchedulerWrapper` needs a `StorageProvider` (it has `FlagsProvider` / `JiraProvider` /
   `QueryClientProvider` today) before it can call `useSaveAllTeamData`. Same shape as
   [`ReportOfReportsWrapper`](../../src/react/reports/ReportOfReports/ReportOfReportsWrapper.tsx).
2. The overlay has to live above the report, not inside it, because it feeds `normalizeOptions`,
   which is read by the pipeline that produces the report's own props. Owning it in the shell and
   passing a setter down avoids a render cycle.

### The real cost — every edit restarts the Monte Carlo

Changing capacity changes `pointsPerDayPerTrack`, which changes `storyPointsDaysOfWork`, which means
re-normalize → re-derive → re-rollup → **new issue objects** → the `[primary]` effect in
`AutoScheduler.tsx` tears down the `StatsAnalyzer` and runs the full simulation again. This is
correct — a capacity change genuinely invalidates the run — but it rules out live-updating on
keystroke.

So the capacity field applies on blur or Enter, never on `input`, and the track stepper needs a short
debounce (~300ms) so clicking `+` three times is one simulation rather than three. No new loading UI
is needed — the report already has a progress bar for a run in flight, and the grid keeps showing the
previous solve until the new one lands.

("Applies" here is the field committing its value to the overlay, which is a different thing from the
row's **Commit** button writing the overlay through to team settings.)

Note the inverse hazard, already documented and guarded against in `AutoScheduler.tsx`:
`primaryIssuesOrReleases` re-emits a new array on _any_ URL change, and `AutoScheduler` guards
against that with a ref comparison. Overrides must go through `normalizeOptions` (new issue objects,
guard correctly lets it through) and **not** through the URL, or they will be swallowed by that guard.

### The fiddly part — the grid

`gridUIData` assigns every row a `gridRowStart`, and the dependency SVG measures DOM rects. Adding a
track changes row counts for every team below it; the existing `ResizeObserver` + rAF redraw already
handles that, but it is the thing most likely to produce a visual bug.

The header row is today a single `flex-row-reverse` with two text nodes, and it sits under the
`#dependencies` SVG — the same `relative z-30` lift the Summary row needed for its tooltips is
required here for the read view and the stepper to be clickable at all. It becomes two groups in a
`justify-between` flex: inputs (stepper, capacity, and when dirty the buttons) and outputs
(points-per-day, total working days). That the row has to hold four values plus three controls is
the main argument for not printing any before/after text next to them.

### Rough shape

| Piece                                                                           | Size |
| ------------------------------------------------------------------------------- | ---- |
| `capacityOverrides` state + merge into `createNormalizeConfiguration`           | S    |
| `StorageProvider` in the wrapper; commit-through via `useSaveAllTeamData`       | S    |
| `TeamCapacityControls` — click-to-edit capacity, derived points-per-day readout | S    |
| Track stepper + debounce                                                        | S    |
| Dirty row treatment + per-team Reset / Commit                                   | S    |
| Header row layout, `z-30` lift, grid row-count churn                            | M    |
| Tests: points-per-day tracks capacity, track invariance of total throughput     | S    |

No new math, no new persistence format, no change to the scheduler. It is a UI on a seam that is
already there.

---

## Open questions

1. **Sprint length.** It is the third term in `pointsPerDay = capacity / sprintLength`, it is not on
   this row, and it is the other way to move points-per-day. Is capacity always the right dial, or
   does a team that wants to change cadence need sprint length here too?
2. **Which hierarchy level?** Team config is keyed by `[teamKey][hierarchyLevel]`. The Auto-Scheduler
   schedules epics, so the override presumably writes the epic level — but **Commit**
   then writes a level-specific value from a screen that does not show levels.
   _Answered, per field:_ Commit writes to the scheduled hierarchy level when the team's own saved
   data already defines that field there, and to the team's `defaults` otherwise — which is also
   where a value inherited from `__GLOBAL__` lands. The two fields can therefore target different
   levels. Nothing is ever removed from a level Commit is not targeting, and `__GLOBAL__` is never
   written. See [`useTeamCommit.ts`](../../src/react/reports/AutoScheduler/components/TeamCapacityControls/useTeamCommit.ts).
3. **Global default teams.** A team with no saved config inherits `__GLOBAL__.defaults`. Editing it
   inline should create a team-specific override, not move the global default — needs to be explicit
   in the save path.
