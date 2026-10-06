# 039 — Global defaults per work item type

## Context

Team Configuration currently exposes three layers:

1. **Global defaults** (`__GLOBAL__.defaults`) — `ConfigureAllTeams.tsx`
2. **Team defaults** (`<team>.defaults`)
3. **Team per work item type** (`<team>.<hierarchyLevel>`, e.g. `"1"` = Epic)

The fourth layer — **global per work item type** (`__GLOBAL__.<hierarchyLevel>`) — already exists in the data model, the inheritance resolver, and the Readme, but its UI was switched off in `49fab926 "remove issue type forms"` (Oct 2024). The hard-coded `return false` is still sitting in `ConfigureTeams.tsx:76-82`.

We want it back so it can be tested manually, and we need to be sure the precedence is right. The rule, from most specific to least:

```
team[level]  →  team.defaults  →  __GLOBAL__[level]  →  __GLOBAL__.defaults
```

**Example:** global Epic = A, team default = B. The team's Epics use **B**. A team's own default beats any global setting, even a global setting for that specific type.

## What's already correct

`getInheritedData` (`.../team-configuration/inheritance.ts:16-24`) already uses exactly that order, and `createFullyInheritedConfig` resolves `__GLOBAL__` first, then each team against it. Teams that have saved config will get the right answer. **We still need tests to lock this in.**

## What's broken once the UI is turned back on

### Bug 1 — teams with no saved config skip the global per-type layer (affects reports)

`shared/normalize.ts:4-9`:

```ts
return allData[key]?.[level] || allData.__GLOBAL__.defaults;
```

`createFullyInheritedConfig` only goes through teams that are present in saved data, and `sanitizeAllTeamData` removes empty teams. So a team that nobody has configured is never in `allData`, and it drops straight to `__GLOBAL__.defaults`, **skipping `__GLOBAL__[level]`**. This is the most common case: a global Epic setting would have no effect on any untouched team. (A team that _is_ saved but missing a level also skips its own `.defaults`.)

**Fix:** follow the full chain, using `??` rather than `||`:

```ts
return allData[key]?.[level] ?? allData[key]?.defaults ?? allData.__GLOBAL__[level] ?? allData.__GLOBAL__.defaults;
```

`createTeamFieldLookup` (`inheritance.ts:102-120`, used by the AutoScheduler UpdateModal) already falls back to `__GLOBAL__[issueLevel]` for unknown teams, so it doesn't need a change. Cover it with a test anyway.

### Bug 2 — un-customizing a field briefly shows the wrong inherited value (UI only)

`useTeamData().getInheritance` (`hooks/useAllTeamData.ts:150-162`) fills the empty config's `defaults` with the team's **inherited** defaults. Those have already fallen through to `__GLOBAL__.defaults`, so the resolver never gets to `__GLOBAL__[level]`. If the global Epic is A, the team's Epic is customized, and the user clicks **inherit**, `setValue` shows the global _default_ instead of A. The value corrects itself after the save round-trip (`reset` in `useTeamForm`), but it's still wrong in the meantime.

**Fix:** pull the "what would I inherit at this level" logic into a small pure helper in `inheritance.ts` (for example `getParentConfiguration(teamName, level, savedTeamData, inheritedGlobal)`) with these rules:

| Editing               | Parent value                                     |
| --------------------- | ------------------------------------------------ |
| team, `defaults`      | `inheritedGlobal.defaults`                       |
| team, level L         | `savedTeam.defaults[f] ?? inheritedGlobal[L][f]` |
| `__GLOBAL__`, level L | `inheritedGlobal.defaults`                       |

Note that `inheritedGlobal[L]` already contains the fallback to global defaults. Have `getInheritance` in `useTeamData` call this helper. `__GLOBAL__` needs its own rule: running the team chain for it would read back the very `__GLOBAL__[L]` value that is being cleared.

## Steps

1. **Re-enable the UI.** In `ConfigureTeams.tsx`, replace the `return false` block with `return issueType !== 'defaults'` for `__GLOBAL__`. The "Global defaults" accordion already comes from `ConfigureAllTeams`, so this adds one accordion per type underneath it. That accordion's title currently reads `Team defaults (__GLOBAL__)` only for `defaults`, which is filtered out here, so the titles are fine as they are.
2. **No feature flag.** The per-type global accordions are always on. This restores existing functionality that was switched off, rather than adding a new feature.
3. **Fix `normalize.ts` `getConfiguration`** (Bug 1).
4. **Add `getParentConfiguration`** and use it in `useTeamData().getInheritance` (Bug 2).
5. **Update `team-configuration/Readme.md`.** It lists the hierarchy as global-defaults → global-per-type → team-defaults → team-per-type, which is right, but add the A/B example so the "team default beats global per-type" rule is written down.

## Tests

`inheritance.test.ts` (with `getInheritedData` / `createFullyInheritedConfig`):

- global Epic = A, team default = B → team Epic = **B**
- global Epic = A, no team values → team Epic = **A**
- global default = G, global Epic = A, team Epic = C → **C**
- global default = G only → team Epic = **G**, global Epic = **G**
- `createTeamFieldLookup` with an unknown team and `issueLevel: '1'` → global Epic value

`normalize.test.ts` (alongside `normalize.statusSummary.test.ts`):

- team missing from `allData` + global Epic set → `getStartDate` / `getVelocity` read the global Epic field
- team saved with only `defaults` (level key absent) → team defaults win over global Epic

`getParentConfiguration` unit tests: the three rows in the table above, plus the global-default-only fallback.

## Verification

- `npm test -- team-configuration normalize`
- Manual: Settings → Team Configuration → **Global**
  1. Set the global Epic estimate field to **A**. Open a team with no config: its Epic accordion shows **A** as inherited, and the timeline estimates for that team's epics read field A.
  2. Set that team's default estimate field to **B**. Its Epic now shows **B** (inheriting), and the report uses B.
  3. Customize the team's Epic to **C**, then click _inherit_. It goes back to **B** immediately, with no flash of the global default.
  4. Clear the team default. The team Epic goes back to **A**.

## Out of scope

- The TR-133 team-table sync in `src/jira/storage/index.web.ts` only mirrors team values, not `__GLOBAL__`. Leave it unchanged.
- Labeling _where_ an inherited value comes from ("from Global · Epic"). Nice to have; punt.
