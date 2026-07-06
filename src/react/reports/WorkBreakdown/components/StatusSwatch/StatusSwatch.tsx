import React from 'react';
import type { CellState } from '../../types';
import { getStatusColorClass, getStatusLabel } from '../../helpers';

const SIZE_CLASS = {
  sm: 'w-3 h-3 text-[8px]',
  md: 'w-4 h-4 text-[11px]',
  lg: 'w-[18px] h-[18px] text-[13px]',
} as const;

export type SwatchSize = keyof typeof SIZE_CLASS;

export interface StatusSwatchProps {
  /** The cell state: `'na'`, `'nodate'`, or a rollup status. */
  state: CellState;
  /** Swatch size — bodies pick this from the density tier. Defaults to `md`. */
  size?: SwatchSize;
  /** Tooltip override. Defaults to a human label describing the state. */
  title?: string;
}

/**
 * A rounded status square — the report's atomic status indicator. Three visual states mirror the
 * Gantt: a colored swatch (work with dates), a tan `∅` swatch (work exists but has no dates), and
 * a blank outline (no work of this type).
 */
export const StatusSwatch: React.FC<StatusSwatchProps> = ({ state, size = 'md', title }) => {
  const sizeClass = SIZE_CLASS[size];

  if (state === 'na') {
    return (
      <span
        className={`inline-block shrink-0 rounded jirasm border border-neutral-20 ${sizeClass}`}
        title={title ?? 'No work of this type'}
        aria-label="No work of this type"
      />
    );
  }

  if (state === 'nodate') {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded jirasm color-text-and-bg-unknown leading-none ${sizeClass}`}
        title={title ?? 'Work exists, no dates'}
        aria-label="Work exists, no dates"
      >
        ∅
      </span>
    );
  }

  return (
    <span
      className={`inline-block shrink-0 rounded jirasm ${getStatusColorClass(state)} ${sizeClass}`}
      title={title ?? getStatusLabel(state)}
      aria-label={getStatusLabel(state)}
    />
  );
};
