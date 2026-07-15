import React, { useState } from 'react';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { useCanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { IssueClickHandler, IssueOrRelease, SecondaryReportMode } from './types';
import { buildBoard, fontSizeClass } from './helpers';
import { WorkBreakdownCard } from './components/WorkBreakdownCard';
import { PlanningCard } from './components/PlanningCard';
import { IssuePopup } from './components/IssuePopup';
import type { FilterRow } from '../../../jira/rollup/filter-rows/filter-rows';

/** Stable empty observable used when an optional observable prop isn't supplied. */
const emptyIssuesObs: CanObservable<IssueOrRelease[]> = {
  value: [],
  getData: () => [],
  get: () => [],
  set: () => undefined,
  on: () => undefined,
  off: () => undefined,
} as unknown as CanObservable<IssueOrRelease[]>;

/** Stable empty observable used when `filterRowsObs` isn't supplied. */
const emptyFilterRowsObs: CanObservable<FilterRow[]> = {
  value: [],
  getData: () => [],
  get: () => [],
  set: () => undefined,
  on: () => undefined,
  off: () => undefined,
} as unknown as CanObservable<FilterRow[]>;

export interface WorkBreakdownProps {
  /** Primary issues/releases — one card each. */
  primaryIssuesOrReleasesObs: CanObservable<IssueOrRelease[]>;
  /** All issues/releases — used to look up card children by key. */
  allIssuesOrReleasesObs: CanObservable<IssueOrRelease[]>;
  /** Issues shown in the "Planning" fallback card (excluded from card children). */
  planningIssuesObs?: CanObservable<IssueOrRelease[]>;
  /** `routeData.secondaryReportType` — `'breakdown'` shows the matrix; anything else shows status. */
  secondaryReportTypeObs: CanObservable<string>;
  /** The secondary report's own filter rows — narrows cards/child rows independently of the
   *  primary Filters control (see `buildBoard`). */
  filterRowsObs?: CanObservable<FilterRow[]>;
  /** A second, independent set of filter rows scoped to the CHILD issue type — decides which
   *  children (if any) render within an already-shown card (see `buildBoard`). */
  childFilterRowsObs?: CanObservable<FilterRow[]>;
  /** Click handler for cards/rows — wired to the issue tooltip when mounted in the app. */
  onIssueClick?: IssueClickHandler;
}

const toMode = (secondaryReportType: string): SecondaryReportMode =>
  secondaryReportType === 'breakdown' ? 'breakdown' : 'status';

/**
 * Work Breakdown & Status secondary report (React). Renders one card per primary issue: a
 * rollup-status header over either a single status column (`status`) or a work-type status matrix
 * (`breakdown`), plus a "Planning" fallback card. All status/date/density math lives in
 * {@link buildBoard} and the pure helpers it composes; this component only reads observables and
 * maps the resulting board to JSX.
 */
export const WorkBreakdown: React.FC<WorkBreakdownProps> = (props) => {
  const primaryIssues = useCanObservable(props.primaryIssuesOrReleasesObs);
  const allIssues = useCanObservable(props.allIssuesOrReleasesObs);
  const planningIssues = useCanObservable(props.planningIssuesObs ?? emptyIssuesObs);
  const secondaryReportType = useCanObservable(props.secondaryReportTypeObs);
  const filterRows = useCanObservable(props.filterRowsObs ?? emptyFilterRowsObs);
  const childFilterRows = useCanObservable(props.childFilterRowsObs ?? emptyFilterRowsObs);

  const [popup, setPopup] = useState<{ issue: IssueOrRelease; anchorEl: HTMLElement } | null>(null);

  const handleIssueClick: IssueClickHandler = (event, issue) => {
    props.onIssueClick?.(event, issue);
    setPopup({ issue, anchorEl: event.currentTarget as HTMLElement });
  };

  const mode = toMode(secondaryReportType);
  const board = buildBoard(
    primaryIssues ?? [],
    allIssues ?? [],
    mode,
    planningIssues ?? [],
    filterRows ?? [],
    childFilterRows ?? [],
  );

  return (
    <div className="flex flex-wrap items-start gap-3 px-2 py-2">
      {board.cards.length === 0 && board.planning.length === 0 ? (
        <div className="rounded border border-neutral-40 overflow-hidden bg-white">
          <div className="color-text-and-bg-unknown rounded-t px-2.5 py-1.5 font-semibold">
            {filterRows.length > 0 ? 'Nothing matches the current filters.' : 'Unable to find any issues.'}
          </div>
        </div>
      ) : (
        board.cards.map((card) => (
          <WorkBreakdownCard
            key={card.key}
            card={card}
            mode={board.mode}
            density={board.density}
            onIssueClick={handleIssueClick}
          />
        ))
      )}
      <PlanningCard
        planning={board.planning}
        fontSize={fontSizeClass(board.density, board.planning.length)}
        onIssueClick={handleIssueClick}
      />
      {popup && <IssuePopup issue={popup.issue} anchorEl={popup.anchorEl} onClose={() => setPopup(null)} />}
    </div>
  );
};
