import type { FC, KeyboardEvent, ReactNode } from 'react';
import type { Report } from '../../jira/reports';
import type { CanObservable } from '../hooks/useCanObservable';
import type { DescribedReport, ExtraHaystack } from '../components/ReportListing';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { pushStateObservable } from '../../canjs/routing/state-storage';
import { lastUpdatedAt } from '../../jira/reports';

type Tab = 'starred' | 'mine' | 'all';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'starred', label: 'Starred' },
  { key: 'mine', label: 'My reports' },
  { key: 'all', label: 'All reports' },
];

/**
 * Rows the All tab renders per page. Every report is already loaded, so paging only limits what's
 * drawn; a page this size overflows any panel, so there is always something to scroll to load more.
 */
export const PAGE_SIZE = 50;

/**
 * Most recently updated first; reports with no timestamp (saved before it was kept) after all of
 * them, by name. Both timestamps are UTC ISO strings, so they compare as strings.
 */
export const byLastUpdated = (a: Report, b: Report): number => {
  const aUpdated = lastUpdatedAt(a);
  const bUpdated = lastUpdatedAt(b);

  if (aUpdated && bUpdated && aUpdated !== bUpdated) {
    return aUpdated < bUpdated ? 1 : -1;
  }

  if (!aUpdated !== !bUpdated) {
    return aUpdated ? -1 : 1;
  }

  return a.name.localeCompare(b.name);
};

/**
 * Where "Create new report" goes: a clean URL with only the Sources panel open. Dropping `report`
 * and every setting matters because this page can be open over a saved report — only opening
 * Sources would leave that report attached, so editing it and pressing Save would overwrite it.
 * `settings=SOURCES` also closes this page, which is `settings=REPORTS`.
 */
export const FRESH_REPORT_SEARCH = '?settings=SOURCES';

interface ViewReportProps {
  onBackButtonClicked: () => void;
  /**
   * Tells the app the user has left home to build a report, so the page behind Sources shows the
   * "choose sources" prompt rather than home — as home's own Create button does.
   */
  onStartReport?: () => void;
  /** Replaces the whole "Create new report" action. Injectable for tests and stories. */
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
 * owners and delete. See spec/041-saved-reports-redesign/phase1/plan.md § 8.
 */
const ViewReports: FC<ViewReportProps> = ({
  onBackButtonClicked,
  onStartReport,
  onCreateReportClicked = () => {
    onStartReport?.();
    (pushStateObservable as unknown as CanObservable<string>).set(FRESH_REPORT_SEARCH);
  },
}) => {
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
        .sort(byLastUpdated),
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

  /** A rendered row's link, found by name — report names are unique (`validateName`). */
  const findRowLink = (report: Report): HTMLAnchorElement | undefined =>
    Array.from(tableRef.current?.querySelectorAll('a') ?? []).find(
      (link) => link.getAttribute('aria-label') === report.name,
    );

  const { query, setQuery, filtered, activeIndex, setActiveIndex, handleKeyDown } = useReportSearch(reportsByTab[tab], {
    extraHaystack,
    // Click the row's own link, so ↵ navigates exactly as a click would (including the embedded
    // hosts' interception in `Link`).
    onActivate: (report) => findRowLink(report)?.click(),
  });

  // Paging — the All tab only. The next page loads as the table scrolls near its end (below).
  const [pages, setPages] = useState(1);

  // A new tab or query is a new list: back to the first page, scrolled to the top.
  useEffect(() => {
    setPages(1);
    tableRef.current?.scrollTo?.({ top: 0 });
  }, [tab, query]);

  // ↑/↓ move through the whole filtered list, but the All tab renders only the loaded pages. Load the
  // page holding the selected row, or ↓ past the last one selects a row with no link and ↵ does
  // nothing. Only ever grows, so it never undoes scrolling.
  useEffect(() => {
    if (tab === 'all') {
      setPages((count) => Math.max(count, Math.floor(activeIndex / PAGE_SIZE) + 1));
    }
  }, [tab, activeIndex]);

  const visible = tab === 'all' ? filtered.slice(0, pages * PAGE_SIZE) : filtered;
  const hasMore = visible.length < filtered.length;

  // Load the next page as the sentinel after the last row nears the bottom of the scrolling table.
  // Rebuilt per page on purpose: a fresh observer reports the sentinel's current state, so if a page
  // still leaves it in view (a very tall panel), the next one loads too.
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!hasMore || !sentinel || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setPages((count) => count + 1);
        }
      },
      { root: tableRef.current, rootMargin: '0px 0px 200px 0px' },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
    // `starsLoaded`: the table (and the sentinel in it) only mounts once stars load.
  }, [hasMore, pages, tab, query, starsLoaded]);

  // Keep the keyboard-selected row on screen in the scrolling table. Keyboard only — the mouse sets
  // the selection too (hover), and scrolling under the pointer would make the list jump. Waits on
  // `visible` because the row may only exist once the effect above has loaded its page.
  const scrollToActive = useRef(false);

  useEffect(() => {
    const active = filtered[activeIndex];
    const link = scrollToActive.current && active ? findRowLink(active.report) : undefined;

    if (link) {
      scrollToActive.current = false;
      link.closest('[role="row"]')?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeIndex, visible]);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      scrollToActive.current = true;
    }

    handleKeyDown(event);
  };

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
              onKeyDown={handleSearchKeyDown}
              elemBeforeInput={
                <span className="flex pl-2 text-neutral-300">
                  <SearchIcon label="" />
                </span>
              }
            />
          </div>
        </div>

        <div
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
                      updatedAt={lastUpdatedAt(report)}
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
              {!emptyState && hasMore && <div ref={sentinelRef} aria-hidden className="h-px" />}
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
