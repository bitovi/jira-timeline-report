import React, { useMemo, useState } from 'react';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { DerivedIssue } from '../../../jira/derived/derive';
import { useCanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { toMetricsIssues, buildStatusCategoryMap } from './adapter';
import { calculateCycleTimeStats, calculateWipAge, getInProgressDate } from './metrics';
import { FlowCharts } from './FlowCharts';
import { MetricsCards } from './MetricsCards';
import { IssueDebugModal, buildModalRows } from './IssueDebugModal';
import type { ModalIssueRow } from './IssueDebugModal';
import { EXCLUDED_STATUSES_BY_DEFAULT, EXCLUDED_ISSUE_TYPES_BY_DEFAULT } from './flowMetricsDefaults';
import { InfoTooltip } from './Tooltip';

interface FlowMetricsProps {
  filteredDerivedIssuesObs: CanObservable<Array<DerivedIssue>>;
  flowMetricsCycleTimeRangeObs: CanObservable<number>;
  flowMetricsStatusFilterObs: CanObservable<string[]>;
  flowMetricsIssueTypeFilterObs: CanObservable<string[]>;
  flowMetricsProjectFilterObs: CanObservable<string[]>;
  flowMetricsTeamFilterObs: CanObservable<string[]>;
}

type ModalState = { issues: ModalIssueRow[]; highlightKeys: Set<string> } | null;

export const FlowMetrics: React.FC<FlowMetricsProps> = (props) => {
  const derivedIssues = useCanObservable(props.filteredDerivedIssuesObs);
  const cycleTimeRange = useCanObservable(props.flowMetricsCycleTimeRangeObs);
  const statusFilter = useCanObservable(props.flowMetricsStatusFilterObs);
  const issueTypeFilter = useCanObservable(props.flowMetricsIssueTypeFilterObs);
  const projectFilter = useCanObservable(props.flowMetricsProjectFilterObs);
  const teamFilter = useCanObservable(props.flowMetricsTeamFilterObs);

  const [modalState, setModalState] = useState<ModalState>(null);
  const [issuesOpen, setIssuesOpen] = useState(false);

  const [nirCollapsed, setNirCollapsed] = useState<Set<string>>(new Set());
  const [nirSortCol, setNirSortCol] = useState<string | null>(null);
  const [nirSortDir, setNirSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleNirCollapse = (key: string) =>
    setNirCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handleNirSort = (col: string) => {
    if (nirSortCol === col) {
      setNirSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setNirSortCol(col);
      setNirSortDir('asc');
    }
  };

  const nirCollapsedTh = (label: string, colKey: string) => {
    const collapsed = nirCollapsed.has(colKey);
    const isSorted = nirSortCol === colKey;
    if (collapsed) {
      return (
        <th
          key={colKey}
          className="py-2 font-semibold whitespace-nowrap cursor-pointer select-none hover:text-blue-600 w-8 px-1 align-bottom"
          onClick={() => toggleNirCollapse(colKey)}
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
      <th key={colKey} className="py-2 font-semibold whitespace-nowrap select-none pr-3">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="cursor-pointer hover:text-blue-600"
            title={`Collapse ${label}`}
            onClick={() => toggleNirCollapse(colKey)}
          >
            {label}
          </button>
          <button
            type="button"
            className={`text-base ml-1 cursor-pointer ${isSorted ? 'text-blue-600' : 'text-neutral-300 hover:text-neutral-500'}`}
            title={`Sort by ${label}`}
            onClick={() => handleNirSort(colKey)}
          >
            {isSorted && nirSortDir === 'desc' ? '▴' : '▾'}
          </button>
        </div>
      </th>
    );
  };

  const filteredIssues = useMemo(() => {
    let issues = derivedIssues ?? [];
    if (statusFilter?.length) {
      issues = issues.filter((i) => statusFilter.includes(i.status ?? ''));
    } else {
      issues = issues.filter((i) => !EXCLUDED_STATUSES_BY_DEFAULT.has(i.status?.toLowerCase() ?? ''));
    }
    if (issueTypeFilter?.length) {
      issues = issues.filter((i) => issueTypeFilter.includes(i.type));
    } else {
      issues = issues.filter((i) => !EXCLUDED_ISSUE_TYPES_BY_DEFAULT.has(i.type?.toLowerCase() ?? ''));
    }
    if (projectFilter?.length) issues = issues.filter((i) => projectFilter.includes(i.projectKey));
    if (teamFilter?.length) issues = issues.filter((i) => teamFilter.includes(i.team?.name ?? ''));
    return issues;
  }, [derivedIssues, statusFilter, issueTypeFilter, projectFilter, teamFilter]);

  const allProjectKeys = useMemo(
    () => [...new Set((derivedIssues ?? []).map((i) => i.projectKey))].sort(),
    [derivedIssues],
  );

  const { statusCategoryMap, metricsIssues } = useMemo(() => {
    // Build the map from ALL issues (not just team-filtered) so that status categories
    // for every status ID in the project are available. Without this, if a team has no
    // issues currently sitting in a "To Do" state, the "new" category never gets seeded
    // into the name map and getInProgressDate returns null for all those issues.
    const statusCategoryMap = buildStatusCategoryMap(derivedIssues ?? []);
    return { statusCategoryMap, metricsIssues: toMetricsIssues(filteredIssues, statusCategoryMap) };
  }, [filteredIssues, derivedIssues]);

  const cycleTimeIssues = useMemo(() => {
    if (!cycleTimeRange) return metricsIssues;
    const cutoff = Date.now() - cycleTimeRange * 24 * 60 * 60 * 1000;
    return metricsIssues.filter(
      (i) => i.fields.resolutiondate && new Date(i.fields.resolutiondate).getTime() >= cutoff,
    );
  }, [metricsIssues, cycleTimeRange]);

  const cycleTimeStats = useMemo(
    () => calculateCycleTimeStats(cycleTimeIssues, statusCategoryMap),
    [cycleTimeIssues, statusCategoryMap],
  );

  const projectMedians = useMemo(() => {
    const byProject = new Map<string, typeof cycleTimeIssues>();
    for (const issue of cycleTimeIssues) {
      const bucket = byProject.get(issue.projectKey) ?? [];
      bucket.push(issue);
      byProject.set(issue.projectKey, bucket);
    }
    return [...byProject.entries()]
      .map(([projectKey, issues]) => ({
        projectKey,
        median: calculateCycleTimeStats(issues, statusCategoryMap)?.median ?? null,
      }))
      .filter((p): p is { projectKey: string; median: number } => p.median !== null)
      .sort((a, b) => a.projectKey.localeCompare(b.projectKey));
  }, [cycleTimeIssues, statusCategoryMap]);

  const wipIssues = useMemo(() => {
    const unresolved = metricsIssues.filter((i) => !i.fields.resolutiondate);
    if (!cycleTimeRange) return unresolved;
    const cutoff = Date.now() - cycleTimeRange * 24 * 60 * 60 * 1000;
    return unresolved.filter((i) => {
      const ip = getInProgressDate(i, statusCategoryMap);
      return !ip || ip.getTime() >= cutoff;
    });
  }, [metricsIssues, cycleTimeRange, statusCategoryMap]);

  const wipAgeResult = useMemo(() => calculateWipAge(wipIssues, statusCategoryMap), [wipIssues, statusCategoryMap]);

  const wipAgeByKey = useMemo(() => new Map((wipAgeResult?.items ?? []).map((i) => [i.key, i.age])), [wipAgeResult]);

  const modalIssueRows = useMemo(
    () => buildModalRows(filteredIssues as any, metricsIssues, statusCategoryMap, wipAgeByKey),
    [filteredIssues, metricsIssues, statusCategoryMap, wipAgeByKey],
  );

  const cycleTimeKeys = useMemo(() => new Set(cycleTimeIssues.map((i) => i.key)), [cycleTimeIssues]);

  const wipKeys = useMemo(() => new Set((wipAgeResult?.items ?? []).map((i) => i.key)), [wipAgeResult]);

  const notInReportRows = useMemo(
    () => modalIssueRows.filter((r) => !cycleTimeKeys.has(r.key) && !wipKeys.has(r.key)),
    [modalIssueRows, cycleTimeKeys, wipKeys],
  );

  const sortedNirRows = useMemo(() => {
    if (!nirSortCol) return notInReportRows;
    return [...notInReportRows].sort((a, b) => {
      let av: string | number | null = null;
      let bv: string | number | null = null;
      switch (nirSortCol) {
        case '__key__':
          av = a.key;
          bv = b.key;
          break;
        case '__summary__':
          av = a.summary;
          bv = b.summary;
          break;
        case '__type__':
          av = a.type;
          bv = b.type;
          break;
        case '__status__':
          av = a.status;
          bv = b.status;
          break;
        case '__category__':
          av = a.statusCategory;
          bv = b.statusCategory;
          break;
        case '__inProgress__':
          av = a.inProgressDate;
          bv = b.inProgressDate;
          break;
        case '__done__':
          av = a.doneDate;
          bv = b.doneDate;
          break;
        case '__cycleTime__':
          av = a.cycleTime;
          bv = b.cycleTime;
          break;
        default:
          return 0;
      }
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { sensitivity: 'base', numeric: true });
      return nirSortDir === 'asc' ? cmp : -cmp;
    });
  }, [notInReportRows, nirSortCol, nirSortDir]);

  const handleHistogramBarClick = (issueKeys: string[]) => {
    const keySet = new Set(issueKeys);
    const rows = modalIssueRows
      .filter((r) => keySet.has(r.key))
      .sort((a, b) => (b.doneDateMs ?? 0) - (a.doneDateMs ?? 0));
    setModalState({ issues: rows, highlightKeys: new Set() });
  };

  const handleCountClick = () => {
    const done = modalIssueRows
      .filter((r) => cycleTimeKeys.has(r.key))
      .sort((a, b) => (b.doneDateMs ?? 0) - (a.doneDateMs ?? 0));
    setModalState({ issues: done, highlightKeys: new Set() });
  };

  const openWipModal = () => {
    const sle = cycleTimeStats?.p85 ?? null;
    const wipRows = modalIssueRows.filter((r) => wipKeys.has(r.key)).sort((a, b) => (b.age ?? -1) - (a.age ?? -1));
    const exceedingKeys =
      sle !== null
        ? new Set(wipRows.filter((r) => r.age !== null && r.age > sle).map((r) => r.key))
        : new Set<string>();
    setModalState({ issues: wipRows, highlightKeys: exceedingKeys });
  };

  const handleWipCountClick = openWipModal;
  const handleSleExceedingClick = openWipModal;

  return (
    <div className="p-4 flex flex-col gap-y-6">
      <FlowCharts
        doneIssues={cycleTimeIssues}
        allProjectKeys={allProjectKeys}
        projectMedians={projectMedians}
        cycleTimeRangeDays={cycleTimeRange ?? 30}
        statusCategoryMap={statusCategoryMap}
        onHistogramBarClick={handleHistogramBarClick}
      />

      <MetricsCards
        cycleTimeStats={cycleTimeStats}
        wipAgeResult={wipAgeResult}
        cycleTimeRangeDays={cycleTimeRange ?? 30}
        onCountClick={handleCountClick}
        onWipCountClick={handleWipCountClick}
        onSleExceedingClick={handleSleExceedingClick}
      />

      <div>
        <button
          type="button"
          className="flex items-center gap-2 text-base font-semibold mb-2 cursor-pointer select-none hover:text-neutral-600"
          onClick={() => setIssuesOpen((o) => !o)}
        >
          Issues Not in Report ({notInReportRows.length})
          <InfoTooltip text="Issues are excluded from throughput and WIP counts for one of three reasons: (1) they are in a To Do state and have never been started; (2) they were completed before the selected date range; or (3) they are in progress but were started before the selected date range." />
          <span
            style={{
              fontSize: '16px',
              lineHeight: 1,
              transition: 'transform 0.15s',
              display: 'inline-block',
              transform: issuesOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▾
          </span>
        </button>
        {issuesOpen &&
          (notInReportRows.length === 0 ? (
            <p className="text-xs text-neutral-400">All issues are accounted for in throughput or WIP.</p>
          ) : (
            <div className="overflow-auto max-h-[640px] border border-neutral-200 rounded">
              <table className="text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-white">
                  <tr className="text-left border-b border-neutral-200">
                    {nirCollapsedTh('Key', '__key__')}
                    {nirCollapsedTh('Summary', '__summary__')}
                    {nirCollapsedTh('Type', '__type__')}
                    {nirCollapsedTh('Status', '__status__')}
                    {nirCollapsedTh('Category', '__category__')}
                    {nirCollapsedTh('In Progress', '__inProgress__')}
                    {nirCollapsedTh('Done', '__done__')}
                    {nirCollapsedTh('Cycle Time', '__cycleTime__')}
                  </tr>
                </thead>
                <tbody>
                  {sortedNirRows.map((row) => (
                    <tr
                      key={row.key}
                      className="border-b border-neutral-100 cursor-pointer hover:bg-neutral-50"
                      onClick={() => setModalState({ issues: [row], highlightKeys: new Set() })}
                    >
                      {nirCollapsed.has('__key__') ? (
                        <td className="w-8" />
                      ) : (
                        <td className="py-1.5 pr-6 whitespace-nowrap font-mono">
                          {row.url ? (
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row.key}
                            </a>
                          ) : (
                            <span className="text-blue-700">{row.key}</span>
                          )}
                        </td>
                      )}
                      {nirCollapsed.has('__summary__') ? (
                        <td className="w-8" />
                      ) : (
                        <td className="py-1.5 pr-6">
                          <div className="w-48 truncate text-gray-700">{row.summary}</div>
                        </td>
                      )}
                      {nirCollapsed.has('__type__') ? (
                        <td className="w-8" />
                      ) : (
                        <td className="py-1.5 pr-6 whitespace-nowrap text-gray-600">{row.type}</td>
                      )}
                      {nirCollapsed.has('__status__') ? (
                        <td className="w-8" />
                      ) : (
                        <td className="py-1.5 pr-6 whitespace-nowrap text-gray-600">{row.status}</td>
                      )}
                      {nirCollapsed.has('__category__') ? (
                        <td className="w-8" />
                      ) : (
                        <td className="py-1.5 pr-6 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full ${
                              row.statusCategory === 'done'
                                ? 'bg-green-100 text-green-700'
                                : row.statusCategory === 'indeterminate'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {row.statusCategory === 'done'
                              ? 'Done'
                              : row.statusCategory === 'indeterminate'
                                ? 'In Progress'
                                : 'To Do'}
                          </span>
                        </td>
                      )}
                      {nirCollapsed.has('__inProgress__') ? (
                        <td className="w-8" />
                      ) : (
                        <td className="py-1.5 pr-6 whitespace-nowrap text-gray-600">{row.inProgressDate}</td>
                      )}
                      {nirCollapsed.has('__done__') ? (
                        <td className="w-8" />
                      ) : (
                        <td className="py-1.5 pr-6 whitespace-nowrap text-gray-600">{row.doneDate}</td>
                      )}
                      {nirCollapsed.has('__cycleTime__') ? (
                        <td className="w-8" />
                      ) : (
                        <td className="py-1.5 whitespace-nowrap">
                          {row.cycleTime !== null ? (
                            <span className="text-gray-800">{row.cycleTime}d</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>

      {modalState && (
        <IssueDebugModal
          issues={modalState.issues}
          highlightKeys={modalState.highlightKeys}
          sle={cycleTimeStats?.p85 ?? null}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
};
