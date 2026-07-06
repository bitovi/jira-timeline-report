import React from 'react';
import type { IssueClickHandler, PlanningRow } from '../../types';

export interface PlanningCardProps {
  /** Planning-issue rows. Renders nothing when empty. */
  planning: PlanningRow[];
  /** Font-size class for the list items (from `fontSizeClass`). */
  fontSize?: string;
  /** Click handler for a planning row (opens the issue tooltip). */
  onIssueClick?: IssueClickHandler;
}

/**
 * The "Planning" fallback card — lists issues that aren't yet scheduled under any primary card,
 * with the neutral `unknown` header treatment (ports the legacy planning block).
 */
export const PlanningCard: React.FC<PlanningCardProps> = ({ planning, fontSize = '', onIssueClick }) => {
  if (!planning.length) return null;

  return (
    <div className="grow rounded border border-neutral-40 overflow-hidden bg-white">
      <div className="color-text-and-bg-unknown rounded-t px-2.5 py-1.5 font-semibold">Planning</div>
      <ul className="list-disc list-inside p-1">
        {planning.map((row) => (
          <li
            key={row.key}
            className={`font-sans color-text-unknown cursor-pointer ${fontSize}`}
            onClick={(event) => onIssueClick?.(event, row.issue)}
          >
            {row.name}
          </li>
        ))}
      </ul>
    </div>
  );
};
