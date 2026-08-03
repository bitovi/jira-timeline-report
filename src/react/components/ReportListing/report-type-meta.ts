import { reports } from '../../../configuration/reports';

export type ReportTypeTone =
  | 'gantt'
  | 'scatter'
  | 'estprogress'
  | 'scheduler'
  | 'estanalysis'
  | 'table'
  | 'flow'
  | 'tis'
  | 'cards'
  | 'ror'
  | 'neutral';

export interface ReportTypeMeta {
  key: string;
  name: string;
  tone: ReportTypeTone;
}

const toneByKey: Record<string, ReportTypeTone> = {
  'start-due': 'gantt',
  due: 'scatter',
  'estimation-progress': 'estprogress',
  'auto-scheduler': 'scheduler',
  'estimate-analysis': 'estanalysis',
  table: 'table',
  'flow-metrics': 'flow',
  'time-in-status': 'tis',
  cards: 'cards',
  'report-of-reports': 'ror',
};

/**
 * Maps a `primaryReportType` key to its display name and icon/badge tone. Unknown or missing keys
 * fall back to a neutral tone with the raw key as the name, so older/newer saved reports never
 * throw. Names come from `src/configuration/reports.ts`, the single source of truth for report
 * type labels.
 */
export const reportTypeMeta = (typeKey: string | undefined | null): ReportTypeMeta => {
  if (!typeKey) {
    return { key: '', name: '', tone: 'neutral' };
  }

  const tone = toneByKey[typeKey];

  if (!tone) {
    return { key: typeKey, name: typeKey, tone: 'neutral' };
  }

  const name = reports.find((report) => report.key === typeKey)?.name ?? typeKey;

  return { key: typeKey, name, tone };
};
