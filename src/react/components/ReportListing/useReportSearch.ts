import type { KeyboardEvent } from 'react';
import type { Report } from '../../../jira/reports';
import type { DescribedReport } from './describe-report';

import { useMemo, useState } from 'react';

import { describeReport } from './describe-report';
import { filterReports } from './report-search';

export interface UseReportSearchOptions {
  /** Fired when the user presses ↵ on the active row. */
  onActivate?: (report: Report) => void;
  /** Fired when the user presses Esc in the search field. */
  onEscape?: () => void;
}

export interface ReportSearch {
  query: string;
  setQuery: (query: string) => void;
  /** Every report, described. */
  described: DescribedReport[];
  /** `described` narrowed by `query`. */
  filtered: DescribedReport[];
  /** Index into `filtered` of the ↑/↓-selected row. */
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  /** Attach to the search field: ↑/↓ move the active row, ↵ activates it, Esc backs out. */
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Client-side search over saved reports — every report is already in memory, so there is no fetch.
 * Owns the query, the derived view-models, and keyboard navigation so the Add Report modal and the
 * Saved Reports page behave identically. See spec/023-report-modal.
 */
export const useReportSearch = (
  reports: Report[],
  { onActivate, onEscape }: UseReportSearchOptions = {},
): ReportSearch => {
  const [query, setQueryState] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const described = useMemo(() => reports.map(describeReport), [reports]);
  const filtered = useMemo(() => filterReports(described, query), [described, query]);

  // A new query renumbers the list, so the old active index no longer means anything.
  const setQuery = (newQuery: string) => {
    setQueryState(newQuery);
    setActiveIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const active = filtered[activeIndex];
      if (active) {
        onActivate?.(active.report);
      }
    } else if (event.key === 'Escape') {
      onEscape?.();
    }
  };

  return { query, setQuery, described, filtered, activeIndex, setActiveIndex, handleKeyDown };
};
