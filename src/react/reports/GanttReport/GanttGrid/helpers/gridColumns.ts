import { computeGridColumnCSS } from '../../../shared/timeline/helpers/grid';
import type { Month } from '../types';

/**
 * Build the CSS `grid-template-columns` string: two `auto` gutter columns (chevron + label),
 * one `auto` per extra column (e.g. % complete), then one day-weighted `fr` per month.
 *
 * Replaces gantt-grid.js's `gridColumnsCSS` getter (plus the leading `auto auto` from its
 * template).
 */
export const computeGridTemplateColumns = (months: Month[], extraColumnCount: number): string => {
  const gutter = 'auto auto'; // chevron + label
  const extras = extraColumnCount > 0 ? ` repeat(${extraColumnCount}, auto)` : '';
  const monthCols = ' ' + computeGridColumnCSS(months);
  return gutter + extras + monthCols;
};
