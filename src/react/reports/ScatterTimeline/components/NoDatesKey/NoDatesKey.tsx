import React, { useState } from 'react';
import Button from '@atlaskit/button/new';
import type { IssueOrRelease } from '../../types';
import { NoDatesModal } from './NoDatesModal';

export interface NoDatesKeyProps {
  /** Issues without a rollup due date. Renders nothing when empty. */
  issues: IssueOrRelease[];
}

/**
 * Scatter Plot footer key — "⊘ N without dates" — surfacing issues the grid can't place.
 *
 * Renders `null` when there are no undated issues. Clicking the button opens
 * {@link NoDatesModal} listing them.
 */
export const NoDatesKey: React.FC<NoDatesKeyProps> = ({ issues }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (issues.length === 0) {
    return null;
  }

  return (
    <>
      <Button appearance="subtle" onClick={() => setIsOpen(true)}>
        <span className="inline-flex items-center gap-2">
          <span className="color-text-and-bg-unknown w-4 h-4 shrink-0 rounded-full inline-flex items-center justify-center">
            <img className="w-3 h-3" src="/images/empty-set.svg" alt="" />
          </span>
          {issues.length} without dates
        </span>
      </Button>
      <NoDatesModal issues={issues} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
