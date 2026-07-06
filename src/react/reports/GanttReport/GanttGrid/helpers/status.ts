const SPECIAL = new Set(['complete', 'blocked', 'warning']);

/**
 * `complete`/`blocked`/`warning` labels get `color-text-{status}`; everything else is unstyled.
 *
 * Replaces gantt-grid.js's `classForSpecialStatus` (dropping its unused `issue` param).
 */
export const specialStatusTextClass = (status: string): string => (SPECIAL.has(status) ? `color-text-${status}` : '');
