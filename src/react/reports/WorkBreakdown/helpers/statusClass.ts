/**
 * Map rollup statuses to their app color classes and human labels.
 *
 * Single source of truth for status → class/label across the Work Breakdown report, using the
 * app's theme-backed `color-text-and-bg-{status}` classes so theme overrides keep working.
 */

const statusToCssMap: Record<string, string> = {
  complete: 'color-text-and-bg-complete',
  ontrack: 'color-text-and-bg-ontrack',
  behind: 'color-text-and-bg-behind',
  warning: 'color-text-and-bg-warning',
  blocked: 'color-text-and-bg-blocked',
  ahead: 'color-text-and-bg-ahead',
  new: 'color-text-and-bg-new',
  notstarted: 'color-text-and-bg-notstarted',
  unknown: 'color-text-and-bg-unknown',
};

/** Map a rollup status to its color class, falling back to `unknown`. */
export const getStatusColorClass = (status: string): string => statusToCssMap[status] ?? 'color-text-and-bg-unknown';

const statusToTextCssMap: Record<string, string> = {
  complete: 'color-text-complete',
  ontrack: 'color-text-ontrack',
  behind: 'color-text-behind',
  warning: 'color-text-warning',
  blocked: 'color-text-blocked',
  ahead: 'color-text-ahead',
  new: 'color-text-new',
  notstarted: 'color-text-notstarted',
  unknown: 'color-text-unknown',
};

/** Map a rollup status to its text-only color class (no background), falling back to `unknown`. */
export const getStatusTextClass = (status: string): string => statusToTextCssMap[status] ?? 'color-text-unknown';

const statusLabels: Record<string, string> = {
  complete: 'Complete',
  ontrack: 'On track',
  behind: 'Behind',
  warning: 'Warning',
  blocked: 'Blocked',
  ahead: 'Ahead',
  new: 'New',
  notstarted: 'Not started',
  unknown: 'No dates',
};

/** Map a rollup status to its human-readable label, falling back to the raw status. */
export const getStatusLabel = (status: string): string => statusLabels[status] ?? status;

/** Preferred legend display order for statuses. */
export const STATUS_LEGEND_ORDER = [
  'complete',
  'ontrack',
  'ahead',
  'behind',
  'warning',
  'blocked',
  'new',
  'notstarted',
  'unknown',
] as const;
