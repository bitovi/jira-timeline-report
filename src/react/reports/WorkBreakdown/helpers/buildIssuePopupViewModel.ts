import type { DateDrivenBy, IssueOrRelease, WorkType } from '../types';
import { WORK_TYPES, WORK_TYPE_LABELS, WORK_TYPE_SYMBOLS } from '../types';
import { getStatusColorClass, getStatusLabel, getStatusTextClass } from './statusClass';
import { formatDate } from './formatDate';
import { dateSlip } from './dateSlip';

/** A start/due date plus the driving child issue that produced it, for the "always shown" detail strip. */
export interface IssuePopupDateDetail {
  date: string;
  url?: string;
  summary?: string;
  message?: string;
}

/** One work-type row in the issue popup body. */
export interface IssuePopupWorkTypeRow {
  type: WorkType;
  symbol: string;
  label: string;
  /** `false` when the issue has no work of this type — rendered as a dashed N/A row. */
  hasWork: boolean;
  colorClass: string;
  statusTextClass: string;
  statusLabel: string;
  dateRangeLabel: string;
  wasLabel?: string;
  /** Whether the date slipped (red) or improved (teal) — styles `wasLabel`. */
  wasKind: 'none' | 'slipped' | 'improved';
  start?: IssuePopupDateDetail;
  due?: IssuePopupDateDetail;
}

/** Render-ready view model for the issue popup — all status/date/label formatting lives here. */
export interface IssuePopupViewModel {
  colorClass: string;
  statusLabel: string;
  dateRangeLabel: string;
  wasLabel?: string;
  wasKind: 'none' | 'slipped' | 'improved';
  warningMessage?: string;
  workTypeRows: IssuePopupWorkTypeRow[];
}

/** Format a start/due range as `Mon D – Mon D`, or just one side when only one date is present. */
const formatDateRange = (start?: Date | null, due?: Date | null): string => {
  const startLabel = formatDate(start);
  const dueLabel = formatDate(due);
  if (startLabel && dueLabel) return `${startLabel} – ${dueLabel}`;
  return startLabel || dueLabel;
};

/** Build a single date's driving-issue detail — only when both a date and a "driven by" reason exist. */
const dateDetail = (
  date: Date | null | undefined,
  drivenBy: DateDrivenBy | undefined,
): IssuePopupDateDetail | undefined => {
  if (!date || !drivenBy) return undefined;
  return {
    date: formatDate(date),
    url: drivenBy.reference?.url,
    summary: drivenBy.reference?.summary,
    message: drivenBy.message,
  };
};

/**
 * Build the {@link IssuePopupViewModel} for an issue's popup: the overall rollup status/dates
 * (shown once, in the popup subheader) plus one row per {@link WORK_TYPES} entry — either a
 * populated status/date row or an N/A row when the issue has no work of that type.
 */
export const buildIssuePopupViewModel = (issue: IssueOrRelease): IssuePopupViewModel => {
  const rollup = issue.rollupStatuses.rollup;
  const rollupSlip = dateSlip(rollup);

  const workTypeRows: IssuePopupWorkTypeRow[] = WORK_TYPES.map((type) => {
    const wt = issue.rollupStatuses[type];
    const hasWork = Boolean(wt?.issueKeys?.length);
    const status = wt?.status ?? 'unknown';
    const slip = hasWork ? dateSlip(wt ?? {}) : { kind: 'none' as const };

    return {
      type,
      symbol: WORK_TYPE_SYMBOLS[type],
      label: WORK_TYPE_LABELS[type],
      hasWork,
      colorClass: getStatusColorClass(status),
      statusTextClass: getStatusTextClass(status),
      statusLabel: getStatusLabel(status),
      dateRangeLabel: hasWork ? formatDateRange(wt?.start, wt?.due) : '',
      wasLabel: slip.kind !== 'none' ? `was ${slip.label}` : undefined,
      wasKind: slip.kind,
      start: hasWork ? dateDetail(wt?.start, wt?.startFrom) : undefined,
      due: hasWork ? dateDetail(wt?.due, wt?.dueTo) : undefined,
    };
  });

  return {
    colorClass: getStatusColorClass(rollup.status),
    statusLabel: getStatusLabel(rollup.status),
    dateRangeLabel: formatDateRange(rollup.start, rollup.due),
    wasLabel: rollupSlip.kind !== 'none' ? `was ${rollupSlip.label}` : undefined,
    wasKind: rollupSlip.kind,
    warningMessage: rollup.statusFrom?.warning ? rollup.statusFrom.message : undefined,
    workTypeRows,
  };
};
