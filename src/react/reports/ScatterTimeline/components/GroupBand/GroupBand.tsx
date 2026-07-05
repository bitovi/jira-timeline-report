import React from 'react';
import type { PlottedIssue } from '../../types';
import { IssueMarker } from '../IssueMarker';

export interface GroupBandRow {
  items: PlottedIssue[];
}

export interface GroupBandProps {
  /** Group label shown in the left gutter; `null` renders no gutter cell (ungrouped). */
  title: string | null;
  /** This band's packed rows (independent of other bands). */
  rows: GroupBandRow[];
  /** Number of month columns to span (shared x-axis across all bands). */
  monthCount: number;
  /** 0-based offset of this band's first row among all issue rows (row 3 + rowOffset). */
  rowOffset: number;
  /** Whether a gutter column exists at column 1 (true whenever grouping is active). */
  showGutter: boolean;
  /** 0-based band position, used for the alternating background stripe. */
  bandIndex: number;
  isLotsOfIssues: boolean;
}

/**
 * One labeled band of the scatter timeline's grouped layout.
 *
 * Renders an optional left-gutter label (spanning all of the band's rows) followed by the
 * band's packed issue rows, sharing the same month-column x-axis as every other band. An
 * alternating background stripe (odd `bandIndex`) helps visually separate bands.
 */
export const GroupBand: React.FC<GroupBandProps> = ({
  title,
  rows,
  monthCount,
  rowOffset,
  showGutter,
  bandIndex,
  isLotsOfIssues,
}) => {
  const rowStart = rowOffset + 3;
  const rowSpan = Math.max(rows.length, 1);

  return (
    <>
      {bandIndex % 2 === 1 && (
        <div
          style={{
            gridColumn: `${showGutter ? 2 : 1} / span ${monthCount}`,
            gridRow: `${rowStart} / span ${rowSpan}`,
            zIndex: 0,
          }}
          className="bg-neutral-20"
          data-testid="group-band-background"
        />
      )}

      {showGutter && (
        <div
          style={{
            gridColumn: '1 / span 1',
            gridRow: `${rowStart} / span ${rowSpan}`,
            zIndex: 5,
          }}
          className="flex items-center justify-end px-2 text-right font-semibold text-sm truncate"
          title={title ?? undefined}
          data-testid="group-band-title"
        >
          {title}
        </div>
      )}

      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          style={{
            gridColumn: `${showGutter ? 2 : 1} / span ${monthCount}`,
            gridRow: `${rowStart + rowIdx} / span 1`,
          }}
          className={`relative ${isLotsOfIssues ? 'h-7' : 'h-10'}`}
        >
          {row.items.map((item) => (
            <IssueMarker key={item.key} item={item} labelSide={item.overflowsLeft ? 'right' : 'left'} />
          ))}
        </div>
      ))}
    </>
  );
};
