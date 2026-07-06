import React from 'react';
import { specialStatusTextClass } from '../../helpers/status';
import type { IssueOrRelease } from '../../types';

export interface LabelCellProps {
  issue: IssueOrRelease;
  depth: number;
  isShowingChildren: boolean;
  hasChildren: boolean;
  /** When true (some row is expanded elsewhere), the chevron stays visible even without hover —
   * ports `showExpandChildrenIcon`'s `somePrimaryIssuesAreExpanded` branch. */
  anyExpanded: boolean;
  onToggle: () => void;
  textSizeClass: string;
  expandPaddingClass: string;
}

/**
 * The chevron (expand/collapse) + linked issue summary shown in an issue row's label gutter.
 *
 * Ports the `<a href={data.issue.url}>` block from gantt-grid.js's `view` template.
 */
export const LabelCell: React.FC<LabelCellProps> = ({
  issue,
  depth,
  isShowingChildren,
  hasChildren,
  anyExpanded,
  onToggle,
  textSizeClass,
  expandPaddingClass,
}) => (
  <div className={`flex z-10 items-stretch group ${anyExpanded ? 'justify-left' : 'justify-between'}`}>
    <div
      onClick={hasChildren ? onToggle : undefined}
      className={`${hasChildren ? 'pointer hover:bg-neutral-41' : ''} ${expandPaddingClass} w-4 box-content`}
      style={{ paddingLeft: `${depth * 16}px` }}
    >
      {hasChildren && (
        <img
          src={isShowingChildren ? '/images/chevron-down-collapse.svg' : '/images/chevron-right-expand.svg'}
          alt=""
          className={`inline ${anyExpanded ? '' : 'invisible group-hover:visible'}`}
        />
      )}
    </div>
    <a
      href={issue.url}
      target="_blank"
      rel="noreferrer"
      className={`${specialStatusTextClass(issue.rollupStatuses.rollup.status)} ${textSizeClass} pt-1 pb-0.5 px-1 truncate max-w-96 pointer hover:underline`}
    >
      {issue.summary}
    </a>
  </div>
);
