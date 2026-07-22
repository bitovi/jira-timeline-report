/**
 * Normalized-field sourcing for Table report field columns (spec/012-table-and-grouper, issue #3/#4).
 *
 * DECISION (issues-plan.md #4): **prefer normalized, fall back to raw**. Several Jira "fields" are
 * object-valued in the raw `issue.fields` map (e.g. `Parent`) or don't live there at all (e.g.
 * `Team`, which this app derives). The normalization pipeline (`src/jira/normalized/normalize.ts`)
 * already flattens these onto the derived issue as scalar/simple top-level properties
 * (`parentKey`, `team.name`, `projectKey`, `status`, `storyPoints`, `dueDate`, …).
 *
 * This module maps a Jira field (by key or display name) to the normalized accessor for that
 * concept. {@link buildColumnCatalog} consults it when building a field column: if a normalized
 * source matches, the column reads the normalized value (falling back to the raw `issue.fields`
 * lookup when the normalized value is nullish); otherwise it uses the plain raw lookup as before.
 *
 * This is what makes `parent`/`team`/`project`/`status` group and render sensibly instead of
 * showing `[object Object]` or collapsing into one bucket.
 */
import { statusRender } from './normalizedRenderers';

import type { ReactNode } from 'react';
import type { AggregationId } from './aggregations';
import type { FilterDescriptor, RenderContext, TableIssue } from './columns';

/**
 * A normalized accessor for one field concept. `getValue` reads the flattened property off the
 * derived issue; `filter`/`defaultAggregate` optionally override the type-registry defaults when
 * the normalized value has a more specific type than the raw schema implies.
 */
export interface NormalizedFieldSource {
  getValue: (issue: TableIssue) => unknown;
  filter?: FilterDescriptor;
  defaultAggregate?: AggregationId;
  /** Optional richer renderer (e.g. Status → coloured Lozenge); falls back to the type-registry render. */
  render?: (value: unknown, ctx: RenderContext) => ReactNode;
}

/** Read `issue.team.name` off the (object-valued) normalized team property. */
function teamName(issue: TableIssue): unknown {
  const team = issue.team as { name?: unknown } | undefined;
  return team?.name;
}

/** Join a normalized string[] (labels/releases) into a comma list; pass scalars through. */
function joinList(value: unknown): unknown {
  return Array.isArray(value) ? value.join(', ') : value;
}

/**
 * Field concepts we surface from the normalized issue, each with the display-name/key aliases it
 * matches on (all lowercased). Order doesn't matter — matching is by exact alias.
 */
const SOURCES: ReadonlyArray<{ aliases: readonly string[]; source: NormalizedFieldSource }> = [
  { aliases: ['status'], source: { getValue: (i) => i.status, render: statusRender, filter: { kind: 'select' } } },
  // Parent is an object in raw fields (`.key`/`.fields.summary`); normalized flattens to `parentKey`.
  { aliases: ['parent', 'parent link'], source: { getValue: (i) => i.parentKey } },
  { aliases: ['project', 'project key'], source: { getValue: (i) => i.projectKey } },
  // Team isn't in raw fields at all — it's derived onto `issue.team`.
  { aliases: ['team'], source: { getValue: teamName } },
  { aliases: ['labels'], source: { getValue: (i) => joinList(i.labels) } },
  {
    aliases: ['story points'],
    source: { getValue: (i) => i.storyPoints, filter: { kind: 'number' }, defaultAggregate: 'sum' },
  },
  {
    aliases: ['story point median', 'story points median'],
    source: { getValue: (i) => i.storyPointsMedian, filter: { kind: 'number' }, defaultAggregate: 'sum' },
  },
  {
    aliases: ['due date', 'duedate'],
    source: { getValue: (i) => i.dueDate, filter: { kind: 'date' }, defaultAggregate: 'range' },
  },
  {
    aliases: ['start date', 'startdate'],
    source: { getValue: (i) => i.startDate, filter: { kind: 'date' }, defaultAggregate: 'range' },
  },
  { aliases: ['rank'], source: { getValue: (i) => i.rank } },
];

/** Alias → source lookup, built once. */
const byAlias = new Map<string, NormalizedFieldSource>();
for (const { aliases, source } of SOURCES) {
  for (const alias of aliases) byAlias.set(alias, source);
}

/**
 * Resolve the normalized source for a Jira field, matching on its `key` or display `name`
 * (case-insensitive). Returns `undefined` when the field has no normalized equivalent — the column
 * then uses the plain raw `issue.fields[name]` lookup.
 */
export function resolveNormalizedFieldSource(field: { key: string; name: string }): NormalizedFieldSource | undefined {
  return byAlias.get(field.key.toLowerCase()) ?? byAlias.get(field.name.toLowerCase());
}
