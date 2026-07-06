import type { CellState } from '../types';

/**
 * Priority order used to collapse a child's per-work-type cells into a single rollup status —
 * the most attention-worthy status wins. Ported from the mock's `rollupPriority`.
 */
export const ROLLUP_PRIORITY = ['blocked', 'behind', 'warning', 'ahead', 'ontrack', 'complete', 'notstarted'] as const;

/**
 * Collapse a child's work-type cell states into one rollup status.
 *
 * - all `'na'` → `'na'` (no work of any type)
 * - all present are `'nodate'` → `'nodate'` (work exists but has no dates)
 * - otherwise → the highest-priority present status.
 */
export const childRollup = (states: CellState[]): CellState => {
  const present = states.filter((s) => s !== 'na');
  if (!present.length) return 'na';
  const real = present.filter((s) => s !== 'nodate');
  if (!real.length) return 'nodate';
  for (const p of ROLLUP_PRIORITY) {
    if (real.includes(p)) return p;
  }
  return real[0];
};
