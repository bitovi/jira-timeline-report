# 040 (part 2) — Headcount drives capacity for every estimate unit

## Context

[plan.md](./plan.md) gave each estimate unit its own **effective velocity** (`getEffectiveVelocity` in `Teams/shared/estimation.ts`). Only Dev Days reads the team's headcount (`teamMembers`). For every other unit, headcount is shown but changes nothing:

| Unit         | Effective velocity today (V, per period P) | Reads `teamMembers`? |
| ------------ | ------------------------------------------ | -------------------- |
| Story Points | `velocityPerSprint`                        | no                   |
| Dev Days     | `teamMembers × P`                          | yes                  |
| Team Days    | `P / share`                                | no                   |
| Team Weeks   | `P / (5 × share)`                          | no                   |
| Team Sprints | `1 / share`                                | no                   |

The goal: every team states its headcount, and the AutoScheduler team bar reads

```
10 developers · 0.04 Story Points / day each (0.2 / week) · 0.4 Story Points / day (2 / week)
```

where "Story Points" is the name of the team's Estimate Field and, for a Team Weeks team, 1 Story Point means 1 week of work for 5 people.

The `10` can be edited inline. Bumping it to 11 raises capacity by 10% for **every** unit, and editing headcount in the AutoScheduler or in Team Configuration does exactly the same thing, as the existing points-per-sprint edit already does (`useTeamCommit` writes through to settings).

## Starting point

Work continues on branch `feature/team-estimation-settings`, on top of plan.md, which is implemented. Estimate units (`estimateUnit`, `estimateTeamShare`, `teamMembers`) are already on `main`, so saved configs in every unit exist in the wild.

Key files (`Teams/` = `src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/`):

| File                                                                     | What's there today                                                                                                                                                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/jira/normalized/normalize.ts:66-71`                                 | The engine: `pointsPerDayPerTrack = velocity / daysPerSprint / parallelWorkLimit`. Unchanged by this plan.                                                                                   |
| `src/jira/derived/work-timing/work-timing.ts:64, :94`                    | Unestimated default `velocity / parallelWorkLimit`; `daysOfWork = estimate / pointsPerDayPerTrack`. Unchanged.                                                                               |
| `Teams/shared/estimation.ts`                                             | `getEffectiveVelocity`, `getSchedulingPeriodDays`, `UNESTIMATED_WORKING_DAYS` (10), `getDefaultTracks`, `describeEstimation`, `formatCapacity`, `SHARE`. Most of the math change lands here. |
| `Teams/shared/normalize.ts`                                              | `getConfiguration` (inheritance lookup) and the normalize getters (`getVelocity`, `getDaysPerSprint`, `getTeamMembers`, …).                                                                  |
| `Teams/services/team-configuration/team-configuration/shared.ts`         | `Configuration` type and `createEmptyConfiguration`.                                                                                                                                         |
| `Teams/services/team-configuration/team-configuration/allTeamDefault.ts` | `nonFieldDefaults` (`teamMembers: 1` → 5) and `getGlobalDefaultData`.                                                                                                                        |
| `Teams/services/team-configuration/team-configuration/Readme.md`         | Unit → velocity table; update it.                                                                                                                                                            |
| `Teams/components/EstimationQuestions/EstimationQuestions.tsx`           | The settings questions (unit, share, headcount, sprint length, parallel).                                                                                                                    |
| `src/react/services/capacity-overrides/`                                 | `types.ts` (`TeamCapacityOverride`, `TeamCapacity`), `applyCapacityOverrides.ts` (Dev Days special case to generalize), `CapacityOverridesProvider.tsx`.                                     |
| `src/react/reports/AutoScheduler/components/TeamCapacityControls/`       | `TeamCapacityControls.tsx` (bar, `useTeamIsDirty`), `CapacityField.tsx` (InlineEdit), `TrackStepper.tsx`, `useTeamCommit.ts` (`CAPACITY_FIELDS`, commit-to-level logic).                     |
| `src/jira/storage/index.web.ts`                                          | Legacy team table that reads `velocityPerSprint`.                                                                                                                                            |

Verify with `npm test`, `npm run typecheck` and lint. Each file above has a sibling `*.test.ts(x)`.

## Why the obvious approaches don't work

- **Dividing today's team capacity by headcount** gives a per-person number that shrinks when people are added, so 10 → 11 changes nothing.
- **Treating the saved headcount as a baseline and the AutoScheduler value as a what-if** breaks as soon as the what-if is committed: the baseline becomes 11 and the speedup disappears. Settings and the AutoScheduler would also disagree.
- **"Half the team" is relative to the team.** If the team grows, the unit grows with it and headcount cancels out. Headcount can only matter if each estimate unit is pinned to a fixed amount of person-time.

## The model: store points per person per day

Every unit stores one number, **X**: estimate units one person finishes in one working day, in the team's estimate unit. "Points" below means whatever the numbers in the team's **Estimate Field** are, as defined by its **estimate unit**.

```
X = 1 / (person-days in one estimate unit)
```

Everything the scheduler and the UI need is calculated from X, the headcount N, the tracks T and the period P:

```
team / day           = X × N
per track / day      = X × N / T          (= pointsPerDayPerTrack)
V (engine velocity)  = X × N × P
```

The engine is unchanged: `getVelocity` returns `X × N × P`, and P still cancels out of every estimated duration. P's only effect remains the default for unestimated items (one period).

**X never changes from a headcount or tracks edit.**

- **Headcount (N)** changes the team's total and every track's rate.
- **Tracks (T)** only change how the people are divided across items in progress. The team total stays the same, and each item runs faster or slower.
- **X** changes only when the team redefines what one estimate unit is: a new velocity, unit, people per estimate, or sprint length.

### X per unit

N₀ is the headcount when X is set. "People" is the team's answer to "How many people does one estimate assume?" (migrated from the old share as f × N₀, with f = full 1, half ½, third ⅓, quarter ¼). The examples use 10 developers, 2-week sprints (10 days) and 5 people per estimate.

| Unit         | Formula                           | Example                                  |
| ------------ | --------------------------------- | ---------------------------------------- |
| Story Points | X = velocity / (N₀ × sprint days) | X = 30 / (10 people × 10 days) = **0.3** |
| Dev Days     | X = 1                             | X = **1**                                |
| Team Days    | X = 1 / (people × 1 day)          | X = 1 / (5 people × 1 day) = **0.2**     |
| Team Weeks   | X = 1 / (people × 5 days)         | X = 1 / (5 people × 5 days) = **0.04**   |
| Team Sprints | X = 1 / (people × sprint days)    | X = 1 / (5 people × 10 days) = **0.02**  |

For example, a week of work for 5 people is 5 people × 5 days = 25 person-days, so X = 1/25. A story point at 30 per sprint for 10 people is 100 / 30 = 3.33 person-days, so X = 0.3.

### Worked tables

Each table uses 2-week sprints. The 10-developer rows match today's numbers exactly. The 11-developer rows show the change: today only Dev Days goes up with headcount, and with the change every unit goes up by 10%. "Old V" is today's engine velocity per period.

#### Team Weeks, 5 people per estimate (was half team) (X = 0.04)

| Developers | Tracks | Per track / day | Points / day (team) | Points / day (person) | Old V (half-team weeks / 10-day period) |
| ---------- | ------ | --------------- | ------------------- | --------------------- | --------------------------------------- |
| 10         | 1      | 0.4             | 0.4                 | 0.04                  | 4                                       |
| 10         | 2      | 0.2             | 0.4                 | 0.04                  | 4                                       |
| 10         | 3      | 0.13            | 0.4                 | 0.04                  | 4                                       |
| 11         | 1      | 0.44            | 0.44                | 0.04                  | 4                                       |
| 11         | 2      | 0.22            | 0.44                | 0.04                  | 4                                       |
| 11         | 3      | 0.15            | 0.44                | 0.04                  | 4                                       |

Old V = 10 / (5 × ½) = 4: each week both halves of the team finish one half-team week each, over a 2-week period.

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

Dev Days already works per person per day, so old and new match in every row. (Today, changing headcount also auto-sets tracks to the headcount via `getDefaultTracks`.)

#### Team Sprints, 5 people per estimate (was half team) (X = 0.02)

| Developers | Tracks | Per track / day | Points / day (team) | Points / day (person) | Old V (half-team sprints / sprint) |
| ---------- | ------ | --------------- | ------------------- | --------------------- | ---------------------------------- |
| 10         | 1      | 0.2             | 0.2                 | 0.02                  | 2                                  |
| 10         | 2      | 0.1             | 0.2                 | 0.02                  | 2                                  |
| 10         | 3      | 0.067           | 0.2                 | 0.02                  | 2                                  |
| 11         | 1      | 0.22            | 0.22                | 0.02                  | 2                                  |
| 11         | 2      | 0.11            | 0.22                | 0.02                  | 2                                  |
| 11         | 3      | 0.073           | 0.22                | 0.02                  | 2                                  |

### Why store X and not the team rate

1. **A headcount edit writes only headcount.** If the team rate were stored, every headcount change would also have to rescale it, so two fields would be written together and could get out of sync.
2. **Inheritance works.** A team that inherits the global X and sets its own headcount gets capacity scaled to its own size. A stored team rate would give a 4-person team and a 12-person team the same capacity.
3. **Tracks and headcount stay independent**, as the tables show.

### Fractional days are expected

A week of work for 5 people is 25 person-days. With 11 developers on 2 tracks, a track has 5.5 people, so the item takes 25 / 5.5 = 4.55 working days. A week is still 5 days; a bigger track just finishes the same person-time sooner. Story Points already produces fractions (1 pt = 0.48 days at 21 / sprint). The UI should never say "a week takes 4.55 days". It shows the rate, and the estimate stays in the team's unit.

## Data model

Add one field to `Configuration` (`.../team-configuration/shared.ts`) and `createEmptyConfiguration`:

```ts
pointsPerPersonDay: number | null; // X, in the team's estimate unit
```

- **X is the only stored capacity.** `velocityPerSprint` is no longer a source of truth and is no longer written. Anywhere a per-sprint number is needed (the Story Points question, the AutoScheduler field, the legacy team table in `src/jira/storage/index.web.ts`), calculate it as `X × N × sprintLength`. Saved `velocityPerSprint` values are only read once, by the migration.
- `estimateTeamShare` is no longer read after migration. The people-per-estimate answer is calculated from X.
- `teamMembers` becomes a capacity input for every unit, not just Dev Days. It can be set at every level (global defaults, global per type, team defaults, team per type) and inherits like every other field. Decimals are allowed (5 full-time + 1 half-time = 5.5); it must be greater than 0.
- **X and the estimate unit resolve together.** X is in the unit's own terms, so a level that overrides `estimateUnit` but inherits X would read X in the wrong unit. `getConfiguration` / inheritance must take X from the same level that supplied `estimateUnit`, or the level overriding the unit must also write X.

## When X is written

| Edit                                                        | Writes                                                                                                                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Story Points: points per sprint (settings or AutoScheduler) | X = velocity / (N × sprint days)                                                                                                                                                       |
| People per estimate (Team Days / Weeks / Sprints)           | X = 1 / (people × unit days)                                                                                                                                                           |
| Estimate unit                                               | X for the new unit, from that unit's formula with the current answers. Switching to Team Days / Weeks / Sprints with no people answer yet starts at the full team (people = headcount) |
| Team Sprints: sprint length                                 | X = 1 / (people × new sprint days), keeping people per estimate the same                                                                                                               |
| Story Points: sprint length                                 | X = points per sprint / (N × new sprint days), so points per sprint stays the same                                                                                                     |
| Headcount (settings or AutoScheduler)                       | `teamMembers` only (settings on Dev Days also resets `tracks`, see below)                                                                                                              |
| Tracks                                                      | `tracks` only                                                                                                                                                                          |

**Dev Days tracks reset only in settings.** Changing headcount in the settings form keeps today's behavior: `getDefaultTracks` overwrites `tracks` with the headcount. A headcount edit in the AutoScheduler leaves `tracks` alone, so the effect of adding people shows on its own.

## Migration

Saved configs have no X. Derive it on read until a team saves:

```
X = getEffectiveVelocity(config) / (getSchedulingPeriodDays(config) × N)
```

With the saved N, this gives exactly today's V, so no schedule changes on upgrade.

**Default headcount is 5.** `nonFieldDefaults.teamMembers` in `allTeamDefault.ts` changes from 1 to 5.

Saved shares migrate to people per estimate as `share × headcount` (half of 10 → 5), which is the same X.

**The catch:** most teams have never entered a headcount, so their X is derived against the default. When such a team first enters its real headcount (5 → 10), keeping X fixed would double its capacity. So the first headcount a team enters **re-anchors** X ("this velocity assumes 10 people"): X is recalculated so capacity doesn't change, and written at the same level as the headcount. Every headcount edit after that scales capacity.

**"Never entered" needs no new field.** The default lives in code, not in saved data, so a team has never entered a headcount when no level in its inheritance chain (`team[level]` → `team.defaults` → `__GLOBAL__[level]` → `__GLOBAL__.defaults`) has a saved `teamMembers` in `savedUserAllTeamData`. Re-anchoring writes X at the team's own level, so a team that was inheriting its velocity from global stops following later global velocity changes. That's the same as the team having set its own velocity.

**Dev Days teams with no saved headcount change.** They schedule against the default today (1 member) and will schedule against 5. Any Dev Days team without a saved `teamMembers` gets 5× capacity on upgrade. That's unlikely to matter (a 1-member default never described a real team), but call it out in the release notes.

## Settings form

- Ask headcount for every unit ("How many developers are on the team?"). It already exists; it now feeds capacity.
- **Team Days / Weeks / Sprints ask for people, not a share:** "How many people does one estimate assume?" (for example 5). The form shows full / half / third / quarter as shortcuts that fill in the number from the current headcount (half of 10 → 5), but the saved answer is the number of people.
  - Why: an Epic estimated at "2 half-team weeks" with 10 people is 50 person-days. If "half team" followed the team, growing to 20 would turn the same Epic into 100 person-days without anyone re-estimating it. The bigger team and the bigger estimates cancel exactly, so headcount would never change the schedule. A fixed number of people keeps the work fixed, so more developers finish it sooner, and the label stays true at any team size.
  - The answer isn't stored separately: it's `1 / (X × unit days)`, and saving it writes X.
  - Next to the people count, show it as a share of the current headcount: "Estimates assume **5** people (50% of the team)". This is display only and updates with headcount (5 of 11 → 45%); the stored number of people doesn't change.
  - The summary reads, for example, "1 Story Point is 1 week of work for 5 people (50% of the team). 10 developers."
  - Tracks: in settings, changing the people per estimate or the headcount resets `tracks` to `round(headcount / people per estimate)`, at least 1 (10 / 5 → 2). This replaces the share-based rule in `getDefaultTracks`. As with Dev Days, the AutoScheduler never resets tracks.

## AutoScheduler team bar

```
[−] 2 Epics in parallel [+]   [10] developers · 0.04 Story Points / day each (0.2 / week) · 0.4 Story Points / day (2 / week)   Total working days 34
```

Readouts with an Estimate Field named "Story Points", 10 developers, 5 people per estimate and 2-week sprints:

| Estimate unit              | 1 Story Point means  | Per developer             | Team (10 developers)    | Team (11 developers)       |
| -------------------------- | -------------------- | ------------------------- | ----------------------- | -------------------------- |
| Story Points (21 / sprint) | a story point        | 0.21 / day · 2.1 / sprint | 2.1 / day · 21 / sprint | 2.31 / day · 23.1 / sprint |
| Dev Days                   | 1 day of 1 developer | 1 / day                   | 10 / day                | 11 / day                   |
| Team Days                  | 1 day of 5 people    | 0.2 / day                 | 2 / day                 | 2.2 / day                  |
| Team Weeks                 | 1 week of 5 people   | 0.04 / day · 0.2 / week   | 0.4 / day · 2 / week    | 0.44 / day · 2.2 / week    |
| Team Sprints               | 1 sprint of 5 people | 0.02 / day · 0.2 / sprint | 0.2 / day · 2 / sprint  | 0.22 / day · 2.2 / sprint  |

The per-developer rate is X and doesn't change with headcount; the team total (X × N) does.

- **Developers** is an `InlineEdit` for every unit. It overrides and commits `teamMembers`.
- The readout shows the per-developer rate (X) and the team total (X × N), per day for every unit, plus per sprint for Story Points and Team Sprints and per week for Team Weeks. All of them are shown for now, including small numbers such as 0.02 / day; which ones to drop is decided after trying it.
- The label is the **Estimate Field's display name** (resolve an id-valued `estimateField` through the Jira fields), not an estimate-unit name. `formatCapacity` takes the field label and people per estimate instead of building "half-team weeks" style labels.
- The tooltip says what one unit of the field means: "1 Story Point = 1 week of work for 5 people (45% of the team)", "1 Story Point = 1 day of work for 1 developer", or for Story Points, "21 Story Points per sprint with 10 developers".
- Story Points keeps its editable points-per-sprint field, shown as `X × N × sprint days`. Editing it writes X.
- Uncommitted headcount and X edits use the existing uncommitted styling: `useTeamIsDirty` counts `teamMembers` and `pointsPerPersonDay`.
- **Plumbing:**
  - `TeamCapacityOverride` / `TeamCapacity` (`capacity-overrides/types.ts`): `teamMembers` applies to every unit, plus `pointsPerPersonDay` for velocity edits.
  - `applyCapacityOverrides.getVelocity`: `X × N × P` from the override, or from the base values when not overridden. Dev Days stops being a special case.
  - `useTeamCommit`: `CAPACITY_FIELDS` gains `pointsPerPersonDay`. Commit X to the level that supplies `estimateUnit`.

## Implications

- **No schedule changes until headcount changes**, as long as migration anchors X at the saved headcount.
- **Linear scaling.** 10 → 20 developers halves every duration, with no ramp-up or coordination cost.
- **Unestimated items don't speed up.** Their default estimate is one period's worth (V / T), so they always take P working days (10 for the non-sprint units, one sprint for Story Points and Team Sprints), whatever the headcount. This is intended.
- **On Story Points, a headcount edit in settings changes the points per sprint shown in the same form** (21 → 23.1 at 10 → 11), because velocity is now per person. Settings and the AutoScheduler behave the same way.
- **Story Points needs a headcount.** Velocity is observed for the whole team, so the per-person split assumes everyone is equally productive.
- **Sprint length on Story Points behaves as today.** A longer sprint keeps points per sprint and lowers the daily rate, by rewriting X.
- **Tracks auto-derivation (`getDefaultTracks`)** sets tracks from people per estimate (Team Days / Weeks / Sprints) or headcount (Dev Days), in settings only. With headcount driving capacity, the number of people per track (N / T) is now meaningful; the tooltip should show it.

## Steps

1. Add `pointsPerPersonDay` to `Configuration`, `createEmptyConfiguration` and `allTeamDefault.ts`. Change the default `teamMembers` to 5.
2. In `shared/estimation.ts`: `getPointsPerPersonDay(config)` (stored X, or derived for migration) and `pointsPerPersonDayFor(unit, answers)` (the formula table). Rewrite `getEffectiveVelocity` as `X × N × P`.
3. Resolve X together with `estimateUnit` in `shared/normalize.ts` `getConfiguration`.
4. Settings form: replace the share question with "How many people does one estimate assume?" plus share shortcuts. Write X from the velocity, people-per-estimate, unit and sprint-length answers. Re-anchor on first headcount. Update `getDefaultTracks` and `describeEstimation`.
5. AutoScheduler: developers `InlineEdit` for every unit, the `X × N` readout, the overrides and commit changes.
6. Update `team-configuration/Readme.md` (also fix its `UNESTIMATED_WORKING_DAYS (5)` typo; the constant is 10).

## Tests

- `estimation.test.ts`: X for every unit and people-per-estimate value against the formula table; share migration (half × 10 → 5 people → same X). `X × N × P` reproduces today's `getEffectiveVelocity` at the anchored headcount. Every row of the worked tables, run through `pointsPerDayPerTrack`.
- Migration: a config with no X derives today's V exactly. The first headcount set re-anchors (capacity unchanged), and the second scales.
- Inheritance: a team inheriting the global unit and X with its own headcount scales; a level overriding the unit doesn't read a foreign X.
- `applyCapacityOverrides.test.ts`: a `teamMembers` override scales V for every unit. A tracks override leaves team / day unchanged.
- `TeamCapacityControls.test.tsx`: developers editable for every unit, decimals accepted; 10 → 11 updates the team readout (0.4 → 0.44 / day for Team Weeks, 5 people) while the per-developer rate stays 0.04; labels use the Estimate Field name; the edit shows as uncommitted; tracks are unchanged.
- Settings form: on Dev Days, a headcount change resets tracks to the headcount; on Team Days / Weeks / Sprints, a headcount or people-per-estimate change resets tracks to `round(headcount / people)`; on Story Points nothing resets. Share shortcuts fill people = share × headcount. A saved half-team config migrates to 5 people at 10 developers.
- Legacy team table shows `X × N × sprintLength` as capacity per sprint.
- `useTeamCommit.test.tsx`: commits `teamMembers` and `pointsPerPersonDay` to the right levels.

## Decisions

- `velocityPerSprint` is no longer stored; per-sprint values are calculated from X.
- Unestimated items take one period (P days) regardless of headcount.
- Headcount can be set at every level, inherits normally, and accepts decimals.
- Dev Days tracks auto-reset on headcount changes in settings only, not in the AutoScheduler.
- Uncommitted headcount edits show the uncommitted styling.
- No linear-scaling warning in the UI.
- Default headcount is 5. "Never entered a headcount" means no saved `teamMembers` anywhere in the team's inheritance chain; no new field.
- The first headcount a team enters re-anchors X at the team's level.
- The AutoScheduler readout shows the per-developer rate and the team total, labelled with the Estimate Field's name: per day for every unit, plus per sprint (Story Points, Team Sprints) or per week (Team Weeks). Small numbers stay for now.
- The tooltip explains what one unit of the Estimate Field means for the team's estimate unit.
- Settings show people per estimate with a display-only share of the current headcount ("5 people (45% of the team)").
- Team Days / Weeks / Sprints ask "How many people does one estimate assume?" instead of a share. Shares remain as shortcuts only.
- Changing Story Points sprint length keeps points per sprint (rewrites X).
