import type { FC } from 'react';
import type { DescribedReport } from './describe-report';

import React from 'react';
import { IconButton } from '@atlaskit/button/new';
import DeleteIcon from '@atlaskit/icon/core/delete';
import PersonIcon from '@atlaskit/icon/core/person';
import StarStarredIcon from '@atlaskit/icon/core/star-starred';
import StarUnstarredIcon from '@atlaskit/icon/core/star-unstarred';
import { token } from '@atlaskit/tokens';
import Tooltip from '@atlaskit/tooltip';

import Link from '../../services/routing/Link';
import { ReportTypeIcon } from '../ReportTypeIcon';
import { HighlightedText } from './HighlightedText';
import { REPORT_TABLE_GRID } from './ReportTableHeader';
import { formatRelativeTime } from '../../../utils/date/format-relative-time';

export interface ReportTableRowProps {
  described: DescribedReport;
  /** The owner's account id. Absent for a report with no recorded owner. */
  ownerId?: string;
  /** The owner is the current user — shown as "You". */
  isMine?: boolean;
  /** ISO timestamp of the last edit (`lastUpdatedAt`). Absent for reports saved before it was kept. */
  updatedAt?: string;
  /** "Now", for the relative time. Injectable for tests and stories; defaults to the real clock. */
  now?: Date;
  isStarred: boolean;
  onToggleStar: () => void;
  href: string;
  /** Renders the delete button. The page decides who may delete what. */
  onDelete?: () => void;
  /** Tighter rows, for the home page's recents card. */
  compact?: boolean;
  /** The report's JQL as a second line under the name. */
  showJql?: boolean;
  /** Active search query — highlighted in the name and JQL. */
  query?: string;
  /** Keyboard-nav highlight. Mouse hover is handled in CSS. */
  isActive?: boolean;
  onMouseEnter?: () => void;
}

/** `IconButton` takes a component, not an element, so the yellow fill needs its own component. */
const FilledStarIcon: FC<{ label: string }> = (props) => (
  <StarStarredIcon {...props} color={token('color.icon.accent.yellow', '#E2B203')} />
);

/**
 * "You", "Someone else" or "—" — the owner column's text. Ids only: putting a name on someone else's
 * report needs `read:jira-user`, which is spec/041 phase 2.
 */
export const ownerLabel = (ownerId: string | undefined, isMine: boolean): string => {
  if (isMine) {
    return 'You';
  }

  return ownerId ? 'Someone else' : '—';
};

const OwnerCell: FC<{ ownerId?: string; isMine: boolean }> = ({ ownerId, isMine }) => (
  <span className={`flex min-w-0 items-center gap-2 text-sm ${isMine ? 'text-neutral-801' : 'text-neutral-300'}`}>
    {isMine && (
      <span className="flex flex-none">
        <PersonIcon label="" />
      </span>
    )}
    <span className="truncate">{ownerLabel(ownerId, isMine)}</span>
  </span>
);

/** "3 days ago", with the full local date and time on hover; "—" when there's no timestamp. */
const UpdatedCell: FC<{ updatedAt?: string; now?: Date }> = ({ updatedAt, now }) => {
  const relative = updatedAt ? formatRelativeTime(updatedAt, now) : null;

  if (!updatedAt || !relative) {
    return <span className="text-sm text-neutral-300">—</span>;
  }

  return (
    <Tooltip content={new Date(updatedAt).toLocaleString()}>
      <time dateTime={updatedAt} className="block truncate text-sm text-neutral-801">
        {relative}
      </time>
    </Tooltip>
  );
};

/**
 * One saved report in the saved-reports table: star, type icon + name (+ JQL), owner, last updated, type badge,
 * and a delete button that shows on hover. See spec/041-saved-reports-redesign/phase1.md § 6.
 *
 * Only the name is the link. The star and delete buttons are its siblings, never its children, so
 * no interactive element is nested in another and clicking them never opens the report.
 *
 * Not used by the Add Report modal, which picks reports with `ReportRow` instead.
 */
export const ReportTableRow: FC<ReportTableRowProps> = ({
  described,
  ownerId,
  isMine = false,
  updatedAt,
  now,
  isStarred,
  onToggleStar,
  href,
  onDelete,
  compact = false,
  showJql = true,
  query = '',
  isActive = false,
  onMouseEnter,
}) => {
  const { report, jql, tone, typeName } = described;

  return (
    <div
      role="row"
      className={`group ${REPORT_TABLE_GRID} items-center border-b border-neutral-41 last:border-b-0 hover:bg-neutral-20 ${
        compact ? 'py-1.5' : 'py-2.5'
      } ${isActive ? 'bg-neutral-20' : ''}`}
      onMouseEnter={onMouseEnter}
    >
      <span role="cell">
        <IconButton
          appearance="subtle"
          spacing="compact"
          icon={isStarred ? FilledStarIcon : StarUnstarredIcon}
          label={`${isStarred ? 'Unstar' : 'Star'} ${report.name}`}
          onClick={onToggleStar}
        />
      </span>
      <span role="cell" className="flex min-w-0 items-center gap-3">
        <ReportTypeIcon tone={tone} size={compact ? 24 : 32} />
        <span className="min-w-0 flex-1">
          <Link
            href={href}
            aria-label={report.name}
            className="block truncate font-medium text-neutral-800 no-underline hover:underline"
          >
            <HighlightedText text={report.name} query={query} />
          </Link>
          {showJql && jql && (
            <span className="block truncate text-xs text-neutral-300">
              <HighlightedText text={jql} query={query} />
            </span>
          )}
        </span>
      </span>
      <span role="cell" className="min-w-0">
        <OwnerCell ownerId={ownerId} isMine={isMine} />
      </span>
      <span role="cell" className="min-w-0">
        <UpdatedCell updatedAt={updatedAt} now={now} />
      </span>
      <span role="cell" className="min-w-0">
        {typeName && (
          <span className="inline-block max-w-full truncate whitespace-nowrap rounded-full bg-neutral-20 px-2 py-0.5 text-xs font-semibold text-neutral-801 group-hover:bg-white">
            {typeName}
          </span>
        )}
      </span>
      <span role="cell" className="opacity-0 focus-within:opacity-100 group-hover:opacity-100">
        {onDelete && (
          <IconButton
            appearance="subtle"
            spacing="compact"
            icon={DeleteIcon}
            label={`Delete ${report.name}`}
            onClick={onDelete}
          />
        )}
      </span>
    </div>
  );
};

export default ReportTableRow;
