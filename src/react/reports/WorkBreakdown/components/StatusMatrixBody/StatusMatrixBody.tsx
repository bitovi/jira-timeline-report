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

/** Row padding/line-height per size tier — mirrors the tight/normal/big density variants. */
const NAME_CELL_CLASS: Record<SwatchSize, string> = {
  sm: 'pl-2 pr-1.5 py-px leading-[22px]',
  md: 'pl-2.5 pr-2 py-0.5 leading-[26px]',
  lg: 'pl-2.5 pr-2 py-1 leading-[30px]',
};
const SWATCH_CELL_CLASS: Record<SwatchSize, string> = {
  sm: 'px-1 py-px',
  md: 'px-[5px] py-0.5',
  lg: 'px-1.5 py-1',
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
            className={`min-w-0 truncate cursor-pointer text-neutral-800 font-sans ${NAME_CELL_CLASS[size]}`}
            title={row.name}
            onClick={(event) => onIssueClick?.(event, row.issue)}
          >
            {row.name}
          </div>
          {row.cells.map((cell, i) => (
            <div
              key={card.headerColumns[i].type}
              className={`flex items-center justify-center ${SWATCH_CELL_CLASS[size]}`}
            >
              <StatusSwatch state={cell} size={size} title={cellTooltip(card.headerColumns[i].type, cell)} />
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};
