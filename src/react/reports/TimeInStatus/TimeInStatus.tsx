import React, { useMemo, useEffect, useRef, useState } from 'react';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { DerivedIssue } from '../../../jira/derived/derive';
import { useCanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { useRouteData } from '../../hooks/useRouteData/useRouteData';
import { TimeInStatusCharts } from './TimeInStatusCharts';
import type { IssueTypeChartData } from './TimeInStatusCharts';

interface TimeInStatusProps {
  filteredDerivedIssuesObs: CanObservable<Array<DerivedIssue>>;
}

function getStatusDurationsMap(issue: DerivedIssue): Map<string, number> {
  const durations = new Map<string, number>();

  const fields = issue.issue?.fields as Record<string, unknown> | undefined;
  const rawCreated = fields?.Created;
  const issueCreatedMs = rawCreated ? new Date(rawCreated as string).getTime() : null;

  // An issue is complete when its current status is in the "done" category.
  // resolutiondate is not fetched by the pipeline (not in CORE_FIELDS), so we
  // rely on the status category alone — matching how FlowMetrics derives completion.
  const currentStatusCategory = issue.issue?.fields?.Status?.statusCategory;
  const currentCatKey = currentStatusCategory
    ? ((currentStatusCategory as { key?: string; name?: string }).key ??
      ((currentStatusCategory as { name?: string }).name === 'Done' ? 'done' : undefined))
    : undefined;
  const isComplete = currentCatKey === 'done';

  const changelog = issue.issue?.changelog ?? [];
  const statusChanges = changelog
    .filter((entry) => entry.items.some((item) => item.field === 'status'))
    .sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());

  // Transition-based durations: each entry's `fromString` accumulates the time
  // between the prior transition (or creation, for the first one) and this one.
  for (let i = 0; i < statusChanges.length; i++) {
    const entry = statusChanges[i];
    const statusItem = entry.items.find((item) => item.field === 'status');
    if (!statusItem?.fromString) continue;

    const transitionMs = new Date(entry.created).getTime();
    const prevMs = i === 0 ? (issueCreatedMs ?? transitionMs) : new Date(statusChanges[i - 1].created).getTime();

    const duration = transitionMs - prevMs;
    if (duration > 0) {
      durations.set(statusItem.fromString, (durations.get(statusItem.fromString) ?? 0) + duration);
    }
  }

  // Current-status duration: only for issues still in flight. An active item
  // counts time accrued in its current status (e.g. "In Progress for 30 days").
  // Completed issues (resolved OR currently in a done-category status) end at
  // their final transition — accumulating "current Done time" with Date.now()
  // would otherwise grow forever for tickets moved to Done long ago.
  if (!isComplete) {
    if (statusChanges.length > 0) {
      const lastChange = statusChanges[statusChanges.length - 1];
      const lastItem = lastChange.items.find((item) => item.field === 'status');
      if (lastItem?.toString) {
        const sinceMs = new Date(lastChange.created).getTime();
        durations.set(lastItem.toString, (durations.get(lastItem.toString) ?? 0) + (Date.now() - sinceMs));
      }
    } else if (issue.status && issueCreatedMs) {
      // No changelog: issue has been in its current status since creation.
      durations.set(issue.status, Date.now() - issueCreatedMs);
    }
  }

  return durations;
}

function getStatusEntryDatesMap(issue: DerivedIssue): Map<string, Date> {
  const entryDates = new Map<string, Date>();

  const fields = issue.issue?.fields as Record<string, unknown> | undefined;
  const rawCreated = fields?.Created;
  const issueCreatedDate = rawCreated ? new Date(rawCreated as string) : null;

  const changelog = issue.issue?.changelog ?? [];
  const statusChanges = changelog
    .filter((entry) => entry.items.some((item) => item.field === 'status'))
    .sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());

  // The first status (before any transitions) was entered at issue creation
  if (statusChanges.length > 0) {
    const firstItem = statusChanges[0].items.find((item) => item.field === 'status');
    if (firstItem?.fromString && issueCreatedDate && !entryDates.has(firstItem.fromString)) {
      entryDates.set(firstItem.fromString, issueCreatedDate);
    }
  } else if (issue.status && issueCreatedDate) {
    entryDates.set(issue.status, issueCreatedDate);
  }

  // Each transition TO a status tells us when it was entered (record first visit only)
  for (const entry of statusChanges) {
    const statusItem = entry.items.find((item) => item.field === 'status');
    if (statusItem?.toString && !entryDates.has(statusItem.toString)) {
      entryDates.set(statusItem.toString, new Date(entry.created));
    }
  }

  return entryDates;
}

type CategoryKey = 'new' | 'indeterminate' | 'done';

function toCategoryKey(statusCategory: { name: string }): CategoryKey {
  const cat = statusCategory as { name: string; key?: string };
  if (cat.key === 'new' || cat.key === 'indeterminate' || cat.key === 'done') return cat.key;
  switch (cat.name) {
    case 'Done':
      return 'done';
    case 'In Progress':
      return 'indeterminate';
    default:
      return 'new';
  }
}

/**
 * Builds a status name → category key map using the same two-pass strategy as the
 * FlowMetrics adapter, so statuses that only appear in changelog history (never as
 * a current status in the result set) are still categorised correctly.
 *
 * Pass 1 – current statuses carry the full statusCategory object; use them to seed
 *           both an id-keyed map and a name-keyed map.
 * Pass 2 – changelog items only carry status ID + name. Cross-reference the two maps:
 *           if we know a status ID's category (from pass 1), record the name; if we
 *           know a status name's category, record the ID. Iterate until stable.
 */
function buildStatusNameCategoryMap(issues: DerivedIssue[]): Map<string, CategoryKey> {
  const idMap = new Map<string, CategoryKey>(); // status id   → category
  const nameMap = new Map<string, CategoryKey>(); // status name → category

  // Pass 1: current status fields carry the full statusCategory object.
  for (const issue of issues) {
    const status = issue.issue?.fields?.Status;
    if (!status?.name || !status?.statusCategory) continue;
    const key = toCategoryKey(status.statusCategory);
    idMap.set(status.id, key);
    nameMap.set(status.name, key);
  }

  // Pass 2: changelog items only have id (from/to) and name (fromString/toString).
  // Use whichever half we already know to fill in the other.
  for (const issue of issues) {
    for (const entry of issue.issue?.changelog ?? []) {
      for (const item of entry.items) {
        if (item.field !== 'status') continue;

        const { from, to, fromString, toString } = item;

        if (from && fromString) {
          if (!nameMap.has(fromString) && idMap.has(from)) nameMap.set(fromString, idMap.get(from)!);
          if (!idMap.has(from) && nameMap.has(fromString)) idMap.set(from, nameMap.get(fromString)!);
        }
        if (to && toString) {
          if (!nameMap.has(toString) && idMap.has(to)) nameMap.set(toString, idMap.get(to)!);
          if (!idMap.has(to) && nameMap.has(toString)) idMap.set(to, nameMap.get(toString)!);
        }
      }
    }
  }

  return nameMap;
}

function buildWorkflowOrder(issues: DerivedIssue[]): string[] {
  const categoryMap = buildStatusNameCategoryMap(issues);

  // Collect all known statuses from the full set so no status is missing from columns.
  const allStatuses = new Set<string>();
  for (const issue of issues) {
    if (issue.status) allStatuses.add(issue.status);
    for (const entry of issue.issue?.changelog ?? []) {
      for (const item of entry.items) {
        if (item.field !== 'status') continue;
        if (item.fromString) allStatuses.add(item.fromString);
        if (item.toString) allStatuses.add(item.toString);
      }
    }
  }

  // Limit ordering computation to the 100 most-recent issues per issue type.
  // This prevents a high-volume type from dominating position averages and
  // ensures stale workflows from old issues don't skew the column order.
  const byType = new Map<string, DerivedIssue[]>();
  for (const issue of issues) {
    const type = issue.type ?? '__unknown__';
    const bucket = byType.get(type) ?? [];
    bucket.push(issue);
    byType.set(type, bucket);
  }
  const orderingIssues: DerivedIssue[] = [];
  for (const typedIssues of byType.values()) {
    const sorted = [...typedIssues].sort((a, b) => {
      const aMs = (() => {
        const d = (a.issue?.fields as Record<string, unknown>)?.created;
        return d ? new Date(d as string).getTime() : 0;
      })();
      const bMs = (() => {
        const d = (b.issue?.fields as Record<string, unknown>)?.created;
        return d ? new Date(d as string).getTime() : 0;
      })();
      return bMs - aMs;
    });
    orderingIssues.push(...sorted.slice(0, 100));
  }

  // Per-project accumulator: projectKey → statusName → { sum, count }
  const perProjectPos = new Map<string, Map<string, { sum: number; count: number }>>();

  for (const issue of orderingIssues) {
    const pk = issue.projectKey ?? '__default__';

    const changes = (issue.issue?.changelog ?? [])
      .filter((e) => e.items.some((i) => i.field === 'status'))
      .sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());

    // Build the ordered path of first visits for this issue
    const visitOrder: string[] = [];
    const seen = new Set<string>();

    // The first status is the one transitioned FROM in the earliest changelog entry
    if (changes.length > 0) {
      const firstItem = changes[0].items.find((i) => i.field === 'status');
      if (firstItem?.fromString && !seen.has(firstItem.fromString)) {
        visitOrder.push(firstItem.fromString);
        seen.add(firstItem.fromString);
      }
    }
    for (const entry of changes) {
      const item = entry.items.find((i) => i.field === 'status');
      if (!item?.toString) continue;
      if (!seen.has(item.toString)) {
        visitOrder.push(item.toString);
        seen.add(item.toString);
      }
    }

    // If no changelog, treat current status as the only position
    if (visitOrder.length === 0 && issue.status) {
      visitOrder.push(issue.status);
    }

    if (visitOrder.length === 0) continue;

    let pkMap = perProjectPos.get(pk);
    if (!pkMap) {
      pkMap = new Map();
      perProjectPos.set(pk, pkMap);
    }

    for (let i = 0; i < visitOrder.length; i++) {
      const status = visitOrder[i];
      const pos = visitOrder.length === 1 ? 0.5 : i / (visitOrder.length - 1);
      const acc = pkMap.get(status) ?? { sum: 0, count: 0 };
      acc.sum += pos;
      acc.count += 1;
      pkMap.set(status, acc);
    }
  }

  // Compute global average position: average of per-project averages
  const globalAvgPos = new Map<string, number>();
  for (const status of allStatuses) {
    let projectSum = 0;
    let projectCount = 0;
    for (const pkMap of perProjectPos.values()) {
      const acc = pkMap.get(status);
      if (acc && acc.count > 0) {
        projectSum += acc.sum / acc.count;
        projectCount += 1;
      }
    }
    globalAvgPos.set(status, projectCount > 0 ? projectSum / projectCount : 0.5);
  }

  // catRank: use categoryMap when known; fall back to average path position for
  // statuses that only appear in changelog history and were never categorised.
  const catRank = (s: string): number => {
    const cat = categoryMap.get(s);
    if (cat === 'new') return 0;
    if (cat === 'indeterminate') return 1;
    if (cat === 'done') return 2;
    const pos = globalAvgPos.get(s) ?? 0.5;
    return pos < 0.33 ? 0 : pos > 0.67 ? 2 : 1;
  };

  const ordered = [...allStatuses].sort((a, b) => {
    const rankDiff = catRank(a) - catRank(b);
    if (rankDiff !== 0) return rankDiff;
    return (globalAvgPos.get(a) ?? 0.5) - (globalAvgPos.get(b) ?? 0.5);
  });

  // Strip the leading "To Do" only — backlog dwell time before work starts
  // dominates the y-axis if left in. Trailing Done is kept: if Done is genuinely
  // terminal it'll just have no data, and if a team has a status after Done
  // (e.g. "Deployed to Prod") then Done has real transition time worth showing.
  if (ordered.length > 0 && catRank(ordered[0]) === 0) {
    ordered.shift();
  }

  return ordered;
}

function formatDuration(ms: number): string {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const DEFAULT_ISSUE_TYPES = ['Story', 'Bug', 'Task', 'Sub-Task', 'Subtask'];
const DEFAULT_ISSUE_TYPE_SET = new Set(DEFAULT_ISSUE_TYPES);

export const TimeInStatus: React.FC<TimeInStatusProps> = (props) => {
  const allIssues = useCanObservable(props.filteredDerivedIssuesObs);
  const [dateRange] = useRouteData<number | undefined>('timeInStatusDateRange');
  const [statusFilter, setStatusFilter] = useRouteData<string[] | undefined>('timeInStatusStatusFilter');
  const [issueTypeFilter, setIssueTypeFilter] = useRouteData<string[] | undefined>('timeInStatusIssueTypeFilter');
  const [projectFilter] = useRouteData<string[] | undefined>('timeInStatusProjectFilter');
  const [customOrders, setCustomOrders] = useRouteData<Record<string, string[]> | undefined>('timeInStatusReorder');

  // Initialize issue type filter to standard types on first load (when no explicit filter is saved)
  const filterInitialized = useRef(false);
  useEffect(() => {
    if (filterInitialized.current) return;
    if (issueTypeFilter !== undefined) {
      filterInitialized.current = true;
      return;
    }
    if (!allIssues?.length) return;
    const availableTypes = [...new Set(allIssues.map((i) => i.type).filter(Boolean))];
    const defaults = availableTypes.filter((t) => DEFAULT_ISSUE_TYPE_SET.has(t));
    if (defaults.length > 0 && defaults.length < availableTypes.length) {
      setIssueTypeFilter(defaults);
    }
    filterInitialized.current = true;
  }, [allIssues, issueTypeFilter, setIssueTypeFilter]);

  const handleSetCustomOrder = (issueType: string, order: string[] | null) => {
    const next = { ...(customOrders ?? {}) };
    if (order === null) {
      delete next[issueType];
    } else {
      next[issueType] = order;
    }
    setCustomOrders(Object.keys(next).length === 0 ? undefined : next);
  };

  // Stable color reference: keyed off the full unfiltered issue set so colors
  // don't shift when a project is unchecked from the Teams dropdown.
  const allProjectKeys = useMemo(
    () => [...new Set((allIssues ?? []).map((i) => i.projectKey).filter(Boolean))].sort(),
    [allIssues],
  );

  const issues = useMemo(() => {
    let filtered = allIssues ?? [];
    if (dateRange) {
      const cutoff = Date.now() - dateRange * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((i) => {
        const rawCreated = (i.issue?.fields as Record<string, unknown>)?.created;
        return !rawCreated || new Date(rawCreated as string).getTime() >= cutoff;
      });
    }
    if (issueTypeFilter?.length) filtered = filtered.filter((i) => issueTypeFilter.includes(i.type));
    if (projectFilter?.length) filtered = filtered.filter((i) => projectFilter.includes(i.projectKey));
    return filtered;
  }, [allIssues, dateRange, issueTypeFilter, projectFilter]);

  const { rows, statusColumns, issueTypeCharts } = useMemo(() => {
    if (!issues?.length) {
      return {
        rows: [],
        statusColumns: [] as string[],
        issueTypeCharts: [] as IssueTypeChartData[],
      };
    }

    // allProjectKeys is computed separately (from allIssues) for color stability

    // Compute durations and entry dates once per issue and reuse for both table and charts
    const issuesWithDurations = issues.map((issue) => ({
      issue,
      durations: getStatusDurationsMap(issue),
      entryDates: getStatusEntryDatesMap(issue),
    }));

    const rows = issuesWithDurations.map(({ issue, durations, entryDates }) => ({
      key: issue.key,
      url: issue.url,
      summary: issue.summary,
      type: issue.type,
      status: issue.status ?? '—',
      durations,
      entryDates,
    }));

    // Group by issue type, sorted by count descending
    const byType = new Map<string, typeof issuesWithDurations>();
    for (const item of issuesWithDurations) {
      const bucket = byType.get(item.issue.type) ?? [];
      bucket.push(item);
      byType.set(item.issue.type, bucket);
    }

    // Per-type workflow ordering: each issue type derives its own column order
    // from its own issues only, so toggling one type's filter cannot reshape
    // another type's chart.
    const perTypeOrderings = new Map<string, string[]>();
    for (const [type, items] of byType) {
      perTypeOrderings.set(type, buildWorkflowOrder(items.map(({ issue }) => issue)));
    }

    // All statuses ever seen per type (from full changelog), used for the
    // Hidden area in the Reorder dropdown. buildWorkflowOrder strips the
    // leading "To Do/Backlog" status, so we collect independently here.
    const perTypeAllStatuses = new Map<string, string[]>();
    for (const [type, items] of byType) {
      const seen = new Set<string>();
      for (const { issue } of items) {
        if (issue.status) seen.add(issue.status);
        for (const entry of issue.issue?.changelog ?? []) {
          for (const item of entry.items) {
            if (item.field !== 'status') continue;
            if (item.fromString) seen.add(item.fromString);
            if (item.toString) seen.add(item.toString);
          }
        }
      }
      const ordered = perTypeOrderings.get(type) ?? [];
      const orderedSet = new Set(ordered);
      const extras = [...seen].filter((s) => !orderedSet.has(s)).sort();
      perTypeAllStatuses.set(type, [...ordered, ...extras]);
    }

    // Global statusColumns (for the Issue Detail table) is the union of all
    // per-type orderings, preserving relative order from each type's perspective.
    const seenStatuses = new Set<string>();
    const statusColumns: string[] = [];
    for (const ordering of perTypeOrderings.values()) {
      for (const status of ordering) {
        if (!seenStatuses.has(status)) {
          seenStatuses.add(status);
          statusColumns.push(status);
        }
      }
    }

    const issueTypeCharts: IssueTypeChartData[] = Array.from(byType.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([issueType, items]) => {
        const typeStatusColumns = perTypeOrderings.get(issueType) ?? [];

        // Group items by project key
        const byProject = new Map<string, typeof items>();
        for (const item of items) {
          const pk = item.issue.projectKey ?? 'Unknown';
          const bucket = byProject.get(pk) ?? [];
          bucket.push(item);
          byProject.set(pk, bucket);
        }

        const series: IssueTypeChartData['series'] = [...byProject.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([projectKey, projectItems]) => {
            const points: IssueTypeChartData['series'][number]['points'] = [];

            for (let i = 0; i < typeStatusColumns.length; i++) {
              const status = typeStatusColumns[i];
              const statusDurations = projectItems
                .map(({ durations }) => durations.get(status))
                .filter((d): d is number => d !== undefined);

              if (statusDurations.length > 0) {
                const avgMs = statusDurations.reduce((sum, d) => sum + d, 0) / statusDurations.length;
                points.push({ statusIndex: i, statusName: status, avgMs });
              }
            }

            return { projectKey, count: projectItems.length, points };
          });

        return {
          issueType,
          count: items.length,
          statusColumns: typeStatusColumns,
          allStatusColumns: perTypeAllStatuses.get(issueType) ?? typeStatusColumns,
          series,
        };
      });

    return { rows, statusColumns, issueTypeCharts };
  }, [issues]);

  // statusFilter controls which status COLUMNS are visible (not which issues).
  // For the Issue Detail table, apply it to the global statusColumns.
  const visibleStatusColumns = useMemo(
    () => (statusFilter?.length ? statusColumns.filter((s) => statusFilter.includes(s)) : statusColumns),
    [statusColumns, statusFilter],
  );

  // For each per-type chart, apply the same global filter to its own columns.
  // Default types appear first; non-default types (e.g. Epic, Spike) appear below.
  const filteredIssueTypeCharts = useMemo(() => {
    const charts = statusFilter?.length
      ? issueTypeCharts.map((chart) => ({
          ...chart,
          statusColumns: chart.statusColumns.filter((s) => statusFilter.includes(s)),
        }))
      : issueTypeCharts;
    return [...charts].sort((a, b) => {
      const aDefault = DEFAULT_ISSUE_TYPE_SET.has(a.issueType) ? 0 : 1;
      const bDefault = DEFAULT_ISSUE_TYPE_SET.has(b.issueType) ? 0 : 1;
      if (aDefault !== bDefault) return aDefault - bDefault;
      return b.count - a.count; // within each group, sort by count descending
    });
  }, [issueTypeCharts, statusFilter]);

  const handleRemoveStatus = (status: string) => {
    const base = statusFilter?.length ? statusFilter : statusColumns;
    setStatusFilter(base.filter((s) => s !== status));
  };

  const handleRestoreStatus = (status: string) => {
    if (!statusFilter?.length) return;
    if (!statusFilter.includes(status)) {
      setStatusFilter([...statusFilter, status]);
    }
  };

  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const toggleCollapse = (key: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const [issueDetailOpen, setIssueDetailOpen] = useState(true);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      let av: string | Date | undefined;
      let bv: string | Date | undefined;
      if (sortCol === '__key__') {
        av = a.key;
        bv = b.key;
      } else if (sortCol === '__summary__') {
        av = a.summary;
        bv = b.summary;
      } else if (sortCol === '__type__') {
        av = a.type;
        bv = b.type;
      } else if (sortCol === '__currentStatus__') {
        av = a.status;
        bv = b.status;
      } else {
        av = a.entryDates.get(sortCol);
        bv = b.entryDates.get(sortCol);
      }
      if (av === undefined && bv === undefined) return 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      const cmp =
        av instanceof Date && bv instanceof Date
          ? av.getTime() - bv.getTime()
          : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base', numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);

  if (!allIssues) return <div className="p-4 text-neutral-600">Loading...</div>;
  if (!issues.length) return <div className="p-4 text-neutral-600">No issues to display.</div>;

  const fixedColumns = [
    { key: '__key__', label: 'Key', sticky: true },
    { key: '__summary__', label: 'Summary', sticky: false },
    { key: '__type__', label: 'Type', sticky: false },
    { key: '__currentStatus__', label: 'Current Status', sticky: false },
  ] as const;

  const collapsedTh = (label: string, colKey: string, extra = '') => {
    const collapsed = collapsedColumns.has(colKey);
    const isSorted = sortCol === colKey;

    if (collapsed) {
      return (
        <th
          key={colKey}
          className={`py-2 font-semibold whitespace-nowrap cursor-pointer select-none hover:text-blue-600 w-8 px-1 align-bottom ${extra}`}
          onClick={() => toggleCollapse(colKey)}
          title={`Expand: ${label}`}
        >
          <div className="flex flex-col items-center gap-0.5 pb-1">
            <span className="text-neutral-400 text-[10px]">▶</span>
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{label}</span>
          </div>
        </th>
      );
    }

    return (
      <th key={colKey} className={`py-2 font-semibold whitespace-nowrap select-none pr-3 ${extra}`}>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="cursor-pointer hover:text-blue-600"
            title={`Collapse ${label}`}
            onClick={() => toggleCollapse(colKey)}
          >
            {label}
          </button>
          <button
            type="button"
            className={`text-base ml-1 cursor-pointer ${isSorted ? 'text-blue-600' : 'text-neutral-300 hover:text-neutral-500'}`}
            title={`Sort by ${label}`}
            onClick={() => handleSort(colKey)}
          >
            {isSorted && sortDir === 'desc' ? '▴' : '▾'}
          </button>
        </div>
      </th>
    );
  };

  return (
    <div className="p-4 flex flex-col gap-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-1">Time in Status</h2>
        <p className="text-sm text-neutral-600">
          Average time by issue type per workflow status. {issues.length} issue{issues.length !== 1 ? 's' : ''}.
        </p>
      </div>

      <TimeInStatusCharts
        issueTypes={filteredIssueTypeCharts}
        allProjectKeys={allProjectKeys}
        onHideStatus={handleRemoveStatus}
        onShowStatus={handleRestoreStatus}
        customOrders={customOrders}
        onSetCustomOrder={handleSetCustomOrder}
      />

      <div>
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-semibold mb-3 cursor-pointer hover:text-blue-600 select-none"
          onClick={() => setIssueDetailOpen((o) => !o)}
        >
          <span>{issueDetailOpen ? '▾' : '▶'}</span>
          <span>Issue Detail</span>
          <span className="text-neutral-400 font-normal">({rows.length})</span>
        </button>
        {issueDetailOpen && (
          <div className="overflow-auto max-h-[640px] border border-neutral-200 rounded">
            <table className="text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-white">
                <tr className="text-left border-b border-neutral-200">
                  {fixedColumns.map(({ key, label, sticky }) =>
                    collapsedTh(label, key, sticky ? 'sticky left-0 z-30 bg-white' : ''),
                  )}
                  {visibleStatusColumns.map((status) => collapsedTh(status, status))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.key} className="border-b border-neutral-100 hover:bg-neutral-50">
                    {collapsedColumns.has('__key__') ? (
                      <td className="sticky left-0 z-10 bg-white w-8" />
                    ) : (
                      <td className="sticky left-0 z-10 bg-white py-1.5 pr-6 whitespace-nowrap">
                        <a href={row.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          {row.key}
                        </a>
                      </td>
                    )}
                    {collapsedColumns.has('__summary__') ? (
                      <td className="w-8" />
                    ) : (
                      <td className="py-1.5 pr-6">
                        <div className="w-48 truncate">{row.summary}</div>
                      </td>
                    )}
                    {collapsedColumns.has('__type__') ? (
                      <td className="w-8" />
                    ) : (
                      <td className="py-1.5 pr-6 whitespace-nowrap">{row.type}</td>
                    )}
                    {collapsedColumns.has('__currentStatus__') ? (
                      <td className="w-8" />
                    ) : (
                      <td className="py-1.5 pr-6 whitespace-nowrap">{row.status}</td>
                    )}
                    {visibleStatusColumns.map((status) => {
                      if (collapsedColumns.has(status)) {
                        return <td key={status} className="w-8" />;
                      }
                      const entryDate = row.entryDates.get(status);
                      return (
                        <td key={status} className="py-1.5 pr-4 whitespace-nowrap font-mono text-right">
                          {entryDate ? formatDate(entryDate) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
