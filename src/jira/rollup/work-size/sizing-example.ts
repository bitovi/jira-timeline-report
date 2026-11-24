import { computeTeamTime } from './work-size';
import type { WorkSettings } from './work-settings';
import type { WorkSizeFrom } from './work-size';

/**
 * A fixed example team (the "Sizing explanation") sized with the report's Work settings, so the Rollup
 * Calculation section can show what each setting does. Mirrors
 * spec/046-rollup-calculation-settings/mockups/sizing-picture.html.
 *
 * Team time comes from the real {@link computeTeamTime}; the per-day split shown under the
 * timeline uses the same rule, and a test keeps the two in step.
 */

export const EXAMPLE_DAYS = 10;

export type ExampleItem = {
  key: string;
  name: string;
  /** Team-days, or `null` = no estimate. */
  estimate: number | null;
  /** 1-based business days, inclusive. Both `null` = no dates. */
  start: number | null;
  end: number | null;
  color: string;
};

export const EXAMPLE_ITEMS: ExampleItem[] = [
  { key: 'W1', name: 'Epic 1', estimate: 2, start: 1, end: 8, color: '#1f845a' },
  { key: 'W2', name: 'Epic 2', estimate: 3, start: 2, end: 5, color: '#0c66e4' },
  { key: 'W3', name: 'Epic 3', estimate: null, start: 6, end: 9, color: '#8f7ee7' },
  { key: 'W4', name: 'Epic 4', estimate: 7, start: null, end: null, color: '#946f00' },
  { key: 'W5', name: 'Epic 5', estimate: null, start: null, end: null, color: '#8590a2' },
];

/** Where an item's size came from: a sizing method, the level average, or nothing. */
export type ExampleSizeFrom = WorkSizeFrom | 'average' | 'unsized';

export type ExampleRow = {
  item: ExampleItem;
  spanDays: number | null;
  teamTimeDays: number | null;
  /** The size the rollup would use; `null` when left unsized. */
  size: number | null;
  sizeFrom: ExampleSizeFrom;
  /** Sized by something other than the main choice. */
  isFallback: boolean;
  /** Dates but no estimate, and "Leave it out of team time" is picked. */
  leftOut: boolean;
};

export type ExampleDay = { day: number; shares: Array<{ key: string; amount: number }> };

export type SizingExample = {
  rows: ExampleRow[];
  days: ExampleDay[];
  totalTeamTime: number;
  totalSize: number;
};

const LEVEL_AVERAGE_DEFAULT = 30;

/** Business day `n` (1-based) as a date, starting on a Monday so days 1–5 and 6–10 are each a week. */
export function exampleDate(day: number): Date {
  const week = Math.floor((day - 1) / 5);
  const weekday = (day - 1) % 5;
  return new Date(2026, 0, 5 + week * 7 + weekday);
}

const dated = (item: ExampleItem) => item.start != null && item.end != null;
const spanOf = (item: ExampleItem) => (dated(item) ? item.end! - item.start! + 1 : null);

export function buildSizingExample(settings: WorkSettings): SizingExample {
  const chain: WorkSizeFrom[] = [settings.sizeBy, settings.sizeFallback].filter(
    (method): method is WorkSizeFrom => !!method && method !== 'none',
  );
  // "Leave it out" is only offered when team time is the main rule (same as addWorkSize).
  const leaveOut = settings.sizeBy === 'teamTime' && settings.noEstimate === 'leaveOut';
  const isLeftOut = (item: ExampleItem) => leaveOut && dated(item) && item.estimate == null;

  const teamTime = computeTeamTime(
    EXAMPLE_ITEMS.map((item) => ({
      key: item.key,
      group: 'atlas',
      start: dated(item) ? exampleDate(item.start!) : undefined,
      due: dated(item) ? exampleDate(item.end!) : undefined,
      estimateDays: item.estimate,
    })),
    leaveOut ? 'leaveOut' : 'averagePace',
    new Date(0),
  );

  const rows: ExampleRow[] = EXAMPLE_ITEMS.map((item) => {
    const spanDays = spanOf(item);
    const teamTimeDays = teamTime.get(item.key)?.total ?? null;
    const measures: Record<WorkSizeFrom, number | null> = {
      estimate: item.estimate,
      dates: spanDays,
      teamTime: teamTimeDays,
    };
    const index = chain.findIndex((method) => measures[method] != null);
    return {
      item,
      spanDays,
      teamTimeDays,
      size: index >= 0 ? measures[chain[index]] : null,
      sizeFrom: index >= 0 ? chain[index] : 'unsized',
      isFallback: index > 0,
      leftOut: isLeftOut(item),
    };
  });

  const known = rows.filter((row) => row.size != null).map((row) => row.size!);
  const average = known.length ? known.reduce((a, b) => a + b, 0) / known.length : LEVEL_AVERAGE_DEFAULT;
  for (const row of rows) {
    if (row.size == null && settings.missingSize === 'levelAverage') {
      Object.assign(row, { size: average, sizeFrom: 'average', isFallback: true });
    }
  }

  return {
    rows,
    days: splitDays(isLeftOut),
    totalTeamTime: rows.reduce((a, row) => a + (row.teamTimeDays ?? 0), 0),
    totalSize: rows.reduce((a, row) => a + (row.size ?? 0), 0),
  };
}

/** Each business day split among the items active on it, by density. */
function splitDays(isLeftOut: (item: ExampleItem) => boolean): ExampleDay[] {
  const densities = EXAMPLE_ITEMS.filter((item) => dated(item) && item.estimate != null).map(
    (item) => item.estimate! / spanOf(item)!,
  );
  const averagePace = densities.length ? densities.reduce((a, b) => a + b, 0) / densities.length : 1;

  return Array.from({ length: EXAMPLE_DAYS }, (_, index) => {
    const day = index + 1;
    const active = EXAMPLE_ITEMS.filter(
      (item) => dated(item) && !isLeftOut(item) && item.start! <= day && day <= item.end!,
    );
    const weights = active.map((item) => (item.estimate != null ? item.estimate / spanOf(item)! : averagePace));
    const total = weights.reduce((a, b) => a + b, 0);
    return { day, shares: active.map((item, i) => ({ key: item.key, amount: weights[i] / total })) };
  });
}
