import type { FC, ReactNode } from 'react';
import type { Reports } from '../../../../jira/reports';
import type { LayoutNode } from '../model/sections';
import type { ChildQueryGroups } from '../model/childQueryGroups';

import React, { createContext, useContext, useMemo } from 'react';

import { childQueryGroups, NO_CHILD_QUERY_GROUPS, overrideFor } from '../model/childQueryGroups';

/**
 * The document's request-dedupe roster, published to every embedded report.
 *
 * A context rather than a prop because the document renders recursively — a prop would have to be
 * threaded through `SectionNode` at every depth. `ChildReport` already holds its own `report`, so it
 * does its own lookup and the recursive render code doesn't change at all: a provider at the top, a
 * lookup in one leaf.
 *
 * The default is the empty roster, so a `ChildReport` rendered outside a document (its own tests) and
 * the shell's primary report are unaffected with no conditionals anywhere.
 */
const ChildQueryGroupsContext = createContext<ChildQueryGroups>(NO_CHILD_QUERY_GROUPS);

export const ChildQueryGroupsProvider: FC<{
  sections: LayoutNode[];
  reports: Reports;
  children: ReactNode;
}> = ({ sections, reports, children }) => {
  // Memoized, and `childQueryGroups` returns one shared array per group, because `ChildReport` feeds
  // the looked-up array straight into the `useMemo` that builds its `ChildReportConfig`. A roster
  // rebuilt on every render would rebuild every config — and with it every `rawIssuesRequestData` —
  // on every render, and a document re-renders on every hover change. That turns a change about
  // *reducing* requests into an unbounded request loop, so the identity here is load-bearing.
  const groups = useMemo(() => childQueryGroups(sections, reports), [sections, reports]);

  return <ChildQueryGroupsContext.Provider value={groups}>{children}</ChildQueryGroupsContext.Provider>;
};

/**
 * The wider field list this report should load, or `null` to load exactly what it asks for.
 *
 * Only what gets *loaded* widens; the report still renders exactly the columns it was saved with.
 *
 * Memoized **by content**, not by the roster's identity. The roster is rebuilt whenever `sections`
 * changes — which is now every document edit, a column sort included — and handing back a fresh
 * array each time would rebuild every child's `ChildReportConfig`, and with it every child's fetch
 * cascade. The field union is unchanged for all of those edits; only the array wrapping it moved.
 * See spec/016-report-of-reports/006-url-state Phase 2.
 */
export function useChildFieldsOverride(queryParams: string): string[] | null {
  const groups = useContext(ChildQueryGroupsContext);
  const fields = overrideFor(groups, queryParams);
  // NUL-joined rather than comma- or space-joined: these are Jira field *names* ("Story
  // points"), so a printable separator would let two different unions produce one key.
  const key = fields === null ? null : fields.join('\u0000');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => fields, [key]);
}
