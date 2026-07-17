import type { IssueOrRelease } from '../types';

export type GroupByOption = '' | 'parent' | 'team' | 'project';

export interface IssueGroup<T = IssueOrRelease> {
  /** Stable key for the group (e.g. parent key, team name, project key). */
  key: string;
  /** Display title for the group's gutter label; `null` means "no grouping" (single implicit group). */
  title: string | null;
  issues: T[];
  /**
   * The resolved parent issue, populated only by `groupByParent` (`'parent'` grouping).
   * `undefined` for team/project/ungrouped groups; `null` for the "No Parent" bucket.
   * Additive field — consumers that ignore it (e.g. ScatterTimeline) are unaffected.
   */
  parent?: IssueOrRelease | null;
}

const NO_PARENT_KEY = 'no-parent';
const NO_TEAM_KEY = 'no-team';
const NO_PROJECT_KEY = 'no-project';

const identity = <T>(item: T): IssueOrRelease => item as unknown as IssueOrRelease;

/**
 * Partition issues/releases (or any wrapper around them, via `getIssue`) into ordered groups
 * for the scatter timeline's band layout.
 *
 * `allIssues` is the full rolled-up issue set (not just the primary issues being plotted) and
 * is only used for `'parent'` grouping, to look up each parent's summary/rank the same way the
 * Gantt chart does (`getSortedParents` in gantt-grid.js) — the primary issues only carry their
 * own `parentKey`, not the parent's summary.
 *
 * When `groupBy` is `''`, a single group with `title: null` is returned so callers can render
 * the ungrouped layout unchanged.
 *
 * `getIssue` extracts the underlying `IssueOrRelease` from each item — defaults to the
 * identity function so the helper can be called directly with `IssueOrRelease[]` (as in its
 * unit tests), or with e.g. `PlottedIssue[]` by passing `(plotted) => plotted.issue`.
 */
export const groupIssues = <T = IssueOrRelease>(
  items: T[],
  allIssues: IssueOrRelease[],
  groupBy: GroupByOption,
  getIssue: (item: T) => IssueOrRelease = identity,
): IssueGroup<T>[] => {
  if (groupBy === 'parent') return groupByParent(items, allIssues, getIssue);
  if (groupBy === 'team') {
    return groupByField(items, (item) => getIssue(item).team?.name || null, NO_TEAM_KEY, 'No Team');
  }
  if (groupBy === 'project') {
    return groupByField(items, (item) => getIssue(item).projectKey || null, NO_PROJECT_KEY, 'No Project');
  }
  return [{ key: 'all', title: null, issues: items }];
};

function groupByParent<T>(
  items: T[],
  allIssues: IssueOrRelease[],
  getIssue: (item: T) => IssueOrRelease,
): IssueGroup<T>[] {
  const allByKey = new Map(allIssues.map((issue) => [issue.key, issue]));
  const childrenByParentKey = new Map<string, T[]>();

  for (const item of items) {
    const parentKey = getIssue(item).parentKey || NO_PARENT_KEY;
    const existing = childrenByParentKey.get(parentKey);
    if (existing) {
      existing.push(item);
    } else {
      childrenByParentKey.set(parentKey, [item]);
    }
  }

  const groups: Array<IssueGroup<T> & { rank: string | null }> = Array.from(childrenByParentKey.entries()).map(
    ([parentKey, children]) => {
      if (parentKey === NO_PARENT_KEY) {
        return { key: NO_PARENT_KEY, title: 'No Parent', issues: children, rank: null, parent: null };
      }
      const parent = allByKey.get(parentKey) ?? null;
      // The parent itself may not be in `allIssues` (e.g. it sits above the rolled-up hierarchy).
      // Fall back to the embedded `fields.Parent` Jira attaches to each child issue before
      // resorting to the bare key.
const embeddedParentSummary = children.map(getIssue).map((i) => i.issue?.fields?.Parent?.fields?.summary).find(Boolean);
      return {
        key: parentKey,
        title: parent?.summary ?? embeddedParentSummary ?? parentKey,
        issues: children,
        rank: parent?.rank ?? null,
        parent,
      };
    },
  );

  groups.sort((a, b) => {
    if (a.key === NO_PARENT_KEY) return 1;
    if (b.key === NO_PARENT_KEY) return -1;
    if (a.rank != null && b.rank != null) {
      return a.rank > b.rank ? 1 : a.rank < b.rank ? -1 : 0;
    }
    return (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' });
  });

  return groups.map(({ key, title, issues: groupedItems, parent }) => ({ key, title, issues: groupedItems, parent }));
}

function groupByField<T>(
  items: T[],
  getValue: (item: T) => string | null,
  noneKey: string,
  noneTitle: string,
): IssueGroup<T>[] {
  const byKey = new Map<string, T[]>();

  for (const item of items) {
    const key = getValue(item) || noneKey;
    const existing = byKey.get(key);
    if (existing) {
      existing.push(item);
    } else {
      byKey.set(key, [item]);
    }
  }

  const groups = Array.from(byKey.entries()).map(([key, groupedItems]) => ({
    key,
    title: key === noneKey ? noneTitle : key,
    issues: groupedItems,
  }));

  groups.sort((a, b) => {
    if (a.key === noneKey) return 1;
    if (b.key === noneKey) return -1;
    return (a.title as string).localeCompare(b.title as string, undefined, { sensitivity: 'base' });
  });

  return groups;
}
