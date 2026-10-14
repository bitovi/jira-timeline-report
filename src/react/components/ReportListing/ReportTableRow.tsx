import type { FC } from 'react';
import type { DescribedReport } from './describe-report';

import React from 'react';
import { IconButton } from '@atlaskit/button/new';
import DeleteIcon from '@atlaskit/icon/core/delete';
import StarStarredIcon from '@atlaskit/icon/core/star-starred';
import StarUnstarredIcon from '@atlaskit/icon/core/star-unstarred';
import { token } from '@atlaskit/tokens';

import Link from '../../services/routing/Link';
import { ReportTypeIcon } from '../ReportTypeIcon';
import { HighlightedText } from './HighlightedText';
import { REPORT_TABLE_GRID } from './ReportTableHeader';

/** Who owns a report, as far as the page knows. Names are looked up at render time, never stored. */
export interface ReportOwner {
  accountId: string;
  displayName?: string;
  avatarUrl?: string;
  /** `false` for a deactivated or deleted account. */
  active?: boolean;
}

export interface ReportTableRowProps {
  described: DescribedReport;
  /** Absent for a report with no recorded owner. */
  owner?: ReportOwner;
  /** The owner is the current user — shown as "You". */
  isMine?: boolean;
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

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

/** "You", the owner's name, "Former user" or "Unknown" — the owner column's text. */
export const ownerLabel = (owner: ReportOwner | undefined, isMine: boolean): string => {
  if (isMine) {
    return 'You';
  }

  if (owner?.active === false) {
    return 'Former user';
  }

  return owner?.displayName || 'Unknown';
};

const OwnerCell: FC<{ owner?: ReportOwner; isMine: boolean }> = ({ owner, isMine }) => {
  const label = ownerLabel(owner, isMine);
  const known = !!owner?.displayName && owner.active !== false;

  return (
    <span className="flex min-w-0 items-center gap-2 text-sm text-neutral-801">
      {owner?.avatarUrl ? (
        <img src={owner.avatarUrl} alt="" className="h-6 w-6 flex-none rounded-full" />
      ) : (
        <span
          aria-hidden
          className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-semibold ${
            known ? 'bg-blue-101 text-neutral-800' : 'bg-neutral-20 text-neutral-300'
          }`}
        >
          {known ? initials(owner!.displayName!) : '?'}
        </span>
      )}
      <span className={`truncate ${label === 'Unknown' || label === 'Former user' ? 'text-neutral-300' : ''}`}>
        {label}
      </span>
    </span>
  );
};

/**
 * One saved report in the saved-reports table: star, type icon + name (+ JQL), owner, type badge,
 * and a delete button that shows on hover. See spec/041-saved-reports-redesign § 6.
 *
 * Only the name is the link. The star and delete buttons are its siblings, never its children, so
 * no interactive element is nested in another and clicking them never opens the report.
 *
 * Not used by the Add Report modal, which picks reports with `ReportRow` instead.
 */
export const ReportTableRow: FC<ReportTableRowProps> = ({
  described,
  owner,
  isMine = false,
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
        <OwnerCell owner={owner} isMine={isMine} />
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
