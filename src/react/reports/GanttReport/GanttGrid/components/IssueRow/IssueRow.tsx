import React from 'react';
import { LabelCell } from '../LabelCell';
import { PercentCompleteCell } from '../PercentCompleteCell';
import { TimelineCell } from '../TimelineCell';
import type { AxisRange, IssueOrRelease, WorkTypeWithWork } from '../../types';

export interface IssueRowProps {
  issue: IssueOrRelease;
  depth: number;
  isShowingChildren: boolean;
  hasChildren: boolean;
  anyExpanded: boolean;
  onToggle: (issue: IssueOrRelease) => void;
  showPercentComplete: boolean;
  onPercentCompleteClick: (issue: IssueOrRelease) => void;
  range: AxisRange;
  roundTo: string;
  isDense: boolean;
  isBreakdown: boolean;
  workTypesWithWork: WorkTypeWithWork[];
  textSizeClass: string;
  expandPaddingClass: string;
  /** 1-based CSS grid row line this row occupies. */
  gridRow: number;
  /** CSS `grid-column` spanning the month columns for this row's timeline cell. */
  timelineGridColumn: string;
  /** Alternating row background — every other row gets a subtle stripe. */
  striped: boolean;
}

/**
 * One issue's row: label (chevron + link), an optional % complete cell, and the timeline bar
 * cell — three siblings sharing the same CSS grid row via `display: contents`.
 *
 * The alternating-row stripe only paints the label/gutter columns when some row elsewhere is
 * expanded (matching gantt-grid.js#L441-L448: the background spans the full row width only
 * when `somePrimaryIssuesAreExpanded`; otherwise it's confined to the timeline columns so the
 * un-expanded gutter stays unstriped).
 */
export const IssueRow: React.FC<IssueRowProps> = ({
  issue,
  depth,
  isShowingChildren,
  hasChildren,
  anyExpanded,
  onToggle,
  showPercentComplete,
  onPercentCompleteClick,
  range,
  roundTo,
  isDense,
  isBreakdown,
  workTypesWithWork,
  textSizeClass,
  expandPaddingClass,
  gridRow,
  timelineGridColumn,
  striped,
}) => {
  const gutterStripeClass = anyExpanded && striped ? 'bg-neutral-20' : '';
  const timelineStripeClass = striped ? 'bg-neutral-20' : '';
  return (
    <div style={{ display: 'contents' }}>
      <div style={{ gridRow, gridColumn: 1 }} className={gutterStripeClass} />
      <div style={{ gridRow, gridColumn: 2 }} className={gutterStripeClass}>
        <LabelCell
          issue={issue}
          depth={depth}
          isShowingChildren={isShowingChildren}
          hasChildren={hasChildren}
          anyExpanded={anyExpanded}
          onToggle={() => onToggle(issue)}
          textSizeClass={textSizeClass}
          expandPaddingClass={expandPaddingClass}
        />
      </div>
      {showPercentComplete && (
        <div style={{ gridRow, gridColumn: 3 }} className={gutterStripeClass}>
          <PercentCompleteCell issue={issue} textSizeClass={textSizeClass} onClick={onPercentCompleteClick} />
        </div>
      )}
      <div style={{ gridRow, gridColumn: timelineGridColumn }} className={timelineStripeClass}>
        <TimelineCell
          issue={issue}
          range={range}
          roundTo={roundTo}
          isDense={isDense}
          isBreakdown={isBreakdown}
          workTypesWithWork={workTypesWithWork}
          gridColumn={timelineGridColumn}
        />
      </div>
    </div>
  );
};
