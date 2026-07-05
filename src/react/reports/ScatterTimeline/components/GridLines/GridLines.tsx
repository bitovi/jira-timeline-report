import React from 'react';

export interface GridLinesProps {
  /** Number of month columns to draw vertical lines for. */
  monthCount: number;
  /** Number of issue rows the lines span. */
  rowCount: number;
}

/**
 * Vertical month grid lines behind the issue rows.
 *
 * Each month renders a bordered grid child spanning all issue rows (from row 3). The last
 * column also gets a right border to close the grid.
 */
export const GridLines: React.FC<GridLinesProps> = ({ monthCount, rowCount }) => (
  <>
    {Array.from({ length: monthCount }, (_, index) => (
      <div
        key={`grid-${index}`}
        style={{
          gridColumn: `${index + 1} / span 1`,
          gridRow: `3 / span ${rowCount}`,
          zIndex: 10,
        }}
        className={`border-l border-b border-neutral-80 ${index === monthCount - 1 ? 'border-r' : ''}`}
        data-testid="grid-line"
      />
    ))}
  </>
);
