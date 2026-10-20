# Overview

This module manages team configurations with default values and inheritance.

Configurations are used to normalize each team's issues before the rollup process. Teams can set up settings for their issue hierarchies

Teams can apply the same configuration to all hierarchies by updating their team defaults.

If teams don't customize their settings, they inherit global defaults, which can also be customized per issue hierarchy level.

Inheritance hierarchy:

- Global defaults for all teams
- Global defaults per issue hierarchy
- Team defaults
- Team configurations per issue hierarchy

Each level in the hierarchy overrides settings from the previous one.

Resolved from most specific to least:

```
team[level]  →  team.defaults  →  __GLOBAL__[level]  →  __GLOBAL__.defaults
```

A team's own defaults beat any global setting, even one for that specific work item type: if the global Epic estimate field is `A` and a team's default estimate field is `B`, that team's Epics use `B`. A team with no saved configuration falls through to `__GLOBAL__[level]` and then `__GLOBAL__.defaults`. See spec/039-global-defaults-workitems.

## Adding Defaults and Inheritance

To build a team's configuration, start by updating the global configuration with the global defaults and applying inheritance, since global issue hierarchy can inherit from these defaults. Because global settings are treated like any other team's settings (except for the global defaults), inheritance for global issue hierarchies can be applied just like it is for any other team.

```ts
const data = await getAllTeamData(storage);
const jiraFields = await getAllTeamData();

const configurationsWithGlobalDefaults = applyGlobalDefaultData(data, jiraFields);
const withInheritance = applyInheritance('__GLOBAL__', configurationsWithGlobalDefaults);
```

## Estimate units

Teams answer capacity questions in the unit they estimate in (`estimateUnit`). The scheduler still works from three numbers per issue — velocity, days per sprint and parallel work limit — whose names predate estimate units. See `Teams/shared/estimation.ts` and spec/040-update-team-estimation-settings (plan.md, then plan2.md).

**Every unit stores one number, X (`pointsPerPersonDay`)**: estimate units one person finishes in one working day. With the headcount N (`teamMembers`), the tracks T and the scheduling period P:

```
team / day      = X × N
per track / day = X × N / T      (the engine's pointsPerDayPerTrack)
velocity        = X × N × P      (getEffectiveVelocity)
```

So headcount scales capacity for every unit, tracks only divide it, and X changes only when the team redefines what one estimate unit is.

| `estimateUnit`          | Asks for                               | Period (P)      | X                                     |
| ----------------------- | -------------------------------------- | --------------- | ------------------------------------- |
| `storyPoints` (default) | `sprintLength`, points per sprint      | `sprintLength`  | points per sprint / (N × sprint days) |
| `devDays`               | —                                      | 10 working days | 1                                     |
| `teamDays`              | people per estimate                    | 10 working days | 1 / (people × 1)                      |
| `teamWeeks`             | people per estimate (a week is 5 days) | 10 working days | 1 / (people × 5)                      |
| `teamSprints`           | `sprintLength`, people per estimate    | `sprintLength`  | 1 / (people × sprint days)            |

Every unit also asks for the headcount (`teamMembers`, default 5, decimals allowed) and `tracks`. Points per sprint and people per estimate aren't stored: both are shown from X (`X × N × sprint days`, `1 / (X × unit days)`) and saving either writes X. Changing a Story Points or Team Sprints sprint length rewrites X so points per sprint, or people per estimate, stay the same.

`sprintLength` is stored in working days but asked in weeks (one week = `DAYS_PER_WEEK` = 5 working days), so the form shows `sprintLength / 5` and saves `weeks × 5`.

**X resolves together with the unit.** X is in the unit's own terms, so it comes from the most specific level that saves any of `pointsPerPersonDay`, `estimateUnit`, `velocityPerSprint` or `estimateTeamShare` — never from a less specific one (`getInheritedData`). The form customizes and inherits the unit and its capacity together, and the AutoScheduler commits X to the level that anchors the unit (`getCapacityLevel`).

**Migration.** Configs saved before X existed have none. X is derived on read from the legacy answers (`velocityPerSprint`, `estimateTeamShare`) at the saved headcount, which reproduces their old velocity exactly; nothing writes `velocityPerSprint` or `estimateTeamShare` any more. A team that never entered a headcount (no saved `teamMembers` anywhere in its chain) was derived against the default, so the first headcount it enters **re-anchors** X — capacity stays the same — and every headcount after that scales it (`pointsPerPersonDayForHeadcount`). Dev Days teams without a saved headcount go from the old default of 1 member to 5.

**The parallel count follows the other answers, in settings only** (`getDefaultTracks`). Changing the unit, the people per estimate or the headcount also saves `tracks` at the same level, in the same write: the headcount for Dev Days, and `round(headcount / people per estimate)` for the team-time units. It overwrites any hand-typed value, and the team can edit it afterwards. Story Points implies nothing. The AutoScheduler never resets tracks.

The period cancels out of every estimated duration. Its one visible effect is the default for an **unestimated item, which always takes exactly one period**, whatever the headcount: a sprint for the sprint units, and `UNESTIMATED_WORKING_DAYS` (10) for the rest. The form says so under the unit question.
