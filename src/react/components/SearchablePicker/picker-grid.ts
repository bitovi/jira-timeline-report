/**
 * Grid arithmetic for {@link SearchablePicker}'s keyboard navigation. Pure — no React, no DOM.
 *
 * **The flat reading order is the source of truth; visual rows are a derived view.** `activeIndex`
 * indexes the flattened list of visible options (`sections.flatMap(s => s.items)`), which is what
 * makes ←/→ trivial (±1) and what makes toggling layout mid-navigation keep the same option active
 * for free: the flat order does not depend on how many columns are on screen.
 *
 * Rows are chunked **per group**, never over the flat list. That is the whole reason a group can
 * never continue on the previous group's line — the requirement falls out of the arithmetic instead
 * of needing a rule — and it is why group boundaries need no special case anywhere below: a group
 * boundary just *is* a row boundary.
 *
 * See spec/033-column-select-redesign § 6.
 */

export type MoveDirection = 'up' | 'down' | 'left' | 'right';

export interface GridPosition {
  row: number;
  col: number;
}

/**
 * `counts` is the option count per **visible** group, in render order. Returns each visual row as the
 * flat indices it holds.
 *
 * ```
 * buildRows([2, 4], 3) -> [[0, 1], [2, 3, 4], [5]]
 * buildRows([2, 4], 1) -> [[0], [1], [2], [3], [4], [5]]
 * ```
 *
 * A group with no options contributes no rows, so an empty group is skipped rather than leaving a
 * hole in the row list — which matters because `SearchablePicker` already drops empty groups from
 * the DOM, and the two views have to agree.
 */
export const buildRows = (counts: readonly number[], columns: number): number[][] => {
  const width = Math.max(1, Math.floor(columns));
  const rows: number[][] = [];
  let start = 0;

  for (const count of counts) {
    for (let offset = 0; offset < count; offset += width) {
      const rowWidth = Math.min(width, count - offset);

      rows.push(Array.from({ length: rowWidth }, (_, at) => start + offset + at));
    }

    start += count;
  }

  return rows;
};

/** Flat index → its `{ row, col }`, so Up/Down can look up where the cursor currently is in O(1). */
export const buildPositions = (rows: readonly number[][]): Map<number, GridPosition> => {
  const positions = new Map<number, GridPosition>();

  rows.forEach((row, row_) =>
    row.forEach((index, col) => {
      positions.set(index, { row: row_, col });
    }),
  );

  return positions;
};

/**
 * Where the cursor lands after one arrow press. Returns `activeIndex` unchanged for a move that has
 * nowhere to go, so the caller can stay unconditional.
 *
 * With `columns === 1` every row holds exactly one index, so Up/Down collapse to ±1 — which is both
 * today's compact behaviour and `useReportSearch.ts:53-58`'s. **One code path, two layouts.**
 */
export const moveActiveIndex = (
  rows: readonly number[][],
  positions: ReadonlyMap<number, GridPosition>,
  activeIndex: number,
  direction: MoveDirection,
  optionCount: number,
): number => {
  if (optionCount === 0) return 0;

  // Left/Right are one step in reading order. Because every group starts at column 0, stepping off
  // the end of a row lands on the next row's first cell — and off the end of a group lands on that
  // group's successor — with no special cases.
  if (direction === 'left') return Math.max(activeIndex - 1, 0);
  if (direction === 'right') return Math.min(activeIndex + 1, optionCount - 1);

  const position = positions.get(activeIndex);

  if (!position) return activeIndex;

  // Up/Down move one visual row and keep the column, clamped to the target row's width so a ragged
  // last row (or a one-item group) still catches the cursor rather than swallowing the keypress.
  const targetRow = rows[position.row + (direction === 'down' ? 1 : -1)];

  if (!targetRow) return activeIndex;

  return targetRow[Math.min(position.col, targetRow.length - 1)];
};
