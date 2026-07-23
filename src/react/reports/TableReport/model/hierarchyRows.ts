/**
 * Hierarchy row-ordering for the Table report (spec/012-table-and-grouper, Phase 2, design §1/§4).
 *
 * Ports `EstimationTable/helpers/rows.ts` (`makeGetChildren` / `buildTableRows`) but generalised to
 * operate on the Table report's {@link TableIssue} set and to support:
 *  - expand/collapse (descendants of a collapsed row are omitted),
 *  - column sort ordering *within* siblings when hierarchy is on (design §4).
 *
 * A row is depth-first: a parent immediately followed by each child subtree in order. Children are
 * resolved from each issue's own `reportingHierarchy.childKeys` (the same linkage the Estimation
 * Table uses), looked up against the full issue set — so the caller must pass the full linked set,
 * not just the top-level roots.
 */
import type { TableIssue } from './columns';

/** One flattened, depth-tagged hierarchy row. */
export interface HierarchyRow {
  issue: TableIssue;
  depth: number;
  /** Whether this issue has any resolvable children (drives the expand/collapse caret). */
  hasChildren: boolean;
  /** The resolved child keys (present in the issue set) of this issue. */
  childKeys: string[];
}

/** Read an issue's key (defaults to the `key` field). */
type GetKey = (issue: TableIssue) => string | undefined;
/** Read an issue's child keys (defaults to `reportingHierarchy.childKeys`). */
type GetChildKeys = (issue: TableIssue) => string[];

const defaultGetKey: GetKey = (issue) => issue.key;

const defaultGetChildKeys: GetChildKeys = (issue) => {
  const hierarchy = (issue as { reportingHierarchy?: { childKeys?: string[] } }).reportingHierarchy;
  return hierarchy?.childKeys ?? [];
};

export interface BuildHierarchyRowsOptions {
  /** The top-level issues that seed the tree, in the order they should appear. */
  roots: TableIssue[];
  /** The full linked issue set (roots + all descendants) used to resolve child keys. */
  allIssues: TableIssue[];
  /** Keys whose descendants should be omitted (collapsed rows). */
  collapsedKeys?: ReadonlySet<string>;
  /** Orders siblings (and roots) when column sort is active; omitted → source order. */
  compareSiblings?: (a: TableIssue, b: TableIssue) => number;
  getKey?: GetKey;
  getChildKeys?: GetChildKeys;
}

/**
 * Build a `getChildren` lookup from the full issue list using each issue's `childKeys`, resolving
 * only keys that are actually present in the set (missing keys are dropped, matching the Estimation
 * Table).
 */
export function makeGetChildren(
  allIssues: TableIssue[],
  getChildKeys: GetChildKeys = defaultGetChildKeys,
  getKey: GetKey = defaultGetKey,
): (issue: TableIssue) => TableIssue[] {
  const byKey = new Map<string, TableIssue>();
  for (const issue of allIssues) {
    const key = getKey(issue);
    if (key != null) byKey.set(key, issue);
  }
  return (issue) =>
    getChildKeys(issue)
      .map((key) => byKey.get(key))
      .filter((child): child is TableIssue => !!child);
}

/**
 * Depth-first flatten the roots and their descendants into depth-tagged {@link HierarchyRow}s.
 * Descendants of any key in `collapsedKeys` are omitted (the collapsed row itself still appears, and
 * still reports `hasChildren`). Siblings — and the roots — are ordered by `compareSiblings` when
 * provided, otherwise kept in source order.
 */
export function buildHierarchyRows(options: BuildHierarchyRowsOptions): HierarchyRow[] {
  const {
    roots,
    allIssues,
    collapsedKeys,
    compareSiblings,
    getKey = defaultGetKey,
    getChildKeys = defaultGetChildKeys,
  } = options;

  const getChildren = makeGetChildren(allIssues, getChildKeys, getKey);

  const order = (issues: TableIssue[]): TableIssue[] => (compareSiblings ? [...issues].sort(compareSiblings) : issues);

  const walk = (issue: TableIssue, depth: number): HierarchyRow[] => {
    const children = getChildren(issue);
    const hasChildren = children.length > 0;
    const row: HierarchyRow = { issue, depth, hasChildren, childKeys: children.map((c) => getKey(c) ?? '') };

    const key = getKey(issue);
    const collapsed = key != null && collapsedKeys?.has(key);
    if (!hasChildren || collapsed) return [row];

    return [row, ...order(children).flatMap((child) => walk(child, depth + 1))];
  };

  return order(roots).flatMap((issue) => walk(issue, 0));
}
