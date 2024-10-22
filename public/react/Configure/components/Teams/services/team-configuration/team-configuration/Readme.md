# Overview

This module manages team configurations with default values and inheritance.

Configurations are used to normalize each team's issues before the rollup process. Teams can set up settings for these issue types:

- Outcomes
- Milestones
- Initiatives
- Epics
- Stories

Teams can apply the same configuration to all issue types by updating their team defaults.

If teams don't customize their settings, they inherit global defaults, which can also be customized per issue type.

Inheritance hierarchy:

- Global defaults for all teams
- Global defaults per issue type
- Team defaults
- Team configurations per issue type

Each level in the hierarchy overrides settings from the previous one.

## Folder Structure

- `shared.ts`: Contains shared type definitions and utility functions.
- `fetcher.ts`: Handles data retrieval and updating from storage.
- `inheritance.ts`: Implements the inheritance logic and computes the final configurations.
- `allTeamDefault.ts`: Determines global default values based on user data and Jira fields.

## Adding Defaults and Inheritance

To build a team's configuration, start by updating the global configuration with the global defaults and applying inheritance, since global issue types can inherit from these defaults. Because global settings are treated like any other team's settings (except for the global defaults), inheritance for global issue types can be applied just like it is for any other team.

```ts
const data = await getAllTeamData(storage);
const jiraFields = await getAllTeamData();

const configurationsWithGlobalDefaults = applyGlobalDefaultData(data, jiraFields);
const withInheritance = applyInheritance("__GLOBAL__", configurationsWithGlobalDefaults);
```
