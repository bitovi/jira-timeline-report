import type { FC, ReactNode } from 'react';
import type { DescribedReport } from './describe-report';

import React from 'react';

import Link from '../../services/routing/Link';
import { ReportTypeIcon } from '../ReportTypeIcon';
import { HighlightedText } from './HighlightedText';

interface ReportRowBaseProps {
  described: DescribedReport;
  /** Active search query — occurrences in the report name are highlighted. */
  query?: string;
  /** Keyboard-nav highlight. Mouse hover is handled in CSS. */
  isActive?: boolean;
  /**
   * Rendered at the row's right edge, *outside* the link/button — so interactive controls
   * (e.g. a manage menu) aren't nested inside another interactive element.
   */
  trailing?: ReactNode;
  onMouseEnter?: () => void;
}

/**
 * A row is either a picker (`onSelect` → renders a `<button>`) or a destination
 * (`href` → renders a routing `<Link>`). Never both.
 */
export type ReportRowProps = ReportRowBaseProps &
  ({ href: string; onSelect?: never } | { onSelect: () => void; href?: never });

/**
 * One saved report, presented identically everywhere it's listed: type icon, name (with search
 * highlighting), the report's JQL as a secondary line, and a type badge. Used by the Add Report
 * modal (as a button) and the Saved Reports page (as a link). See spec/023-report-modal.
 *
 * The interactive element's accessible name is always just `report.name` — the badge and JQL are
 * scannable context, not part of what you're choosing.
 */
export const ReportRow: FC<ReportRowProps> = ({
  described,
  query = '',
  isActive = false,
  trailing,
  onMouseEnter,
  href,
  onSelect,
}) => {
  const content = (
    <>
      <ReportTypeIcon tone={described.tone} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-neutral-800">
          <HighlightedText text={described.report.name} query={query} />
        </span>
        {described.jql && <span className="block truncate text-xs text-neutral-300">{described.jql}</span>}
      </span>
      {described.typeName && (
        <span className="flex-none whitespace-nowrap rounded-full bg-neutral-20 px-2 py-0.5 text-xs font-semibold text-neutral-801">
          {described.typeName}
        </span>
      )}
    </>
  );

  const interactiveClassName = 'flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left no-underline';

  return (
    <div
      className={`flex items-center rounded-md hover:bg-blue-101 ${isActive ? 'bg-blue-101' : ''}`}
      onMouseEnter={onMouseEnter}
    >
      {href ? (
        <Link href={href} aria-label={described.report.name} className={`${interactiveClassName} text-inherit`}>
          {content}
        </Link>
      ) : (
        <button type="button" aria-label={described.report.name} onClick={onSelect} className={interactiveClassName}>
          {content}
        </button>
      )}
      {trailing && <div className="flex-none pl-2 pr-1">{trailing}</div>}
    </div>
  );
};

export default ReportRow;
