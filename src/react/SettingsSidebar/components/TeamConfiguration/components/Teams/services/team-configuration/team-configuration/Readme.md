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

Teams answer capacity questions in the unit they estimate in (`estimateUnit`). The scheduler still works from three numbers per issue — velocity, days per sprint and parallel work limit — whose names predate estimate units. Each unit supplies:

- a **scheduling period** (the engine's "days per sprint"), in working days, and
- an **effective velocity** (the engine's "velocity"): estimate units the whole team finishes in that period.

See `Teams/shared/estimation.ts` and spec/040-update-team-estimation-settings.

| `estimateUnit`          | Asks for                               | Period (P)     | Effective velocity (f = share) |
| ----------------------- | -------------------------------------- | -------------- | ------------------------------ |
| `storyPoints` (default) | `sprintLength`, `velocityPerSprint`    | `sprintLength` | `velocityPerSprint`            |
| `devDays`               | `teamMembers`                          | 5 working days | `teamMembers × P`              |
| `teamDays`              | `estimateTeamShare`                    | 5 working days | `P / f`                        |
| `teamWeeks`             | `estimateTeamShare` (a week is 5 days) | 5 working days | `P / (5 × f)`                  |
| `teamSprints`           | `sprintLength`, `estimateTeamShare`    | `sprintLength` | `1 / f`                        |

`tracks` (work items in parallel) is asked for every unit. Shares are `full` = 1, `half` = ½, `third` = ⅓, `quarter` = ¼.

The period cancels out of every estimated duration. Its one visible effect is the default for an **unestimated item, which always takes exactly one period**: a sprint for the sprint units, and `UNESTIMATED_WORKING_DAYS` (5) for the rest. The form says so under the unit question.

**No unit reads a setting its form hides.** A `sprintLength` saved while on Story Points survives a switch to Dev Days, but nothing reads it until the team switches back. Likewise `velocityPerSprint` is ignored by every unit but Story Points, and `teamMembers` by every unit but Dev Days.

A configuration saved without `estimateUnit` resolves to `storyPoints`, which is the original math exactly, so nothing needs migrating. Every field inherits on its own through the chain above, so a team can inherit its unit from `__GLOBAL__` and still set its own `teamMembers`.
