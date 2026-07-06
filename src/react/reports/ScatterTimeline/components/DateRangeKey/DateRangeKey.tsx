import React, { useState } from 'react';
import Button from '@atlaskit/button/new';
import type { IssueOrRelease } from '../../types';
import { DateRangeModal } from './DateRangeModal';

export interface DateRangeKeyProps {
  /** Dated issues excluded by the active due-date range filter. */
  issues: IssueOrRelease[];
  /**
   * Whether a due-date range filter is currently active (at least one of From/To is set).
   * Renders `null` when `false`, regardless of `issues.length` — per spec, the key should
   * show a "0 outside date range" count while a range is active, not hide based on the count.
   */
  hasDateRange: boolean;
}

/**
 * Scatter Plot footer key — "N outside date range" — surfacing dated issues the active
 * due-date range filter excluded.
 *
 * Renders `null` when no range is active. Clicking the button opens {@link DateRangeModal}
 * listing the excluded issues.
 */
export const DateRangeKey: React.FC<DateRangeKeyProps> = ({ issues, hasDateRange }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!hasDateRange) {
    return null;
  }

  return (
    <>
      <Button appearance="subtle" onClick={() => setIsOpen(true)}>
        <span className="inline-flex items-center gap-2">
          <span className="color-text-and-bg-unknown w-4 h-4 shrink-0 rounded-full inline-flex items-center justify-center" />
          {issues.length} outside date range
        </span>
      </Button>
      <DateRangeModal issues={issues} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
