# 042 — Team estimation settings

The plan as built. It merges the original plan (estimate units, plain-language questions) and part 2 (headcount drives capacity), with every later revision folded in. Where the two disagreed, this file describes what the code does now.

## Context

Every Team Configuration form (global defaults, global per work item type, team defaults, team per work item type) used to ask for three raw numbers: **Capacity per sprint**, **Tracks**, and **Sprint length**. They only made sense for story points, and "tracks" is jargon. The forms now start with _"What units do you use to estimate?"_, ask follow-ups for that unit, and end with a one-line summary.

Every team also states its headcount, and headcount drives capacity: the AutoScheduler can show what adding a developer does to the schedule.

## Starting point

Branch `feature/team-estimation-settings`. Estimate units (`estimateUnit`, `estimateTeamShare`, `teamMembers`) already shipped on `main`, so saved configs in every unit exist in the wild.

Key files (`Teams/` = `src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/`):

| File                                                                     | What's there                                                                                                                                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/jira/normalized/normalize.ts`                                       | The engine: `pointsPerDayPerTrack = velocity / daysPerSprint / parallelWorkLimit`. Unchanged.                                                                               |
| `src/jira/derived/work-timing/work-timing.ts`                            | Unestimated default `velocity / parallelWorkLimit`; `daysOfWork = estimate / pointsPerDayPerTrack`. Unchanged.                                                              |
| `Teams/shared/estimation.ts`                                             | All the math and wording: `getPointsPerPersonDay`, `getEffectiveVelocity`, `pointsPerPersonDayFor*`, `getDefaultTracks`, `describeEstimation`, `formatCapacity`, `SHARE`, … |
| `Teams/shared/normalize.ts`                                              | Inheritance lookup and the normalize getters (`getVelocity`, `getDaysPerSprint`, `getEstimateUnit`, `getPointsPerPersonDay`, `getTeamMembers`, …).                          |
| `Teams/services/team-configuration/team-configuration/shared.ts`         | `Configuration` and `createEmptyConfiguration`.                                                                                                                             |
| `Teams/services/team-configuration/team-configuration/allTeamDefault.ts` | `nonFieldDefaults` (`estimateUnit: 'storyPoints'`, `teamMembers: 5`, `estimateTeamShare: 'full'`, `pointsPerPersonDay: null`).                                              |
| `Teams/services/team-configuration/team-configuration/inheritance.ts`    | Per-field inheritance; X resolves with the unit (`CAPACITY_ANCHOR_FIELDS`, `anchorsCapacity`, `getCapacityLevel`).                                                          |
| `Teams/services/team-configuration/team-configuration/Readme.md`         | Unit → velocity table and the inheritance rules.                                                                                                                            |
| `Teams/components/EstimationQuestions/EstimationQuestions.tsx`           | The settings questions, shared by every form (`mode: 'global' \| 'inheriting'`).                                                                                            |
| `src/react/services/capacity-overrides/`                                 | AutoScheduler what-ifs: `types.ts` (`TeamCapacityOverride`: `pointsPerPersonDay`, `tracks`, `teamMembers`), `applyCapacityOverrides.ts`, `CapacityOverridesProvider.tsx`.   |
| `src/react/reports/AutoScheduler/components/TeamCapacityControls/`       | The team bar: `TeamCapacityControls.tsx`, `CapacityField.tsx`, `TrackStepper.tsx`, `HeadcountCommitSteps.tsx`, `useTeamCommit.ts`, `useTeamSettings.ts`.                    |
| `src/jira/storage/index.web.ts`                                          | Legacy team table; shows `X × N × sprintLength` as velocity when X is stored, else the legacy `velocityPerSprint`.                                                          |

## Estimate units

| Unit (`estimateUnit`) | Label             | 1 estimate means                                        |
| --------------------- | ----------------- | ------------------------------------------------------- |
| `storyPoints`         | Story Points      | a story point; the team states its velocity per sprint  |
| `devDays`             | Dev Days          | 1 day of work for 1 developer                           |
| `teamDays`            | Team Working Days | 1 day of work for a share of the team                   |
| `teamWeeks`           | Team Weeks        | 1 week (5 working days) of work for a share of the team |
| `teamSprints`         | Team Sprints      | one sprint of work for a share of the team              |

Team Days / Weeks / Sprints are the **team-time units**. Their share (`estimateTeamShare`) is full, half, third or quarter of the team.

**No migration for the unit.** A saved config without `estimateUnit` resolves to `storyPoints`, which is the old math exactly.

## The model: points per person per day

Each team has one capacity number, **X** (`pointsPerPersonDay`): estimate units one person finishes in one working day, in the team's own unit. "Points" below means whatever the team's **Estimate Field** holds.

With headcount N, tracks T and the scheduling period P:

```
team / day           = X × N
per track / day      = X × N / T          (= pointsPerDayPerTrack)
V (engine velocity)  = X × N × P
```

The engine is unchanged: `getVelocity` returns `X × N × P` (`getEffectiveVelocity`), and P cancels out of every estimated duration. P's only effect is the default for unestimated items: one period, so they take P working days whatever the headcount. P is the sprint length for Story Points and Team Sprints, and `UNESTIMATED_WORKING_DAYS` (10) for the others (`getSchedulingPeriodDays`).

Total working days = Σ estimates ÷ (X × N). Tracks don't change it; they only split the team across items in progress.

### X per unit

| Unit         | X                             | Stored?                                     | Example (10 devs, 2-week sprints) |
| ------------ | ----------------------------- | ------------------------------------------- | --------------------------------- |
| Story Points | velocity / (N × sprint days)  | yes, `pointsPerPersonDay`                   | 21 / (10 × 10) = **0.21**         |
| Dev Days     | 1                             | no (always 1)                               | **1**                             |
| Team Days    | 1 / (share × N × 1)           | no — derived from share and saved headcount | half: 1 / (5 × 1) = **0.2**       |
| Team Weeks   | 1 / (share × N × 5)           | no                                          | half: 1 / (5 × 5) = **0.04**      |
| Team Sprints | 1 / (share × N × sprint days) | no                                          | half: 1 / (5 × 10) = **0.02**     |

The team-time formula is the same as the old share formula, so those configs need no migration. Because X follows the **saved** headcount, the team rate X × N = 1 / (share × unit days) doesn't depend on N: "half team" always means half of whoever is on the team as saved.

### Migration (Story Points)

Configs saved before X existed have none. `getPointsPerPersonDay` derives it on read:

```
X = legacy velocity / (P × N)
```

With the saved N this reproduces the old V exactly, so nothing changes on upgrade. Until X is stored, `getEffectiveVelocity` returns the legacy velocity directly (no NaN for configs without a sprint length). `velocityPerSprint` is read only for this and is never written again.

**Default headcount is 5** (was 1). Dev Days teams with no saved `teamMembers` get 5× capacity on upgrade; call it out in release notes.

**Re-anchor.** Most teams never entered a headcount, so their X was derived against the default 5. The first headcount a team enters in settings re-anchors X ("this velocity assumes 10 people"), so capacity doesn't change. "Never entered" means no saved `teamMembers` anywhere in the inheritance chain (`team[level]` → `team.defaults` → `__GLOBAL__[level]` → `__GLOBAL__.defaults`); no new field.

**Pin.** If a headcount is saved while X is still derived, X is saved at its current value, or the derived X would follow the new headcount and cancel it out.

Both live in `pointsPerPersonDayForHeadcount`, which returns `undefined` for Dev Days and the team-time units.

### Inheritance

Fields inherit one by one through the chain above. **X resolves with the unit:** it comes from the most specific level that saves any of `pointsPerPersonDay`, `estimateUnit`, `velocityPerSprint` or `estimateTeamShare` (`CAPACITY_ANCHOR_FIELDS`), so a level that changes the unit never reads a foreign X. Headcount inherits on its own, so a team inheriting the global X with its own headcount gets capacity scaled to its size.

### Worked tables

2-week sprints. "Old V" is the engine velocity before this change; the 10-developer rows match it exactly.

#### Team Weeks, half team (X = 0.04, held fixed in the AutoScheduler)

| Developers | Tracks | Per track / day | Points / day (team) | Points / day (person) | Old V (half-team weeks / 10-day period) |
| ---------- | ------ | --------------- | ------------------- | --------------------- | --------------------------------------- |
| 10         | 1      | 0.4             | 0.4                 | 0.04                  | 4                                       |
| 10         | 2      | 0.2             | 0.4                 | 0.04                  | 4                                       |
| 10         | 3      | 0.13            | 0.4                 | 0.04                  | 4                                       |
| 11         | 1      | 0.44            | 0.44                | 0.04                  | 4                                       |
| 11         | 2      | 0.22            | 0.44                | 0.04                  | 4                                       |
| 11         | 3      | 0.15            | 0.44                | 0.04                  | 4                                       |

#### Story Points, 21 / sprint (X = 0.21)

| Developers | Tracks | Per track / day | Points / day (team) | Points / day (person) | Old V (pts / sprint) |
| ---------- | ------ | --------------- | ------------------- | --------------------- | -------------------- |
| 10         | 1      | 2.1             | 2.1                 | 0.21                  | 21                   |
| 10         | 2      | 1.05            | 2.1                 | 0.21                  | 21                   |
| 10         | 3      | 0.7             | 2.1                 | 0.21                  | 21                   |
| 11         | 1      | 2.31            | 2.31                | 0.21                  | 21                   |
| 11         | 2      | 1.16            | 2.31                | 0.21                  | 21                   |
| 11         | 3      | 0.77            | 2.31                | 0.21                  | 21                   |

#### Story Points, 30 / sprint (X = 0.3)

| Developers | Tracks | Per track / day | Points / day (team) | Points / day (person) | Old V (pts / sprint) |
| ---------- | ------ | --------------- | ------------------- | --------------------- | -------------------- |
| 10         | 1      | 3               | 3                   | 0.3                   | 30                   |
| 10         | 2      | 1.5             | 3                   | 0.3                   | 30                   |
| 10         | 3      | 1               | 3                   | 0.3                   | 30                   |
| 11         | 1      | 3.3             | 3.3                 | 0.3                   | 30                   |
| 11         | 2      | 1.65            | 3.3                 | 0.3                   | 30                   |
| 11         | 3      | 1.1             | 3.3                 | 0.3                   | 30                   |

#### Dev Days (X = 1)

| Developers | Tracks | Per track / day | Points / day (team) | Points / day (person) | Old V (dev days / 10-day period) |
| ---------- | ------ | --------------- | ------------------- | --------------------- | -------------------------------- |
| 10         | 1      | 10              | 10                  | 1                     | 100                              |
| 10         | 2      | 5               | 10                  | 1                     | 100                              |
| 10         | 3      | 3.33            | 10                  | 1                     | 100                              |
| 11         | 1      | 11              | 11                  | 1                     | 110                              |
| 11         | 2      | 5.5             | 11                  | 1                     | 110                              |
| 11         | 3      | 3.67            | 11                  | 1                     | 110                              |

#### Team Sprints, half team (X = 0.02, held fixed in the AutoScheduler)

| Developers | Tracks | Per track / day | Points / day (team) | Points / day (person) | Old V (half-team sprints / sprint) |
| ---------- | ------ | --------------- | ------------------- | --------------------- | ---------------------------------- |
| 10         | 1      | 0.2             | 0.2                 | 0.02                  | 2                                  |
| 10         | 2      | 0.1             | 0.2                 | 0.02                  | 2                                  |
| 10         | 3      | 0.067           | 0.2                 | 0.02                  | 2                                  |
| 11         | 1      | 0.22            | 0.22                | 0.02                  | 2                                  |
| 11         | 2      | 0.11            | 0.22                | 0.02                  | 2                                  |
| 11         | 3      | 0.073           | 0.22                | 0.02                  | 2                                  |

The 11-developer rows for the team-time units are what the AutoScheduler's what-if shows. Saving 11 in settings instead keeps the 10-developer rates (see **Headcount by unit**).

Fractional days are expected: a week of work for 5 people is 25 person-days, so a 5.5-person track takes 4.55 working days. The UI never says "a week takes 4.55 days"; it shows rates, and estimates stay in the team's unit.

### Why store X and not the team rate

1. **A headcount edit writes only headcount** (plus X where a pin, re-anchor or takeover needs it). A stored team rate would have to be rescaled with every headcount change.
2. **Inheritance works.** A 4-person and a 12-person team inheriting the same X get different capacity.
3. **Tracks and headcount stay independent**, as the tables show.

## Headcount by unit

Does more developers mean less total working days?

| Unit                        | AutoScheduler what-if | Saving the headcount (settings, or Commit)                                                                                    |
| --------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Story Points                | yes, X held fixed     | yes — except the first headcount a team ever enters, which re-anchors. Commit saves directly.                                 |
| Dev Days                    | yes                   | yes, X is always 1. Commit saves directly.                                                                                    |
| Team Days / Weeks / Sprints | yes, X held fixed     | no — X follows the saved headcount, so each estimate grows with the team. **Commit doesn't save**; it shows the manual steps. |

**Story Points: a headcount change customizes inherited velocity.** Once the headcount is the team's own, X × N × sprint days is the team's own number. A level still inheriting X writes X and the unit alongside a new headcount (settings and Commit), so the velocity field never reads "inheriting" next to a value the inherited answer doesn't have, and a later global change can't silently rescale it. A level that already has its own X writes only the headcount.

**Team-time units: manual steps on Commit.** Committing the what-if would redefine "half team" as half of the new team, and the speedup would vanish. Instead, Commit opens `HeadcountCommitSteps`:

> Make 11 developers your team size
>
> Your estimates assume half team: 5 people of 10 developers. …
>
> 1. In Jira, multiply each Story Points estimate by 10 ÷ 11. For example, 3 becomes 2.73.
> 2. In Team settings, set the developers to 11. Estimates will then assume half team: 5.5 people.

The estimates shrink by 10/11 and the team rate stays the same, so total working days drop by 10/11 — the same as the what-if. A tracks-only change still commits for every unit. Team settings never warn about converting estimates; the steps live only on the Commit.

## When X is written

| Edit                                                        | Writes                                                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Story Points: points per sprint (settings or AutoScheduler) | X = velocity / (N × sprint days)                                                                       |
| Story Points: sprint length                                 | X = points per sprint / (N × new sprint days), so points per sprint stay the same                      |
| Story Points: headcount                                     | `teamMembers`; plus X when re-anchoring, pinning, or taking over an inherited X (with `estimateUnit`)  |
| Dev Days: headcount                                         | `teamMembers` (settings also resets `tracks`)                                                          |
| Team-time unit: share, unit, Team Sprints sprint length     | the answer, with `pointsPerPersonDay: null` (settings also resets `tracks` for share and unit)         |
| Team-time unit: headcount (settings only)                   | `teamMembers`; clears a stored X on that level                                                         |
| Switching to Story Points or Dev Days                       | X from that unit's formula with the current answers (Story Points keeps the current points per sprint) |
| Tracks                                                      | `tracks` only                                                                                          |

**Tracks defaults (`getDefaultTracks`), settings only:** Dev Days → `floor(N)`; team-time units → one per share (full 1, half 2, third 3, quarter 4), so a headcount change never moves them; Story Points → none. Applied when the unit, share or headcount changes. The AutoScheduler never resets tracks.

## Settings form

`EstimationQuestions` replaces the capacity block in `ConfigureTeamsForm.tsx` and `AllTeamsDefaultsForm.tsx`. Global mode renders `TextField`/`Select`; inheriting mode renders `InheritanceTextField`/`InheritanceSelect` with a customize toggle. Form `defaultValues` are the inherited data, so an inherited unit still drives which questions show. Wording uses "as a team" / "work items" on `defaults` accordions and the level's plural ("Epics") on per-type accordions.

### Estimate units

| Question                                                                                                                        | Field               | Shown when                 |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------- | -------------------------- |
| What units do you use to estimate {as a team \| Epics}? `[Story Points, Dev Days, Team Working Days, Team Weeks, Team Sprints]` | `estimateUnit`      | always                     |
| How many weeks are in a sprint? (stored as working days)                                                                        | `sprintLength`      | Story Points, Team Sprints |
| How much of the team does one estimate assume? `[Full team, Half team, One third team, Quarter team]`                           | `estimateTeamShare` | team-time units            |
| _One week is 5 working days._ (static)                                                                                          | —                   | Team Weeks                 |

Hints under the unit: "The {Estimate Field} your team puts on your {Epics} represent {unit}." (not for Story Points) and "{Epics} without estimates default to {10 working days}." Under the share: "Half team of 10 developers: estimates assume 5 people."

The unit and its capacity customize and inherit together: customizing writes `{estimateUnit, pointsPerPersonDay}` (Story Points / Dev Days) or `{estimateUnit, estimateTeamShare}` (team-time units).

### Team capacity

| Question                                                                      | Field                                  | Shown when   |
| ----------------------------------------------------------------------------- | -------------------------------------- | ------------ |
| How many developers are on the team? (decimals allowed, > 0)                  | `teamMembers`                          | always       |
| On average, how many story points does your team complete per sprint?         | shown as X × N × sprint days; writes X | Story Points |
| How many {work items \| Epics} can your team work on in parallel, on average? | `tracks`                               | always       |

Headcount and sprint length commit on blur (`DerivedNumberField`), because they save more than themselves, computed from the values before the edit.

**Dev Days warning:** when `tracks > teamMembers`, a warning `SectionMessage`: "Team members will need to split their time across multiple {work items | Epics}."

### Summary

An info box under the questions shows `describeEstimation`, live:

- Story Points: "21 Story Points per 2-week sprint with 10 developers. With 2 work items in parallel."
- Dev Days: "1 Story Point is 1 day of work for 1 developer. 10 developers. With 3 work items in parallel."
- Team Weeks: "1 Story Point is 1 week of work for 5 people (50% of the team). 10 developers. With 2 work items in parallel."
- Team Sprints: "1 estimate is one 2-week sprint of work for 5 people (50% of the team). …"

The label is the Estimate Field's display name (singular/plural; "estimate(s)" when none). With parallel = 1 the last sentence is "One work item at a time." **Spread effort** stays after the summary.

## AutoScheduler team bar

```
[−] 2 Epics in parallel [+] (5 each)   [10] developers   [Reset][Commit]      0.04 Story Points / day (person) · 0.4 Story Points / day (team)   Total working days 34
```

- **Left:** the tracks stepper ("N {work items | Epics} in parallel", people per track), the editable developers count, and Reset / Commit while the row has an uncommitted change (uncommitted styling via `useTeamIsDirty`).
- **Right, next to Total working days:** the rates, labelled with the Estimate Field's name.
  - Per person: `X` "{field} / day (person)", for every unit. Its tooltip says what one unit of the field means (`describeEstimateUnit`).
  - Team, Story Points: "{X × N × sprint days} {field} / sprint (team)", editable; the edit writes X at the current headcount.
  - Team, every other unit: "{X × N} {field} / day (team)".
- **Developers** is an `InlineEdit` for every unit and never re-anchors: the per-person rate stays, the team rate scales.
- The tracks tooltip explains that more items in parallel doesn't add capacity; adding developers does.

`formatCapacity` still computes per-period rates (sprint for Story Points and Team Sprints, week for Team Weeks):

| Estimate unit              | 1 Story Point means  | Per developer             | Team (10 developers)    | Team (11 developers)       |
| -------------------------- | -------------------- | ------------------------- | ----------------------- | -------------------------- |
| Story Points (21 / sprint) | a story point        | 0.21 / day · 2.1 / sprint | 2.1 / day · 21 / sprint | 2.31 / day · 23.1 / sprint |
| Dev Days                   | 1 day of 1 developer | 1 / day                   | 10 / day                | 11 / day                   |
| Team Days (half)           | 1 day of 5 people    | 0.2 / day                 | 2 / day                 | 2.2 / day                  |
| Team Weeks (half)          | 1 week of 5 people   | 0.04 / day · 0.2 / week   | 0.4 / day · 2 / week    | 0.44 / day · 2.2 / week    |
| Team Sprints (half)        | 1 sprint of 5 people | 0.02 / day · 0.2 / sprint | 0.2 / day · 2 / sprint  | 0.22 / day · 2.2 / sprint  |

**Plumbing:**

- `NormalizedIssue['team']` carries `estimateUnit`, `pointsPerPersonDay` and `teamMembers` (getters in `NormalizeIssueConfig`, defaults in `jira/normalized/defaults.ts`, wired in `shared/normalize.ts`).
- `applyCapacityOverrides.getVelocity`: `X × N × P` from the override or the base values, for every unit.
- `useTeamCommit`: `CAPACITY_FIELDS` = `pointsPerPersonDay`, `estimateUnit`, `tracks`, `teamMembers`. X (and the unit, when the team takes over an inherited X) goes to the level that anchors capacity (`getCapacityLevel`); headcount and tracks go to the level that already holds them, else `defaults`. A headcount commit pins a derived X and never re-anchors. One team's commit never changes `__GLOBAL__` or another team.

## Implications

- **No schedule changes on upgrade**, apart from Dev Days teams with no saved headcount (1 → 5).
- **Linear scaling** in the what-if: 10 → 20 developers halves every estimated duration, with no ramp-up or coordination cost. No warning in the UI.
- **Unestimated items don't speed up**: they take one period whatever the headcount.
- **Story Points needs a headcount.** Velocity is observed for the whole team, so the per-person split assumes everyone is equally productive; adding a developer raises points per sprint.

## Other consumers (follow-up, not fixed)

These views print the raw `team.velocity` (V per period) or say "points". The numbers are right but the labels aren't; for the non-sprint units the internal 10-day period leaks (a 5-member Dev Days team shows **50**):

- `src/react/reports/TableReport/components/EstimateBreakdownModal/EstimateBreakdownModal.tsx`: `issue.team?.velocity` and the `team.velocity` comparison.
- `src/react/reports/GanttReport/GanttGrid/components/PercentCompleteModal/CalculationBreakdown.tsx`: "Capacity per sprint" shows `issue.team?.velocity`.
- `src/react/reports/AutoScheduler/IssueSimulationRow.tsx`: "N adjusted points" / "N estimated points" in the bar tooltip.

Likely fix: show capacity with `formatCapacity` and label estimates with the Estimate Field name.

Also open, not planned: whether the tracks input should be hidden for the team-time units (it defaults from the share), and scheduler swarming/lane-packing.

## Feature flag

None. The form first shipped behind the `estimationQuestions` Features-tab toggle, which was removed along with the old three-field forms.

## Tests

- `estimation.test.ts`: X per unit and share; legacy derivation reproduces the old V; every worked-table row through `pointsPerDayPerTrack`; re-anchor and pin; `getDefaultTracks`; `describeEstimation` strings; `formatCapacity` readout table.
- `normalize.estimation.test.ts`, `inheritance.test.ts`: X resolves with the unit; inherited X with an own headcount scales.
- `EstimationQuestions.test.tsx`: questions per unit; share options and hint; tracks resets; headcount re-anchor; Story Points takeover of an inherited X; no "convert your estimates" warning; summary; inheriting mode.
- `applyCapacityOverrides.test.ts`: a headcount override scales V for every unit; a tracks override leaves team / day unchanged.
- `TeamCapacityControls.test.tsx`: readouts per unit; 10 → 11 keeps the per-person rate and scales the team rate; manual steps on team-time headcount commits; tracks-only commits save.
- `useTeamCommit.test.tsx`: fields land on the right levels; pinning; inherited-X takeover with the unit; `__GLOBAL__` and other teams untouched.

## Verification

`npm test`, `npm run typecheck` and lint. Locally, walk each unit through global defaults, a team's defaults and an Epic accordion, then change developers and tracks in the AutoScheduler and commit.
