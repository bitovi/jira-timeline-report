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

Teams answer capacity questions in the unit they estimate in (`estimateUnit`). The scheduler still works from three numbers per issue — velocity, days per sprint and parallel work limit — so each unit only has to produce an **effective velocity**: how many estimate units the whole team finishes per sprint. See `Teams/shared/estimation.ts` and spec/040-update-team-estimation-settings.

| `estimateUnit`          | Asks for                               | Effective velocity (S = `sprintLength`, f = share) |
| ----------------------- | -------------------------------------- | -------------------------------------------------- |
| `storyPoints` (default) | `sprintLength`, `velocityPerSprint`    | `velocityPerSprint`                                |
| `devDays`               | `teamMembers`                          | `teamMembers × S`                                  |
| `teamDays`              | `estimateTeamShare`                    | `S / f`                                            |
| `teamWeeks`             | `estimateTeamShare` (a week is 5 days) | `S / (5 × f)`                                      |
| `teamSprints`           | `sprintLength`, `estimateTeamShare`    | `1 / f`                                            |

`tracks` (work items in parallel) is asked for every unit. Shares are `full` = 1, `half` = ½, `third` = ⅓, `quarter` = ¼.

A configuration saved without `estimateUnit` resolves to `storyPoints`, which is the original math exactly, so nothing needs migrating. Every field inherits on its own through the chain above, so a team can inherit its unit from `__GLOBAL__` and still set its own `teamMembers`.

When a unit does not ask for `sprintLength`, the inherited value is still used: it only sets the default estimate for unestimated items (always one sprint per track) and cancels out of every estimated duration.
