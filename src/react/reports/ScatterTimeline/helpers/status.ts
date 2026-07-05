const statusToCssMap: Record<string, string> = {
  complete: 'color-text-and-bg-complete',
  ontrack: 'color-text-and-bg-ontrack',
  behind: 'color-text-and-bg-behind',
  warning: 'color-text-and-bg-warning',
  blocked: 'color-text-and-bg-blocked',
  unknown: 'color-text-and-bg-unknown',
  notstarted: 'color-text-and-bg-notstarted',
  ahead: 'color-text-and-bg-ahead',
  new: 'color-text-and-bg-new',
  'behind-last-period': 'color-text-and-bg-behind-last-period',
  'ahead-last-period': 'color-text-and-bg-ahead-last-period',
  'warning-last-period': 'color-text-and-bg-warning-last-period',
  'blocked-last-period': 'color-text-and-bg-blocked-last-period',
};

/** Map a rollup status to its CSS color class, falling back to `unknown`. */
export const getStatusColorClass = (status: string): string => statusToCssMap[status] ?? 'color-text-and-bg-unknown';
