import type { FC, KeyboardEvent, ReactNode } from 'react';
import type { Report } from '../../jira/reports';
import type { DescribedReport, ExtraHaystack } from '../components/ReportListing';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Button from '@atlaskit/button/new';
import Textfield from '@atlaskit/textfield';
import FolderClosedIcon from '@atlaskit/icon/core/folder-closed';
import PersonIcon from '@atlaskit/icon/core/person';
import SearchIcon from '@atlaskit/icon/core/search';
import StarUnstarredIcon from '@atlaskit/icon/core/star-unstarred';

import ViewReportsLayout from './components/ViewReportsLayout';
import DeleteReportModal from './components/DeleteReportModal';
import Skeleton from '../components/Skeleton';
import { ReportTableHeader, ReportTableRow, useReportSearch } from '../components/ReportListing';
import { useAllReports, useDeleteReport, useRecentReports, useStarredReports } from '../services/reports';
import { useReportsStorageConfig } from '../services/reports-storage';
import { canDeleteReport, effectiveOwnerId, isOwnedBy, useCurrentAccountId } from '../services/user';
import routeData from '../../canjs/routing/route-data';

type Tab = 'starred' | 'mine' | 'all';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'starred', label: 'Starred' },
  { key: 'mine', label: 'My reports' },
  { key: 'all', label: 'All reports' },
];

/** A full-height row (32px icon, `py-2.5`, border). Only used to size a page of the All tab. */
const ROW_HEIGHT = 53;
const MIN_PAGE_SIZE = 6;

/** Enough rows to fill the panel, plus one so it always scrolls a little. */
export const pageSizeFor = (panelHeight: number): number =>
  Math.max(MIN_PAGE_SIZE, Math.ceil(panelHeight / ROW_HEIGHT) + 1);

const openSources = () => {
  (routeData as unknown as { showSettings: string }).showSettings = 'SOURCES';
};

interface ViewReportProps {
  onBackButtonClicked: () => void;
  /** "Create new report" — opens Sources by default, as home does. Injectable for tests. */
  onCreateReportClicked?: () => void;
}

const EmptyState: FC<{ icon: ReactNode; title: string; children: ReactNode }> = ({ icon, title, children }) => (
  <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-20 text-neutral-300">
      {icon}
    </span>
    <strong className="text-neutral-800">{title}</strong>
    <p className="text-sm text-neutral-300">{children}</p>
  </div>
);

/**
 * Every saved report: Starred / My reports / All reports tabs, search, and a table with stars,
 * owners and delete. See spec/041-saved-reports-redesign/phase1.md § 8.
 */
const ViewReports: FC<ViewReportProps> = ({ onBackButtonClicked, onCreateReportClicked = openSources }) => {
  const reports = useAllReports();
  // Read here rather than in the modal: this component already suspends on `useAllReports`, so the
  // config resolves alongside the list instead of suspending the modal open.
  const storage = useReportsStorageConfig();
  const currentAccountId = useCurrentAccountId();
  const { starredIds, isLoaded: starsLoaded, toggleStar, removeStar } = useStarredReports();
  const { removeFromRecentReports } = useRecentReports();
  const { deleteReport, isDeleting } = useDeleteReport();
  const [managedReport, setManagedReport] = useState<Report>();

  const sortedReports = useMemo(
    () =>
      Object.values(reports)
        .filter((report): report is Report => !!report)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [reports],
  );

  const isMine = useCallback((report: Report) => isOwnedBy(report, currentAccountId), [currentAccountId]);

  const reportsByTab = useMemo(
    () => ({
      starred: sortedReports.filter((report) => starredIds.has(report.id)),
      mine: sortedReports.filter(isMine),
      all: sortedReports,
    }),
    [sortedReports, starredIds, isMine],
  );

  // Starred when anything (that still exists) is starred, otherwise All. Decided once, as soon as
  // the stars are known — not on every change, or unstarring your last report would switch tabs
  // out from under the click.
  const [chosenTab, setChosenTab] = useState<Tab | null>(null);

  useEffect(() => {
    if (chosenTab === null && starsLoaded) {
      setChosenTab(reportsByTab.starred.length > 0 ? 'starred' : 'all');
    }
  }, [chosenTab, starsLoaded, reportsByTab.starred.length]);

  const tab = chosenTab ?? 'all';

  const extraHaystack = useCallback<ExtraHaystack>(({ jql }: DescribedReport) => [jql], []);

  const tableRef = useRef<HTMLDivElement>(null);

  const { query, setQuery, filtered, activeIndex, setActiveIndex, handleKeyDown } = useReportSearch(reportsByTab[tab], {
    extraHaystack,
    // Click the row's own link, so ↵ navigates exactly as a click would (including the embedded
    // hosts' interception in `Link`).
    onActivate: (report) => {
      const links = tableRef.current?.querySelectorAll('a') ?? [];

      Array.from(links)
        .find((link) => link.getAttribute('aria-label') === report.name)
        ?.click();
    },
  });

  // Paging — the All tab only. Sized from the tab panel, which flex-fills the page; the table is
  // only as tall as the rows already in it.
  const panelRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(MIN_PAGE_SIZE);
  const [pages, setPages] = useState(1);

  useLayoutEffect(() => {
    setPageSize(pageSizeFor(panelRef.current?.clientHeight ?? 0));
  }, []);

  // A new tab or query is a new list: back to the first page, scrolled to the top.
  useEffect(() => {
    setPages(1);
    tableRef.current?.scrollTo?.({ top: 0 });
  }, [tab, query]);

  const visible = tab === 'all' ? filtered.slice(0, pages * pageSize) : filtered;

  const selectTab = (next: Tab) => {
    setChosenTab(next);
    setActiveIndex(0);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex(({ key }) => key === tab);
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

    if (!step) {
      return;
    }

    event.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length];
    selectTab(next.key);
    document.getElementById(`saved-reports-tab-${next.key}`)?.focus();
  };

  const selectedReportName = useMemo(() => {
    const selectedId = new URLSearchParams(window.location.search).get('report');

    return selectedId ? (reports[selectedId]?.name ?? '') : '';
  }, [reports]);

  const emptyState = (() => {
    if (sortedReports.length === 0) {
      return (
        <EmptyState icon={<FolderClosedIcon label="" />} title="No saved reports yet">
          Save a report and it will show up here.
        </EmptyState>
      );
    }

    if (reportsByTab[tab].length === 0 && tab === 'starred') {
      return (
        <EmptyState icon={<StarUnstarredIcon label="" />} title="No starred reports yet">
          Star a report to keep it at the top of your list.
        </EmptyState>
      );
    }

    if (reportsByTab[tab].length === 0 && tab === 'mine') {
      return (
        <EmptyState icon={<PersonIcon label="" />} title="You have not saved any reports">
          Reports you create show up here.
        </EmptyState>
      );
    }

    if (filtered.length === 0) {
      return (
        <EmptyState icon={<SearchIcon label="" />} title={`No reports match "${query}"`}>
          Try a different name or JQL.
        </EmptyState>
      );
    }

    return null;
  })();

  return (
    <>
      <ViewReportsLayout
        onBackButtonClicked={onBackButtonClicked}
        reportInfo={selectedReportName ? <p>{selectedReportName}</p> : null}
        actions={
          <Button appearance="primary" onClick={onCreateReportClicked}>
            Create new report
          </Button>
        }
      >
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-41">
          <div role="tablist" aria-label="Saved reports" className="flex gap-4">
            {TABS.map(({ key, label }) => {
              const selected = key === tab;

              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`saved-reports-tab-${key}`}
                  aria-selected={selected}
                  aria-controls="saved-reports-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectTab(key)}
                  onKeyDown={handleTabKeyDown}
                  className={`-mb-px flex items-center gap-2 border-b-2 px-1 pb-2 text-sm font-medium ${
                    selected
                      ? 'border-blue-400 text-blue-400'
                      : 'border-transparent text-neutral-801 hover:text-neutral-800'
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-1.5 text-xs font-semibold ${
                      selected ? 'bg-blue-101 text-blue-400' : 'bg-neutral-20 text-neutral-801'
                    }`}
                  >
                    {key === 'starred' && !starsLoaded ? '–' : reportsByTab[key].length}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="w-full max-w-xs pb-2">
            <Textfield
              placeholder="Search by name or JQL"
              aria-label="Search reports"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={handleKeyDown}
              elemBeforeInput={
                <span className="flex pl-2 text-neutral-300">
                  <SearchIcon label="" />
                </span>
              }
            />
          </div>
        </div>

        <div
          ref={panelRef}
          role="tabpanel"
          id="saved-reports-panel"
          aria-labelledby={`saved-reports-tab-${tab}`}
          className="flex min-h-0 flex-1 flex-col pt-4"
        >
          {!starsLoaded ? (
            <div className="flex flex-col gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} height="48px" />
              ))}
            </div>
          ) : (
            <div
              ref={tableRef}
              role="table"
              aria-label="Saved reports"
              className="min-h-0 overflow-auto rounded-xl border border-neutral-41 bg-white shadow-sm"
            >
              <ReportTableHeader className="rounded-t-xl" />
              {emptyState ??
                visible.map((described, index) => {
                  const { report } = described;

                  return (
                    <ReportTableRow
                      key={report.id}
                      described={described}
                      ownerId={effectiveOwnerId(report)}
                      isMine={isMine(report)}
                      isStarred={starredIds.has(report.id)}
                      onToggleStar={() => toggleStar(report.id, report.name)}
                      href={'?report=' + report.id}
                      onDelete={canDeleteReport(report, currentAccountId) ? () => setManagedReport(report) : undefined}
                      query={query}
                      isActive={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                    />
                  );
                })}
            </div>
          )}

          {starsLoaded && tab === 'all' && !emptyState && (
            <div className="flex items-center gap-3 pt-3 text-sm text-neutral-300">
              {visible.length < filtered.length && (
                <Button onClick={() => setPages((count) => count + 1)}>Load more</Button>
              )}
              <span>
                Showing {visible.length} of {filtered.length}
              </span>
            </div>
          )}
        </div>
      </ViewReportsLayout>
      <DeleteReportModal
        isOpen={!!managedReport}
        isDeleting={isDeleting}
        closeModal={() => setManagedReport(undefined)}
        deleteReport={() => {
          if (!managedReport) {
            return;
          }

          deleteReport(managedReport.id, {
            onSuccess: () => {
              removeFromRecentReports(managedReport.id);
              removeStar(managedReport.id);
            },
            onSettled: () => setManagedReport(undefined),
          });
        }}
        report={managedReport}
        storage={storage}
      />
    </>
  );
};

export default ViewReports;
