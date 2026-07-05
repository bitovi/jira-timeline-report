import type { PlacedIssue } from '../types';

/** A group's packed rows of placed issues (label sides already chosen). */
interface PackedBand {
  rows: Array<{ items: PlacedIssue[] }>;
}

/** The horizontal span a placed issue occupies, including its chosen-side label. */
const occupiedSpan = (item: PlacedIssue): { start: number; end: number } =>
  item.labelSide === 'left'
    ? { start: item.rightPercentEnd - item.widthInPercent, end: item.rightPercentEnd }
    : { start: item.rightPercentEnd, end: item.rightPercentEnd + item.widthInPercent };

/**
 * Compute the date span actually occupied by plotted content (markers + chosen-side labels)
 * across every band, mapping percentages back to dates via the current range.
 *
 * Feeding this span back into `computeQuartersAndMonths` snaps it out to whole quarters,
 * dropping leading/trailing quarters that hold no content (e.g. a mostly-empty first quarter
 * that only existed because of the range's padding). Returns `null` when there is no content,
 * so callers keep their original range.
 */
export const computeOccupiedDateExtent = (
  bands: PackedBand[],
  firstDay: Date,
  lastDay: Date,
): { start: Date; end: Date } | null => {
  const totalTime = lastDay.getTime() - firstDay.getTime();

  let minPercent = Infinity;
  let maxPercent = -Infinity;

  for (const band of bands) {
    for (const row of band.rows) {
      for (const item of row.items) {
        const span = occupiedSpan(item);
        minPercent = Math.min(minPercent, span.start, item.rightPercentEnd);
        maxPercent = Math.max(maxPercent, span.end, item.rightPercentEnd);
      }
    }
  }

  if (!Number.isFinite(minPercent) || !Number.isFinite(maxPercent)) return null;

  return {
    start: new Date(firstDay.getTime() + (minPercent / 100) * totalTime),
    end: new Date(firstDay.getTime() + (maxPercent / 100) * totalTime),
  };
};
