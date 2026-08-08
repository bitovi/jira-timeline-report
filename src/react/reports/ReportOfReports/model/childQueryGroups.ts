/**
 * The document's request-dedupe roster — spec/016-report-of-reports/005-optimize/001-request-dedupe,
 * Phase 1.
 *
 * Two reports over one JQL still issue two fetches if they ask for different *fields*, and they
 * usually do: a Table contributes its shown columns' fields and a Gantt contributes none. This finds
 * the embedded reports that ask Jira the same question and computes the union of the fields they
 * between them need, so each one requests the union and the singleflight in `getRawIssues` collapses
 * them onto a single cascade.
 *
 * A child's requested field list is a pure function of its saved `queryParams`, and the document holds
 * every child's `queryParams` before it renders any of them — so this is computable from structure,
 * with no coordination, no debounce and no request barrier. It is deliberately *static*: a debounce
 * would make the request count depend on arrival order (and `registry.ts` names `React.lazy` per
 * report as the intended future seam, at which point a lazily-imported report would miss the window
 * and its group would split silently).
 *
 * This is NOT partial-overlap dedupe (sibling plan 5). Only the column projection widens — `jql`,
 * `childJQL` and `loadChildren` are untouched — so the set of work items each report receives is
 * exactly what it would have fetched alone, and the rollup membership trap never fires.
 */
import type { Reports } from '../../../../jira/reports';
import type { LayoutNode } from './sections';

import { queryKeyOf } from '../../../../stateful-data/raw-issues-cache-key';
import { requiredFieldsFor } from '../../TableReport/model/builtinFieldRegistry';
import { mergeChildQuery, parseChildQuery } from './childParams.js';

/** Query key → the sorted union of Jira field ids that group's members need loaded. */
export type ChildQueryGroups = Map<string, string[]>;

/** The empty roster: no groups, so every child requests exactly what it asks for. */
export const NO_CHILD_QUERY_GROUPS: ChildQueryGroups = new Map();

/**
 * Walk the tree for the queries that will actually be fetched.
 *
 * Each entry is a child's **effective** query string — its saved `queryParams` with its node's
 * `overrides` laid over the top — because that is what the child itself will run. Grouping on the
 * saved string instead would put a child whose `jql`, `childJQL`, `loadChildren` or `tableColumns`
 * has been changed in-report into the wrong group; nothing would throw and nothing would render
 * wrong, the group would just split and cost a fetch, which is the exact failure this module
 * exists to prevent. See spec/016-report-of-reports/006-url-state Phase 3.
 *
 * An inline report contributes its own `query` — it renders a `ChildReport` exactly as a saved-report
 * node does, and so issues exactly the same request. Leaving it out would be a silent regression for
 * the case this module most obviously exists for: the secondary-slot migration produces documents
 * that are *two inline reports over one JQL* (spec/018-card-report/alt-plan.md). It costs nothing
 * for a Gantt beside a card board, whose requests are byte-identical anyway, and one whole fetch the
 * moment such a document gains a Table.
 *
 * `InlineValueNode` and `UnknownNode` are skipped — neither renders a `ChildReport`, so neither has a
 * child query to group. An inline value *does* fetch (a one-row search, and a comment request on top of
 * it for a `latestComment` one — spec/016-report-of-reports/007-latest-comment-report), but not through
 * `getRawIssues`, so it has no field projection to widen and nothing here can help it. An unresolvable
 * `reportId` is skipped too: it renders `MissingReportNote` instead of a `ChildReport`, so it never
 * fetches and must not pull a field into a union or turn a singleton into a group.
 */
function collectChildQueries(nodes: LayoutNode[], reports: Reports, found: string[]): void {
  for (const node of nodes) {
    if (node.type === 'section') {
      collectChildQueries(node.children, reports, found);
      continue;
    }

    if (node.type === 'inline-report') {
      found.push(node.params.query);
      continue;
    }

    if (node.type !== 'saved-report') continue;

    const report = reports[node.params.reportId];

    if (report) found.push(mergeChildQuery(report.queryParams, node.params.overrides));
  }
}

/**
 * Group a document's embedded reports by the question they ask Jira, and union the fields each group
 * needs.
 *
 * Only groups with **≥2 members** are returned: a report on its own has nothing to share with, and
 * handing it an override would be pure overhead. So a missing entry means "behave exactly as today",
 * which is why every failure mode of this function — an unresolvable report, a bad parse, a tree shape
 * it doesn't recognise — degrades to today's behaviour rather than to a wrong request.
 *
 * The union is **sorted**, and each group's array is one shared instance. Both matter downstream:
 * `ChildReport` feeds the array into the `useMemo` that builds its config, so an array rebuilt per
 * member (or per render) would rebuild configs and refetch. Sorting also keeps the value insertion-
 * order-independent, the same trap `rawIssuesCacheKey` guards against — the cache key's
 * canonicalization would rescue it, but nothing should lean on that.
 */
export function childQueryGroups(nodes: LayoutNode[], reports: Reports): ChildQueryGroups {
  const found: string[] = [];
  collectChildQueries(nodes, reports, found);

  const byQuery = new Map<string, { members: number; fields: Set<string> }>();

  for (const queryParams of found) {
    const { jql, childJQL, loadChildren, tableColumns } = parseChildQuery(queryParams);
    const key = queryKeyOf({ jql, childJQL, loadChildren });

    let group = byQuery.get(key);

    if (!group) {
      group = { members: 0, fields: new Set<string>() };
      byQuery.set(key, group);
    }

    group.members += 1;

    for (const column of tableColumns ?? []) {
      if (!column || typeof column.sourceId !== 'string') continue;

      for (const field of requiredFieldsFor(column.sourceId)) group.fields.add(field);
    }
  }

  const groups: ChildQueryGroups = new Map();

  for (const [key, { members, fields }] of byQuery) {
    if (members < 2) continue;

    groups.set(key, [...fields].sort());
  }

  return groups;
}

/**
 * The union this report should load, or `null` to load exactly what it asks for. `queryParams` is
 * the child's **effective** string — the same one {@link childQueryGroups} grouped on.
 */
export function overrideFor(groups: ChildQueryGroups, queryParams: string): string[] | null {
  const { jql, childJQL, loadChildren } = parseChildQuery(queryParams);

  return groups.get(queryKeyOf({ jql, childJQL, loadChildren })) ?? null;
}
