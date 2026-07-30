import type { FC } from 'react';

import React from 'react';
import ChevronDownIcon from '@atlaskit/icon/glyph/chevron-down';
import ChevronRightIcon from '@atlaskit/icon/glyph/chevron-right';

export interface CollapseToggleProps {
  isCollapsed: boolean;
  /**
   * Names the section in the accessible label — "Collapse Q3" rather than a page of buttons all
   * reading "Collapse", the same individuation `NodeControls` does.
   */
  label: string;
  onToggle: () => void;
}

/**
 * A section's caret. Down when expanded, right when collapsed; `aria-expanded` says the same thing to
 * a screen reader, which is what makes this a disclosure rather than a mystery arrow.
 *
 * Only sections have one — reports and values render no caret and reserve no space for it.
 * See spec/016-report-of-reports/004-redesign §3.
 */
export const CollapseToggle: FC<CollapseToggleProps> = ({ isCollapsed, label, onToggle }) => (
  <button
    type="button"
    aria-expanded={!isCollapsed}
    aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${label}`}
    onClick={onToggle}
    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-801 transition-colors duration-150 hover:bg-neutral-201 print-hidden"
  >
    {isCollapsed ? <ChevronRightIcon label="" size="small" /> : <ChevronDownIcon label="" size="small" />}
  </button>
);

export default CollapseToggle;
