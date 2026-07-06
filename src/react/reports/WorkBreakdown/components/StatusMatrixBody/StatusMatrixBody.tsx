import React from 'react';
import type { Card, CellState, IssueClickHandler, WorkType } from '../../types';
import { getStatusLabel } from '../../helpers';
import { StatusSwatch } from '../StatusSwatch';
import type { SwatchSize } from '../StatusSwatch';
import { WorkTypeHeader } from '../WorkTypeHeader';

export interface StatusMatrixBodyProps {
  /** The card whose matrix rows to render. */
  card: Card;
  /** Swatch size derived from density. Defaults to `md`. */
  size?: SwatchSize;
  /** Font-size class for the matrix (from `fontSizeClass`). */
  fontSize?: string;
  /** Click handler for a child row (opens the issue tooltip). */
  onIssueClick?: IssueClickHandler;
}

const cellTooltip = (type: WorkType, cell: CellState): string => {
  if (cell === 'na') return `${type}: no ${type} work`;
  if (cell === 'nodate') return `${type}: work exists, no dates`;
  return `${type}: ${getStatusLabel(cell)}`;
};

/**
 * Breakdown-mode card insides: a CSS-grid matrix whose rows are child issues and columns are the
 * present work types. The header carries each work type's letter chip + rollup date; each body row
 * is the child's name followed by a status swatch per work type.
 */
export const StatusMatrixBody: React.FC<StatusMatrixBodyProps> = ({
  card,
  size = 'md',
  fontSize = '',
  onIssueClick,
}) => {
  const gridTemplateColumns = `minmax(0, 1fr) repeat(${card.headerColumns.length}, auto)`;

  return (
    <div className={`grid items-stretch ${fontSize}`} style={{ gridTemplateColumns }}>
      {/* Header row: empty name-column cell + one header cell per work type. */}
      <div className="border-b border-neutral-40" />
      <WorkTypeHeader columns={card.headerColumns} size={size} />

      {/* Body rows. */}
      {card.matrixRows.map((row) => (
        <React.Fragment key={row.key}>
          <div
            className="min-w-0 truncate px-2.5 py-1 leading-6 cursor-pointer border-b border-neutral-20 text-neutral-800 font-sans"
            title={row.name}
            onClick={(event) => onIssueClick?.(event, row.issue)}
          >
            {row.name}
          </div>
          {row.cells.map((cell, i) => (
            <div
              key={card.headerColumns[i].type}
              className="flex items-center justify-center px-1.5 py-1 border-b border-neutral-20"
            >
              <StatusSwatch state={cell} size={size} title={cellTooltip(card.headerColumns[i].type, cell)} />
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};
