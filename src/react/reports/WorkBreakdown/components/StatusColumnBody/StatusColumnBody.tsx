import React from 'react';
import type { Card, IssueClickHandler } from '../../types';
import { StatusSwatch } from '../StatusSwatch';
import type { SwatchSize } from '../StatusSwatch';

export interface StatusColumnBodyProps {
  /** The card whose status rows to render. */
  card: Card;
  /** Swatch size derived from density. Defaults to `md`. */
  size?: SwatchSize;
  /** Font-size class for the child rows (from `fontSizeClass`). */
  fontSize?: string;
  /** Click handler for a child row (opens the issue tooltip). */
  onIssueClick?: IssueClickHandler;
}

/**
 * Status-mode card insides: one row per child — a single rollup-status swatch to the left of the
 * child's name. The "Target Delivery" line is rendered by the parent `WorkBreakdownCard` (above
 * the status summary, when present), not here.
 */
export const StatusColumnBody: React.FC<StatusColumnBodyProps> = ({
  card,
  size = 'md',
  fontSize = '',
  onIssueClick,
}) => (
  <ul className="list-none m-0 p-1">
    {card.statusRows.map((row) => (
      <li
        key={row.key}
        className={`flex items-center gap-2 px-2.5 py-1 min-w-0 cursor-pointer font-sans ${fontSize}`}
        title={row.name}
        onClick={(event) => onIssueClick?.(event, row.issue)}
      >
        <StatusSwatch state={row.status} size={size} />
        <span className="truncate text-neutral-800">{row.name}</span>
      </li>
    ))}
  </ul>
);
