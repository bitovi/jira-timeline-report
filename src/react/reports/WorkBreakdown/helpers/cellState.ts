import type { CellState, WorkTypeRollup } from '../types';

/**
 * Derive a single matrix cell's state from a child's work-type rollup:
 *
 * - no work of this type (missing rollup or empty `issueKeys`) → `'na'`
 * - work exists but has no due date → `'nodate'`
 * - otherwise → the rollup status (colored swatch).
 */
export const cellState = (rollup: WorkTypeRollup | undefined | null): CellState => {
  if (!rollup || !rollup.issueKeys?.length) return 'na';
  if (!rollup.due) return 'nodate';
  return rollup.status ?? 'unknown';
};
