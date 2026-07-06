import React from 'react';
import type { WorkTypeColumn } from '../../types';
import { formatDate, getStatusColorClass, getStatusLabel } from '../../helpers';
import type { SwatchSize } from '../StatusSwatch';

const LETTER_SIZE: Record<SwatchSize, string> = {
  sm: 'w-3 h-3 text-[8px]',
  md: 'w-4 h-4 text-[10px]',
  lg: 'w-[18px] h-[18px] text-[11px]',
};

export interface WorkTypeHeaderProps {
  /** The per-card work-type columns, in board order. */
  columns: WorkTypeColumn[];
  /** Size tier derived from density. Defaults to `md`. */
  size?: SwatchSize;
}

const slipClass = (kind: WorkTypeColumn['slip']['kind']): string =>
  kind === 'improved' ? 'color-text-ahead' : 'color-text-blocked';

/**
 * The matrix header cells: a colored work-type letter chip (d/D/Q/U) above its rollup date, with a
 * slip/ahead prior date below. Renders one grid cell per column (the caller supplies the grid).
 */
export const WorkTypeHeader: React.FC<WorkTypeHeaderProps> = ({ columns, size = 'md' }) => (
  <>
    {columns.map((column) => {
      const dueLabel = formatDate(column.due);
      const tip =
        `${column.type}: ${getStatusLabel(column.status)}` +
        (dueLabel ? ` · due ${dueLabel}` : '') +
        (column.slip.label ? ` (was ${column.slip.label})` : '');

      return (
        <div
          key={column.type}
          className="flex flex-col items-center gap-0.5 px-1 py-1.5 border-b border-neutral-40"
          title={tip}
        >
          <span
            className={`inline-flex items-center justify-center rounded jirasm font-mono font-bold ${getStatusColorClass(
              column.status,
            )} ${LETTER_SIZE[size]}`}
          >
            {column.symbol}
          </span>
          <span className="text-[8px] font-medium text-neutral-300 nowrap">{dueLabel || '—'}</span>
          {column.slip.label ? (
            <span className={`text-[8px] font-medium nowrap ${slipClass(column.slip.kind)}`}>{column.slip.label}</span>
          ) : null}
        </div>
      );
    })}
  </>
);
