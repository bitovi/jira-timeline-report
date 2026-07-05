import React from 'react';

export interface TodayLineProps {
  /** Left margin as a percentage (0–100); may be < 0 or > 100 when today is outside the range. */
  marginLeftPercent: number;
  /** Number of month columns the line spans. */
  monthCount: number;
  /** Number of issue rows below the headers. */
  rowCount: number;
  /** Number of columns to skip before the month columns start (e.g. a grouping label gutter). */
  columnOffset?: number;
}

/**
 * The vertical "today" indicator line.
 *
 * Rendered as a grid child spanning all month columns and every row below the quarter
 * header. The inner line is offset by `marginLeftPercent`; when today falls outside the
 * timeline the offset naturally pushes the line off-grid (clamped by `overflow-x` on the
 * report container).
 */
export const TodayLine: React.FC<TodayLineProps> = ({ marginLeftPercent, monthCount, rowCount, columnOffset = 0 }) => (
  <div
    style={{
      gridColumn: `${columnOffset + 1} / span ${monthCount}`,
      gridRow: `2 / span ${rowCount + 1}`,
    }}
  >
    <div
      className="today"
      style={{
        marginLeft: `${marginLeftPercent}%`,
        width: '1px',
        backgroundColor: 'orange',
        zIndex: 0,
        position: 'relative',
        height: '100%',
      }}
      data-testid="today-line"
    />
  </div>
);
