# Common & Report-Field Columns

Child spec of [spec/012-table-and-grouper](./plan.md). Extends the column catalog
([column-source-registry.md](./column-source-registry.md)) so the data we **always fetch** and
**always derive** is surfaced as first-class, always-available columns — instead of only appearing
as generic `field:*` columns when a user happens to load the field.

## Problem

Today the **Common** group offers only two facets — Project Key and Project Name
(`model/builtinFieldRegistry.ts:58`). Yet every JQL query loads a fixed `CORE_FIELDS` set
(`src/stateful-data/jira-data-requests.js:81`) and `normalizeIssue`
(`src/jira/normalized/normalize.ts:71`) always derives a canonical per-issue interpretation. None
of that is curated into the Add-column menu, so users must hunt for raw `field:*` columns (which
only exist if the field was loaded) and object-valued fields render as `[object Object]` or collapse
into one bucket.

## Approach

Two additions, no new architecture:

1. **Expand the Common group** — model each always-loaded object-valued CORE field as a
   `BuiltinConcept` that `claims` the raw field and exposes one `BuiltinFacet` per useful piece of
   the object (the existing `project` → Key + Name pattern).
2. **Add a new `Report Fields` group** — for the app's canonical, field-name-independent per-issue
   values whose **underlying raw field is user-configured** (so only the normalized value is stable).

### Taxonomy (the seam)

| Group                                | Definition                                                                                                             | Backing            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Identity** _(exists)_              | The issue itself                                                                                                       | key, summary, icon |
| **Common**                           | Curated facets of the **always-loaded CORE fields** (raw, or trivially derived off a CORE object like status category) | `CORE_FIELDS`      |
| **Report Fields** _(new)_            | Canonical **per-issue** values whose source field is **user-configured** — only the normalized value is stable         | `normalizeIssue`   |
| **Estimation / Computed** _(exists)_ | Values derived by **rollup across issues**                                                                             | rollup engine      |
| **Fields** _(exists)_                | One column per other loaded raw field                                                                                  | any loaded field   |

Rule of thumb: **Common** = off an always-loaded CORE field. **Report Fields** = derived per issue
from a _configurable_ field. **Computed** = derived by aggregating across issues.

## Common facets (concept → facets)

Each row is a `BuiltinConcept` (`claims` the raw Jira field so its bare `field:*` duplicate is
suppressed) with the listed facets. `requires: []` where the value is derived and needs no extra load.

| Concept · `claims`            | Facet `sourceId`          | Label           | `get(issue)`                   | `requires` | Render                                    |
| ----------------------------- | ------------------------- | --------------- | ------------------------------ | ---------- | ----------------------------------------- |
| **Issue Type** · `Issue Type` | `builtin:issueType:name`  | Issue Type      | `issue.type`                   | `[]`       | text                                      |
|                               | `builtin:issueType:icon`  | Issue Type Icon | `issueTypeIconUrl(issue)`      | `[]`       | `<img>` (mirrors `identity:issueType`)    |
| **Status** · `Status`         | `builtin:status:name`     | Status          | `issue.status`                 | `[]`       | colored lozenge (by category)             |
|                               | `builtin:status:category` | Status Category | `issue.statusCategory`         | `[]`       | text/lozenge — To Do / In Progress / Done |
| **Parent** · `Parent`         | `builtin:parent:key`      | Parent Key      | `issue.parentKey`              | `[]`       | link                                      |
|                               | `builtin:parent:summary`  | Parent Summary  | `normalizeParent(...).summary` | `[]`       | text                                      |
|                               | `builtin:parent:type`     | Parent Type     | parent `.type`                 | `[]`       | text                                      |
| **Team** · `Team`             | `builtin:team:name`       | Team            | `issue.team.name`              | `[]`       | text                                      |
| **Sprint** · `Sprint`         | `builtin:sprint:names`    | Sprint          | `issue.sprints[].name` joined  | `[]`       | join-all, comma list                      |
| **Release** · `Fix versions`  | `builtin:release:names`   | Release         | `issue.releases[].name` joined | `[]`       | join-all, comma list                      |
| **Labels** · `Labels`         | `builtin:labels:list`     | Labels          | `issue.labels`                 | `[]`       | chips                                     |
| **Created** · `Created`       | `builtin:created:date`    | Created         | raw `Created`                  | `[]`       | date                                      |
| **Rank** · `Rank`             | `builtin:rank:value`      | Rank            | `issue.rank`                   | `[]`       | text — **off by default**                 |

Notes:

- **Issue Type Name is missing today** — `identity:issueType` (`model/fieldTypeRegistry.ts:186`)
  renders the _icon_ (`getValue` = iconUrl). This adds the text-name facet; the icon facet reuses
  the same `issueTypeIconUrl` accessor.
- **Parent Summary is always available**: `Parent` is a CORE field and `normalizeParent`
  (`normalize.ts:15`) flattens it to `{ summary, hierarchyLevel, type, key }`.
- **Status Category is Common, not Report Fields** — it derives purely from the always-loaded CORE
  `Status` object (`defaults.ts:217` = `fields.Status.statusCategory.name`).

## Report Fields facets

Group `'Report Fields'`. All read a flattened property off the normalized issue and always exist
(nullable). No `claims` (these have no single stable raw field to suppress).

| `sourceId`                 | Label              | `get(issue)`              | Filter / default aggregation |
| -------------------------- | ------------------ | ------------------------- | ---------------------------- |
| `report:startDate`         | Start Date         | `issue.startDate`         | date / range                 |
| `report:dueDate`           | Due Date           | `issue.dueDate`           | date / range                 |
| `report:storyPoints`       | Story Points       | `issue.storyPoints`       | number / sum                 |
| `report:storyPointsMedian` | Story Point Median | `issue.storyPointsMedian` | number / sum                 |
| `report:confidence`        | Confidence         | `issue.confidence`        | number                       |

Several of these already have normalized sourcing entries in
`model/normalizedFieldSources.ts:52` (reused for value/filter/aggregation).

## Explicitly out of scope

- **Status Summary** — active experiment, not shipped as a column.
- **Sprint/Release sub-facets** — no sprint start/end/state, no release date / released? Names only
  for now; revisit if requested.
- **Linked Issues** — always fetched but relational; belongs in a future feature, not a scalar column.

## Implementation notes

- `ColumnGroup` (`model/columns.ts:29`) adds `'Report Fields'`:
  `'Common' | 'Identity' | 'Fields' | 'Report Fields' | 'Estimation' | 'Computed'`.
- Extend `BUILTIN_CONCEPTS` (`model/builtinFieldRegistry.ts:58`) with the concepts above. Presentation
  (render/compare/filter) stays in the catalog layer keyed by `sourceId`, per the existing split.
- Add the Report-Field column builders (group `'Report Fields'`) and slot them into
  `buildColumnCatalog` between the built-in (Common) facets and the generic field columns:
  `[...identity, ...builtin, ...reportFields, ...fieldColumns, ...estimation]`.
- `requiredFieldsFor` (`builtinFieldRegistry.ts:106`) already returns each facet's `requires`; since
  these facets are all `requires: []` (or normalized), `route-data.tableColumnFields` adds **no** new
  Jira loads beyond `CORE_FIELDS` / the configured date+estimate fields.
- Add-column menu ordering: Identity → Common → Report Fields → Fields → Estimation.

## Tests

- Catalog emits each new facet with the right `group`, `sourceId`, and `getValue`.
- Object-valued facets read the intended piece (parent summary, status category, team name) rather
  than the whole object.
- Sprint/Release join multiple values into one string; empty arrays render blank.
- Concept `claims` suppress the corresponding bare `field:*` duplicate.
- Report-Field columns require no extra Jira field loads (`requiredFieldsFor` → `[]`).
- Rank is present in the catalog but absent from `DEFAULT_TABLE_COLUMNS`.
