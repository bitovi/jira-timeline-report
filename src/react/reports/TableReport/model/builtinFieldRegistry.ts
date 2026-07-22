/**
 * Built-in field registry — spec/012-table-and-grouper/column-source-registry.md.
 *
 * The pure, React-free source of truth for CURATED built-in columns. It separates the two
 * concerns the old `field:<key>` sourceId conflated:
 *   - what a column must LOAD  → `requires` (Jira field **ids**; often `[]`)
 *   - how a column READS its value → `get`
 * plus which raw Jira field id(s) a concept `claims`, so the generic "one column per Jira
 * field" loop can suppress the bare duplicate (e.g. don't show "Project" when we offer
 * "Project Key" + "Project Name").
 *
 * Imported by BOTH the React catalog (`buildColumnCatalog`) and `route-data.js`
 * (`tableColumnFields`), so it must NOT import any React/UI. Presentation (render/compare/
 * filter) lives in the catalog layer, keyed by the same sourceIds.
 *
 * Identifiers are Jira field **ids**, not display names: names aren't unique (two fields can
 * share one), and the id is the only unambiguous handle (see spec/015-field-selection —
 * `deriveFieldMaps`/`mapIdsToNames` keep name-colliding fields addressable by id).
 */
import { normalizeParent } from '../../../../jira/normalized/normalize';

import type { ParentIssue } from '../../../../jira/shared/types';
import type { TableIssue } from './columns';

/** One addable column offered by a built-in concept. */
export interface BuiltinFacet {
  /** Persisted column id, e.g. `builtin:project:name`. */
  sourceId: string;
  label: string;
  /** Jira field IDS this facet needs requested. `[]` = derived/intrinsic — never triggers a load. */
  requires: string[];
  /** Read the value off a (rolled-up) issue. */
  get: (issue: TableIssue) => unknown;
  /**
   * Jira `schema.type` hint the React catalog uses to pick render/compare/filter/aggregate (via the
   * field-type registry). Defaults to `'string'` (text + `distinct` aggregation) when omitted.
   */
  schemaType?: string;
}

/** A built-in Jira concept (e.g. "project") and the curated columns it offers. */
export interface BuiltinConcept {
  /** Concept id, e.g. `project`. */
  concept: string;
  /**
   * Jira field id(s) this concept represents. The generic field-column loop skips any raw field
   * whose id/name is claimed here, so users see the curated facets instead of a bare duplicate.
   * Declared EXPLICITLY: a facet may read derived data and never touch the raw field (e.g. Project
   * Key reads `projectKey` from the issue key), yet the concept must still claim `project`.
   */
  claims: string[];
  facets: BuiltinFacet[];
}

/** Read `.name` off a raw Jira field object (`issue.fields[id] = { id, key, name, ... }`). */
function fieldObjectName(issue: TableIssue, id: string): unknown {
  const raw = issue.fields?.[id] as { name?: unknown } | undefined;
  return raw?.name;
}

/** The raw issue-type icon URL (`issue.fields['Issue Type'].iconUrl`) — mirrors `identity:issueType`. */
function issueTypeIconUrl(issue: TableIssue): unknown {
  const issueType = issue.fields?.['Issue Type'] as { iconUrl?: unknown } | undefined;
  return issueType?.iconUrl;
}

/** Normalize the raw `Parent` field object (a ParentIssue) into `{ summary, type, key, ... }`. */
function parent(issue: TableIssue): ReturnType<typeof normalizeParent> | undefined {
  const raw = issue.fields?.['Parent'] as ParentIssue | undefined;
  return raw ? normalizeParent(raw) : undefined;
}

/** Join the `.name` of each element of a normalized array (sprints/releases) into a comma list. */
function joinNames(list: unknown): unknown {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  const names = list.map((item) => (item as { name?: unknown })?.name).filter((n) => n != null);
  return names.length ? names.join(', ') : undefined;
}

export const BUILTIN_CONCEPTS: readonly BuiltinConcept[] = [
  {
    concept: 'project',
    claims: ['project'],
    facets: [
      {
        // Always present: `projectKey` is derived from the issue key (ORD-123 -> ORD), so it
        // needs no field request.
        sourceId: 'builtin:project:key',
        label: 'Project Key',
        requires: [],
        get: (issue) => issue.projectKey,
      },
      {
        // Requires loading the `project` field, then reading `.name` off the JSON object.
        sourceId: 'builtin:project:name',
        label: 'Project Name',
        requires: ['project'],
        get: (issue) => fieldObjectName(issue, 'project'),
      },
    ],
  },
  {
    // Issue Type is an always-loaded CORE field; `issue.type` is its normalized name, and the icon
    // mirrors `identity:issueType`. Both are derived — neither triggers an extra load.
    concept: 'issueType',
    claims: ['Issue Type'],
    facets: [
      { sourceId: 'builtin:issueType:name', label: 'Issue Type', requires: [], get: (issue) => issue.type },
      { sourceId: 'builtin:issueType:icon', label: 'Issue Type Icon', requires: [], get: issueTypeIconUrl },
    ],
  },
  {
    // Status (CORE) → normalized `status` name + `statusCategory` (To Do / In Progress / Done),
    // which derives purely off the always-loaded Status object.
    concept: 'status',
    claims: ['Status'],
    facets: [
      { sourceId: 'builtin:status:name', label: 'Status', requires: [], get: (issue) => issue.status },
      {
        sourceId: 'builtin:status:category',
        label: 'Status Category',
        requires: [],
        get: (issue) => issue.statusCategory,
      },
    ],
  },
  {
    // Parent (CORE) flattens via normalizeParent to key/summary/type — all always available.
    concept: 'parent',
    claims: ['Parent'],
    facets: [
      { sourceId: 'builtin:parent:key', label: 'Parent Key', requires: [], get: (issue) => issue.parentKey },
      { sourceId: 'builtin:parent:summary', label: 'Parent Summary', requires: [], get: (issue) => parent(issue)?.summary },
      { sourceId: 'builtin:parent:type', label: 'Parent Type', requires: [], get: (issue) => parent(issue)?.type },
    ],
  },
  {
    concept: 'team',
    claims: ['Team'],
    facets: [
      {
        sourceId: 'builtin:team:name',
        label: 'Team',
        requires: [],
        get: (issue) => (issue.team as { name?: unknown } | undefined)?.name,
      },
    ],
  },
  {
    // Sprint / Fix versions are multi-valued — join every name into one column.
    concept: 'sprint',
    claims: ['Sprint'],
    facets: [{ sourceId: 'builtin:sprint:names', label: 'Sprint', requires: [], get: (issue) => joinNames(issue.sprints) }],
  },
  {
    concept: 'release',
    claims: ['Fix versions'],
    facets: [{ sourceId: 'builtin:release:names', label: 'Release', requires: [], get: (issue) => joinNames(issue.releases) }],
  },
  {
    concept: 'labels',
    claims: ['Labels'],
    facets: [{ sourceId: 'builtin:labels:list', label: 'Labels', requires: [], get: (issue) => issue.labels }],
  },
  {
    // Created is an always-loaded CORE field read raw off the issue (no normalized flattening).
    concept: 'created',
    claims: ['Created'],
    facets: [
      { sourceId: 'builtin:created:date', label: 'Created', requires: [], get: (issue) => issue.fields?.['Created'], schemaType: 'date' },
    ],
  },
  {
    concept: 'rank',
    claims: ['Rank'],
    facets: [{ sourceId: 'builtin:rank:value', label: 'Rank', requires: [], get: (issue) => issue.rank }],
  },
];

/**
 * Report Fields — the app's canonical, field-name-independent per-issue values whose underlying raw
 * field is USER-CONFIGURED, so only the normalized value is stable. They read a flattened property
 * off the normalized issue and always exist (nullable), needing no extra Jira load (`requires: []`).
 * Unlike {@link BUILTIN_CONCEPTS} they `claim` nothing — there's no single stable raw field to
 * suppress (the configured source field still shows as its own generic `field:*` column).
 */
export const REPORT_FIELD_FACETS: readonly BuiltinFacet[] = [
  { sourceId: 'report:startDate', label: 'Start Date', requires: [], get: (issue) => issue.startDate, schemaType: 'date' },
  { sourceId: 'report:dueDate', label: 'Due Date', requires: [], get: (issue) => issue.dueDate, schemaType: 'date' },
  { sourceId: 'report:storyPoints', label: 'Story Points', requires: [], get: (issue) => issue.storyPoints, schemaType: 'number' },
  { sourceId: 'report:storyPointsMedian', label: 'Story Point Median', requires: [], get: (issue) => issue.storyPointsMedian, schemaType: 'number' },
  { sourceId: 'report:confidence', label: 'Confidence', requires: [], get: (issue) => issue.confidence, schemaType: 'number' },
];

const FACET_BY_SOURCE_ID: ReadonlyMap<string, BuiltinFacet> = new Map(
  [...BUILTIN_CONCEPTS.flatMap((concept) => concept.facets), ...REPORT_FIELD_FACETS].map(
    (facet) => [facet.sourceId, facet] as const,
  ),
);

/** All Jira field ids claimed by the registry (lowercased) — for the catalog set-difference. */
export const CLAIMED_FIELD_IDS: ReadonlySet<string> = new Set(
  BUILTIN_CONCEPTS.flatMap((concept) => concept.claims.map((id) => id.toLowerCase())),
);

/** Look up a built-in facet by its persisted sourceId. */
export function getBuiltinFacet(sourceId: string): BuiltinFacet | undefined {
  return FACET_BY_SOURCE_ID.get(sourceId);
}

/**
 * The Jira field ids a persisted column `sourceId` needs requested from Jira:
 *   - `builtin:*` (and future `rollup:*`) → the facet's declared `requires` (often none).
 *   - `field:<id>` → that raw field id.
 *   - `identity:*`, `estimation:*`, unknown → none.
 *
 * This is the single mapping `route-data.js` uses to derive the request field list from the
 * shown columns, so derived facets (Project Key) never trigger a refetch while raw ones
 * (Project Name) load exactly what they read.
 */
export function requiredFieldsFor(sourceId: string): string[] {
  const facet = FACET_BY_SOURCE_ID.get(sourceId);
  if (facet) return facet.requires;
  if (sourceId.startsWith('field:')) return [sourceId.slice('field:'.length)];
  return [];
}
