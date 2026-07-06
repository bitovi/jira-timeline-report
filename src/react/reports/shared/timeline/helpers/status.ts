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

/** Human-readable labels for each rollup status, mirroring the theme's status names. */
const statusLabels: Record<string, string> = {
  complete: 'Complete',
  ontrack: 'On Track',
  behind: 'Behind',
  ahead: 'Ahead',
  warning: 'Warning',
  blocked: 'Blocked',
  new: 'New',
  notstarted: 'Not Started',
  unknown: 'Unknown',
};

/** Map a rollup status to its human-readable label, falling back to the raw status. */
export const getStatusLabel = (status: string): string => statusLabels[status] ?? status;

/** Preferred legend display order for statuses. Statuses not listed are appended alphabetically. */
export const STATUS_LEGEND_ORDER = [
  'complete',
  'ontrack',
  'behind',
  'ahead',
  'warning',
  'blocked',
  'new',
  'notstarted',
  'unknown',
] as const;

export interface StatusCount {
  status: string;
  count: number;
}

/**
 * Count issues by their rollup status, returned in {@link STATUS_LEGEND_ORDER} (unlisted
 * statuses appended alphabetically). Only statuses with a non-zero count are included.
 */
export const countIssuesByStatus = (statuses: string[]): StatusCount[] => {
  const counts = new Map<string, number>();
  for (const status of statuses) {
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  const order = new Map<string, number>(STATUS_LEGEND_ORDER.map((status, index) => [status, index]));
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => {
      const aIndex = order.get(a.status) ?? STATUS_LEGEND_ORDER.length;
      const bIndex = order.get(b.status) ?? STATUS_LEGEND_ORDER.length;
      return aIndex - bIndex || a.status.localeCompare(b.status);
    });
};
