import type { Range, IssueOrRelease } from '../types';

/** Detect if two 1D ranges overlap. Touching boundaries do NOT count as overlap. */
export const intersect = (range1: Range, range2: Range): boolean =>
  range1.start < range2.end && range2.start < range1.end;

interface Packable {
  leftPercentStart: number;
  rightPercentEnd: number;
}

/**
 * Assign issues to non-overlapping rows using a greedy first-fit algorithm.
 *
 * Issues are assumed pre-sorted by `leftPercentStart` ascending (see
 * {@link sortIssuesByLeftPosition}). Each issue is placed in the first row where it does
 * not overlap any existing item; otherwise a new row is created.
 */
export const packIssuesIntoRows = <T extends Packable>(issues: T[]): Array<{ items: T[] }> => {
  const rows: Array<{ items: T[] }> = [];

  for (const issue of issues) {
    const fittingRow = rows.find(
      (row) =>
        !row.items.some(
          (item) => item.leftPercentStart < issue.rightPercentEnd && issue.leftPercentStart < item.rightPercentEnd,
        ),
    );

    if (fittingRow) {
      fittingRow.items.push(issue);
    } else {
      rows.push({ items: [issue] });
    }
  }

  return rows;
};

/** Sort issues left-to-right by `leftPercentStart` for optimal row packing. Non-mutating. */
export const sortIssuesByLeftPosition = <T extends { leftPercentStart: number }>(issues: T[]): T[] =>
  [...issues].sort((a, b) => a.leftPercentStart - b.leftPercentStart);

/** Which side of the date-anchored marker a label flows toward. */
export type LabelSide = 'left' | 'right';

/** Minimal shape needed to place a label on either side of its due-date marker. */
interface SidePackable {
  /** Percentage position of the marker (due date) from the left edge. */
  rightPercentEnd: number;
  /** Label width as a percentage of the plot area. */
  widthInPercent: number;
}

/** Horizontal bounds (percent) labels must stay within so they don't clip the grid edges. */
export interface SidePackBounds {
  min: number;
  max: number;
}

const DEFAULT_BOUNDS: SidePackBounds = { min: 0, max: 100 };

/** The horizontal span a label occupies for a given orientation (marker stays on the date). */
const spanForSide = (item: SidePackable, side: LabelSide): Range =>
  side === 'left'
    ? { start: item.rightPercentEnd - item.widthInPercent, end: item.rightPercentEnd }
    : { start: item.rightPercentEnd, end: item.rightPercentEnd + item.widthInPercent };

const spanFitsWithinBounds = (span: Range, bounds: SidePackBounds): boolean =>
  span.start >= bounds.min && span.end <= bounds.max;

/**
 * Pack issues into non-overlapping rows while choosing each label's side (left/right of its
 * date-anchored marker) to minimize the number of rows and reclaim edge space.
 *
 * The marker always stays on the due date — only the label flows left or right. Compared to
 * {@link packIssuesIntoRows} (which flows every label left on a fixed span), letting the
 * packer flip labels lets two items that would collide share a row when one flows the other
 * way, reducing height.
 *
 * Strategy: sweep markers left-to-right. Row minimization is primary (first-fit across rows);
 * an inward bias — labels near the left edge prefer flowing right, near the right edge prefer
 * flowing left — is the tiebreaker, which also pulls edge labels away from empty margins.
 * Orientations that would clip a grid edge (`bounds`) are skipped; if neither side fits the
 * bounds (label wider than the whole plot) the inward-preferred side is used anyway.
 *
 * Co-located markers (issues that round to the same position) are forced onto separate rows —
 * their dots would otherwise stack on the exact same point while their labels flow to opposite
 * sides, making one shared point read as two separate items in adjacent columns.
 */
export const packIssuesIntoRowsWithSides = <T extends SidePackable>(
  issues: T[],
  bounds: SidePackBounds = DEFAULT_BOUNDS,
): Array<{ items: Array<T & { labelSide: LabelSide }> }> => {
  const midpoint = (bounds.min + bounds.max) / 2;
  const sorted = [...issues].sort((a, b) => a.rightPercentEnd - b.rightPercentEnd);

  interface PlacedRow {
    items: Array<T & { labelSide: LabelSide }>;
    spans: Range[];
    markers: number[];
  }
  const rows: PlacedRow[] = [];

  for (const issue of sorted) {
    // Inward bias: a marker left of center prefers flowing its label right (and vice versa).
    const preferred: LabelSide = issue.rightPercentEnd < midpoint ? 'right' : 'left';
    const other: LabelSide = preferred === 'left' ? 'right' : 'left';

    const inBoundsOrder = [preferred, other].filter((side) => spanFitsWithinBounds(spanForSide(issue, side), bounds));
    // Degenerate case (label wider than the whole plot): keep the preferred side so it renders.
    const candidateOrder: LabelSide[] = inBoundsOrder.length > 0 ? inBoundsOrder : [preferred];

    let placed = false;
    for (const row of rows) {
      // A row already holding a marker at this exact position can't share it — the dots would
      // overlap. Force this issue to stack onto a later/new row instead.
      if (row.markers.some((marker) => marker === issue.rightPercentEnd)) {
        continue;
      }
      const side = candidateOrder.find((candidate) => {
        const span = spanForSide(issue, candidate);
        return !row.spans.some((existing) => existing.start < span.end && span.start < existing.end);
      });
      if (side) {
        row.items.push({ ...issue, labelSide: side });
        row.spans.push(spanForSide(issue, side));
        row.markers.push(issue.rightPercentEnd);
        placed = true;
        break;
      }
    }

    if (!placed) {
      const side = candidateOrder[0];
      rows.push({
        items: [{ ...issue, labelSide: side }],
        spans: [spanForSide(issue, side)],
        markers: [issue.rightPercentEnd],
      });
    }
  }

  return rows.map((row) => ({ items: row.items }));
};

/** True when an issue has a positioning due date (`rollupStatuses.rollup.due`). */
const hasDueDate = (issue: IssueOrRelease): boolean => issue.rollupStatuses?.rollup?.due != null;

/**
 * Split issues into those with a positioning due date and those without.
 *
 * Undated issues are never plotted (no Invalid-Date markers); callers surface them
 * separately (e.g. the Scatter Plot's "N without dates" key/modal).
 */
export const partitionIssuesByDate = (
  issues: IssueOrRelease[],
): { dated: IssueOrRelease[]; undated: IssueOrRelease[] } => {
  const dated: IssueOrRelease[] = [];
  const undated: IssueOrRelease[] = [];
  for (const issue of issues) {
    (hasDueDate(issue) ? dated : undated).push(issue);
  }
  return { dated, undated };
};

/**
 * Remove issues that lack a positioning due date.
 *
 * Filters on `rollupStatuses.rollup.due` — the same field used for positioning — so every
 * plotted issue is guaranteed to have a non-null date (no Invalid-Date markers).
 */
export const filterIssuesWithDates = (issues: IssueOrRelease[]): IssueOrRelease[] => issues.filter(hasDueDate);
