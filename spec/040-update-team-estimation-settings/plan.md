# 040 — Update team estimation settings

## Context

Every Team Configuration form (global defaults, global per work item type, team defaults, team per work item type) asks for three raw numbers: **Capacity per sprint**, **Tracks**, and **Sprint length**. They only make sense if the team estimates in story points, and "tracks" is jargon. We want to replace them with plain questions that start with _"What units do you use to estimate?"_, ask follow-up questions based on the answer, and finish with a one-line summary of what the user chose.

The scheduling engine stays as it is. It already works from three numbers per issue (`src/jira/normalized/normalize.ts:63-68`):

```
pointsPerDayPerTrack = velocity / daysPerSprint / parallelWorkLimit
daysOfWork           = estimate / pointsPerDayPerTrack          (work-timing.ts:91)
default estimate     = velocity / parallelWorkLimit              (work-timing.ts:61, unestimated items)
```

So each estimate unit only has to produce an **effective velocity**: how many estimate units the whole team finishes per sprint. `daysPerSprint` and `parallelWorkLimit` keep coming from `sprintLength` and `tracks`.

## Data model

Add three fields to `Configuration` (`.../team-configuration/shared.ts`) and to `createEmptyConfiguration`:

```ts
estimateUnit: 'storyPoints' | 'devDays' | 'teamDays' | 'teamWeeks' | 'teamSprints' | null;
teamMembers: number | null; // Dev Days only
estimateTeamShare: 'full' | 'half' | 'third' | 'quarter' | null; // Team Days/Weeks/Sprints
```

The existing fields keep their storage keys but get clearer meanings:

| Field               | Meaning now                                           |
| ------------------- | ----------------------------------------------------- |
| `velocityPerSprint` | Story points completed per sprint (Story Points only) |
| `sprintLength`      | Working days in a sprint                              |
| `tracks`            | Work items the team handles in parallel (every unit)  |

**No migration.** A saved config without `estimateUnit` resolves to `storyPoints`, which keeps today's math exactly. Set `estimateUnit: 'storyPoints'` in `nonFieldDefaults` and `getGlobalDefaultData` in `allTeamDefault.ts`. Every new field inherits per field through the existing chain (spec/039), and `sanitizeAllTeamData` already removes nulls.

## Effective velocity (pure function)

New file `.../Teams/shared/estimation.ts`:

```ts
const SHARE = { full: 1, half: 1 / 2, third: 1 / 3, quarter: 1 / 4 };

export function getEffectiveVelocity(c: Configuration): number {
  const S = c.sprintLength,
    f = SHARE[c.estimateTeamShare ?? 'full'];
  switch (c.estimateUnit ?? 'storyPoints') {
    case 'storyPoints':
      return c.velocityPerSprint;
    case 'devDays':
      return c.teamMembers * S; // M dev-days per working day
    case 'teamDays':
      return S / f;
    case 'teamWeeks':
      return S / (5 * f); // "One week is 5 working days"
    case 'teamSprints':
      return 1 / f;
  }
}
```

Spot checks (P = parallel):

- Half team, 10 team-days, P=2: each item gets half the team, so it takes 10 days. The formula gives `10 / ((S/½)/S/2) = 10` ✓
- Dev Days, 10 members, P=2, 20 dev-days: 5 devs per item, so 4 days. The formula gives `20 / (10S/S/2) = 4` ✓
- Unestimated item: always defaults to one sprint per track, the same behavior as today for every unit ✓

When a unit doesn't ask for sprint length (Dev Days, Team Days, Team Weeks), `sprintLength` is still resolved through inheritance (default 10). It only affects the default estimate for unestimated items, and it cancels out of every estimated duration.

Wire it in at `.../Teams/shared/normalize.ts`: `getVelocity` returns `getEffectiveVelocity(getConfiguration(...))` and no longer reads `velocityPerSprint` directly.

Also add `describeEstimation(config, itemsLabel): string` here for the summary (below), so it can be unit-tested.

## Form layout

Pull the capacity fields out of `ConfigureTeamsForm.tsx` and `AllTeamsDefaultsForm.tsx` and put them in one shared component, `.../Teams/components/EstimationQuestions/EstimationQuestions.tsx`. It takes `mode: 'global' | 'inheriting'`. Global mode renders `TextField`/`Select`, and inheriting mode renders `InheritanceTextField`/`InheritanceSelect`. Its other props are `control`, `register`, `update`, `savedUserData`, `toggleInheritance?`, and `itemLabel` (singular/plural).

It reads the effective unit with `useWatch({ control, name: 'estimateUnit' })`. Form `defaultValues` are already the inherited data, so an inherited unit still controls which questions show.

Wording: `<as a team | issue type>` is **"as a team"** on `defaults` accordions and **"Epics"** (plural of `getHierarchyLevelName(level)`) on per-type accordions. `<work items | issue type>` is **"work items"** / **"Epics"** in the same way. `IssueAccordion` in `ConfigureTeams.tsx` already has `getHierarchyLevelName`, so it passes the label down.

### Subsection 1 — Estimate units

| Question                                                                                                                                              | Field               | Shown when                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------- |
| What units do you use to estimate {as a team \| Epics}? `[Story Points, Dev Days, Team Working Days, Team Weeks, Team Sprints]`                       | `estimateUnit`      | always                            |
| How many working days are in a sprint?                                                                                                                | `sprintLength`      | Story Points, Team Sprints        |
| When estimating, how much of the team do you assume will work on a single {work item \| Epic}? `[Full Team, Half Team, One Third Team, Quarter Team]` | `estimateTeamShare` | Team Working Days, Weeks, Sprints |
| _One week is 5 working days_ (static text)                                                                                                            | —                   | Team Weeks                        |

### Subsection 2 — Team capacity

| Question                                                                      | Field               | Shown when   |
| ----------------------------------------------------------------------------- | ------------------- | ------------ |
| How many story points does your team complete per sprint?                     | `velocityPerSprint` | Story Points |
| How many full-time team members are working on your team?                     | `teamMembers`       | Dev Days     |
| How many {work items \| Epics} can your team work on in parallel, on average? | `tracks`            | always       |

Parallel is asked for every unit. Your summary examples include it for Story Points and Dev Days, and the Dev Days warning compares it to team size.

**Dev Days warning:** when unit is Dev Days and `tracks > teamMembers`, show an inline Atlaskit `SectionMessage` (warning) or helper text under the parallel field: _"Team members will need to split their time across multiple {work items | Epics}."_

### Summary

A muted line under both subsections that shows `describeEstimation(watchedValues, itemsLabel)` and updates live:

- Story Points: "40 story points per 10-day sprint. Up to 2 work items in parallel."
- Dev Days: "10 full-time team members. Up to 3 work items in parallel."
- Team Working Days: "Estimates are based on working days and assume the full team. Up to 2 work items in parallel."
- Team Weeks: "Estimates are based on weeks and assume one-third of the team. Up to 4 work items in parallel."
- Team Sprints: "Estimates are based on 10-day sprints and assume half the team. Up to 2 work items in parallel."

When parallel = 1, the last sentence reads "One work item at a time."

**Spread effort** stays where it is, after the summary and before the `Hr` that comes ahead of the Jira field selects. It isn't part of either subsection.

Subsection headings use the existing `Heading size="xsmall"` style. The "required field" note stays at the top.

## AutoScheduler team bar

Each team's header row (`AutoScheduler.tsx` `TeamHeaderRow` → `TeamCapacityControls.tsx`) currently reads:

```
[−] 2 tracks [+]   Capacity [21] pts / sprint        Points / Day 2.1   Total Working Days 34
```

The `[21]` is an Atlaskit `InlineEdit` (`CapacityField.tsx`). It looks like plain bold text, but clicking it edits a what-if override.

After this change:

```
[−] 2 Epics in parallel [+]   Capacity [20] points / sprint   2 points / day   Total working days 34
```

- **Tracks → "N {work items | Epics} in parallel".** Update the `TrackStepper` label to use the scheduled level's plural name, with the singular when the value is 1. Rewrite the tooltip (`trackTooltip`) in the same language: "work items in parallel" instead of "tracks", and the effective capacity in the team's unit instead of "points".
- **"Total working days"** is unchanged apart from sentence case.
- **Capacity / period** and **Capacity / working day** replace "Capacity # pts / sprint" and "Points / Day". They show whole-team throughput, which is what the bar shows today: per day = `effective velocity ÷ sprint length` = `team.teamData.totalPointsPerDay`.

| Unit              | Capacity / period            | Capacity / working day      |
| ----------------- | ---------------------------- | --------------------------- |
| Story Points      | **20** points / sprint       | 2 points / day              |
| Dev Days          | —                            | **5** dev days / day        |
| Team Working Days | —                            | 2 half-team days / day      |
| Team Weeks        | 2 half-team weeks / week     | 0.4 half-team weeks / day   |
| Team Sprints      | 2 half-team sprints / sprint | 0.2 half-team sprints / day |

The examples assume a half-team share and a 10-day sprint. Your draft showed `1 … / period` for the half-team rows; that's per work item when 2 run in parallel. We agreed on whole-team throughput because it matches today's "Points / Day". With **Full Team** the rows read `1 team week / week`, `0.2 team weeks / day`, and so on.

- Formulas (V = effective velocity, S = sprint length, f = share): per day = `V / S`. Team Weeks per week = `5V / S`. Team Sprints per sprint = `V`. For Dev Days and Team Working Days the period _is_ a day, so only the per-day cell shows.
- Share labels: `full` → "team", `half` → "half-team", `third` → "third-team", `quarter` → "quarter-team". Plural when the value ≠ 1. Round to 2 decimals (`roundTo`).
- Put the formatting in a pure `formatCapacity(unit, share, V, S) → { perPeriod?: {value, label}, perDay: {value, label} }` in `shared/estimation.ts`, next to `describeEstimation`.
- **Editable values (bold above):**
  - Story Points: the per-sprint number stays the `CapacityField` and still overrides `velocityPerSprint`.
  - Dev Days: the per-day number becomes the `CapacityField`. Dev days per day _is_ team members, so the override and the commit write `teamMembers`.
  - Team Working Days, Weeks and Sprints: capacity is read-only, because it comes only from the share. The parallel stepper is the only what-if. The tooltip says the share is changed in Team Configuration.
- **Plumbing:**
  - The bar needs the team's unit and share. Add `estimateUnit` and `estimateTeamShare` to `NormalizedIssue['team']` (`src/jira/shared/types.ts`), with the getters `getEstimateUnit` / `getEstimateTeamShare` in `NormalizeIssueConfig`. Their defaults in `jira/normalized/defaults.ts` are `storyPoints` / `full`, and they're wired in `shared/normalize.ts`.
  - `TeamCapacityInputs` takes `estimateUnit`, `estimateTeamShare` and `daysPerSprint` from `team.teamData`.
  - `TeamCapacityOverride` / `TeamCapacity` (`capacity-overrides/types.ts`) gain `teamMembers?`.
  - `applyCapacityOverrides`' `getVelocity`: a `teamMembers` override returns `teamMembers × base.getDaysPerSprint(issue, config)`.
  - `useTeamCommit`: `CAPACITY_FIELDS` gains `teamMembers`.
  - `useTeamIsDirty` counts `teamMembers`.

## Other consumers

- **`EstimateBreakdownModal` / `CalculationBreakdown`** show velocity as "points". They stay mathematically correct because they read the effective velocity. Rewording them is out of scope; it's a follow-up.
- **`src/jira/storage/index.web.ts`** (legacy team table) is left unchanged.

### Follow-up: views that show the raw per-period velocity (not fixed yet)

Dev Days, Team Working Days and Team Weeks schedule against a fixed 5-day period (`UNESTIMATED_WORKING_DAYS` in `Teams/shared/estimation.ts`). That period cancels out of every estimated duration, and its only intended effect is the default for unestimated items. These views print the raw `team.velocity`, the effective velocity _per period_, so the internal 5 leaks into what the user sees. A 5-member Dev Days team shows **25**, labelled as points or as "per sprint":

- **`src/react/reports/TableReport/components/EstimateBreakdownModal/EstimateBreakdownModal.tsx:136, :154`**: shows `issue.team?.velocity` in the breakdown, and the current/previous comparison via `valueKey="team.velocity"`.
- **`src/react/reports/GanttReport/GanttGrid/components/PercentCompleteModal/CalculationBreakdown.tsx:123`**: `CalculationBox title="Capacity per sprint"` shows `issue.team?.velocity`. For the non-sprint units this is neither a sprint nor points.
- **`src/react/reports/AutoScheduler/IssueSimulationRow.tsx:184, :189`**: the bar tooltip's "N adjusted points" and "N estimated points". The values are right (they are in the team's unit), but the label always says "points".

Likely fix: show capacity with `formatCapacity` (per day, plus per period only for units that have a real period), and label estimates with the team's unit instead of "points".

## Feature flag

Put the new form behind a Features-tab toggle, `estimationQuestions` ("Estimation questions", off by default), with one entry in `src/configuration/features.ts`. When it's off, both forms render today's three fields. `getEffectiveVelocity` always runs, because without a saved `estimateUnit` it's identical to the current behavior.

## Steps

1. Add the fields and defaults in `shared.ts` and `allTeamDefault.ts`.
2. Add `shared/estimation.ts` (`getEffectiveVelocity`, `describeEstimation`) and use it in `shared/normalize.ts` `getVelocity`.
3. Build `EstimationQuestions` and a small `pluralize(level name)` helper.
4. Replace the capacity block in `ConfigureTeamsForm.tsx` and `AllTeamsDefaultsForm.tsx` with it, behind the flag. Pass `itemLabel` from `ConfigureTeams.tsx` (`IssueAccordion`).
5. Add the flag to `features.ts`.
6. AutoScheduler bar: add the normalized `estimateUnit`/`estimateTeamShare`, `formatCapacity`, relabel the stepper and readouts, add the `teamMembers` override and commit path, and make capacity read-only for the team-share units. This ships with everything else; it isn't behind the flag, because a story-points team's bar only changes in wording.
7. Update `team-configuration/Readme.md` with the unit → velocity table.

## Tests

- `estimation.test.ts`: covers `getEffectiveVelocity` for each unit and share, a missing `estimateUnit` (falls back to `velocityPerSprint`), and the three spot checks above run end-to-end through `pointsPerDayPerTrack`. Covers `describeEstimation` for every example string plus the parallel = 1 wording.
- `normalize.estimation.test.ts`: a team on Dev Days produces `getVelocity` = members × sprintLength. A team with an inherited unit and its own `teamMembers` resolves correctly.
- `EstimationQuestions.test.tsx` (RTL): each unit shows exactly the questions in the tables. The Dev Days warning appears only when parallel > members. The summary updates live. Labels say "as a team" / "work items" on defaults and "Epics" on a level accordion. Inheriting mode follows an inherited unit.
- `estimation.test.ts` also covers `formatCapacity`: every row of the bar table, full vs. half share, singular vs. plural, and the per-period cell left out for Dev Days and Team Working Days.
- `TeamCapacityControls.test.tsx`: the stepper reads "2 Epics in parallel" / "1 Epic in parallel". A Story Points team edits and overrides `velocityPerSprint`. A Dev Days team edits the per-day value and overrides `teamMembers`. A Team Weeks team has no editable capacity.
- `applyCapacityOverrides.test.ts`: a `teamMembers` override gives `getVelocity` = members × days per sprint.
- `useTeamCommit.test.tsx`: commits `teamMembers` to the level that already holds it, or else to `defaults`.

## Verification

- `npm test` (vitest) passes, plus `npm run typecheck` and lint.
- Run locally with the flag on and go through each unit in global defaults, a team's defaults, and a team's Epic accordion. Confirm the questions, the warning, and the summary. Confirm the Gantt/AutoScheduler durations change as expected (for example, Dev Days with 10 members, P=2, and a 20 dev-day Epic gives 4 working days).
- With the flag off, the form and all durations match `main`.
