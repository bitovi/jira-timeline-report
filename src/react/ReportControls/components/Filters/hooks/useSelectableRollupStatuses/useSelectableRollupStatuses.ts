import type { CanObservable } from '../../../../../hooks/useCanObservable/useCanObservable';
import { useCanObservable } from '../../../../../hooks/useCanObservable/useCanObservable';
import { useSelectedIssueType } from '../../../../../services/issues/useSelectedIssueType';
import { STATUS_LEGEND_ORDER, getStatusLabel } from '../../../../../reports/WorkBreakdown/helpers';

/** The minimal rolled-up issue/release shape this hook reads. */
export interface MinimalRollupIssue {
  type?: string;
  rollupStatuses?: {
    rollup?: {
      status?: string;
      newlyStarted?: boolean;
      newlyCompleted?: boolean;
      newlyDated?: boolean;
    };
  };
}

const NEWLY_FIELDS = [
  { value: 'newlyStarted', label: 'Newly started' },
  { value: 'newlyCompleted', label: 'Newly completed' },
  { value: 'newlyDated', label: 'Newly dated' },
] as const;

/** Stable empty observable used when the caller doesn't supply one. */
const emptyIssuesObs: CanObservable<MinimalRollupIssue[]> = {
  value: [],
  getData: () => [],
  get: () => [],
  set: () => undefined,
  on: () => undefined,
  off: () => undefined,
} as unknown as CanObservable<MinimalRollupIssue[]>;

/**
 * Selectable `{ label, value }` pairs for the Rollup Status filter field, with counts (mirrors
 * `useSelectableStatuses`'s `"Done (9)"` convention). Filters to the selected issue type (same
 * rule as `useSelectableStatuses`), tallies `rollupStatuses.rollup.status` plus the 3 independent
 * "Newly ..." booleans, ordered by `STATUS_LEGEND_ORDER` with the "Newly ..." values last. Plain
 * rollup statuses are only listed when present (there could be many arbitrary values); the 3
 * "Newly ..." values are a small, fixed, well-known set and are ALWAYS listed (even at "(0)") so
 * they stay discoverable regardless of whether anything currently matches.
 */
export const useSelectableRollupStatuses = (issuesObs?: CanObservable<MinimalRollupIssue[]>) => {
  const issues = useCanObservable(issuesObs ?? emptyIssuesObs);
  const { selectedIssueType } = useSelectedIssueType();

  const filtered = (issues ?? []).filter((issue) => issue.type === selectedIssueType);

  const statusCounts: Record<string, number> = {};
  const newlyCounts: Record<string, number> = { newlyStarted: 0, newlyCompleted: 0, newlyDated: 0 };

  for (const issue of filtered) {
    const rollup = issue.rollupStatuses?.rollup;
    if (!rollup) {
      continue;
    }
    if (rollup.status) {
      statusCounts[rollup.status] = (statusCounts[rollup.status] ?? 0) + 1;
    }
    if (rollup.newlyStarted) {
      newlyCounts.newlyStarted++;
    }
    if (rollup.newlyCompleted) {
      newlyCounts.newlyCompleted++;
    }
    if (rollup.newlyDated) {
      newlyCounts.newlyDated++;
    }
  }

  const statusOptions = STATUS_LEGEND_ORDER.filter((status) => statusCounts[status] > 0).map((status) => ({
    label: `${getStatusLabel(status)} (${statusCounts[status]})`,
    value: status,
  }));

  const newlyOptions = NEWLY_FIELDS.map((field) => ({
    label: `${field.label} (${newlyCounts[field.value]})`,
    value: field.value,
  }));

  return [...statusOptions, ...newlyOptions];
};
