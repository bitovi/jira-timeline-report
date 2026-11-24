import type { DerivedIssue } from '../../derived/derive';
import { getBusinessDatesCount } from '../../../utils/date/business-days';
import { IssueOrRelease, isDerivedIssue } from '../rollup';
import { DEFAULT_WORK_SETTINGS, EPIC_HIERARCHY_LEVEL, WorkNoEstimate, WorkSettings } from './work-settings';

/**
 * How much work each issue is. Epics follow the report's Work settings; every other level keeps
 * today's `derivedTiming` size (spec/046 § Scope: epics only). Runs after derive and before the work
 * rollup, because team time depends on the team's other epics.
 */

export type WorkSizeFrom = 'teamTime' | 'estimate' | 'dates';

export type WorkSize = {
  /** The size the rollup uses; `null` = no size. */
  totalDaysOfWork: number | null;
  completedDaysOfWork: number;
  sizeFrom: WorkSizeFrom | null;
  /** True for non-epics: today's `derivedTiming` size, decided by the team's Spread effort. */
  legacy: boolean;
  /** Each measure, for explanations, in days (`null` when it doesn't apply). Unset when `legacy`. */
  estimateDays: number | null;
  spanDays: number | null;
  teamTimeDays: number | null;
};

export type WithWorkSize = { workSize: WorkSize };

export type AddWorkSizeOptions = {
  now?: Date;
  /**
   * The team's other work, not in the report. Used only to split team time; it gets no `workSize`
   * and isn't returned. See `loadTeamOtherWork`.
   */
  otherWork?: DerivedIssue[];
};

export function addWorkSize<T>(
  issuesOrReleases: IssueOrRelease<T>[],
  settings: WorkSettings = DEFAULT_WORK_SETTINGS,
  { now = new Date(), otherWork = [] }: AddWorkSizeOptions = {},
): IssueOrRelease<T & Partial<WithWorkSize>>[] {
  const epics = (issuesOrReleases.filter(isDerivedIssue) as DerivedIssue[]).filter(isEpic);

  const chain = [settings.sizeBy, settings.sizeFallback].filter(
    (method): method is WorkSizeFrom => !!method && method !== 'none',
  );

  let teamTime = new Map<string, TeamTimeResult>();
  if (chain.includes('teamTime')) {
    const loadedKeys = new Set(epics.map((issue) => issue.key));
    const extra = otherWork.filter((issue) => isEpic(issue) && !loadedKeys.has(issue.key));
    // "Leave it out" is only offered when team time is the main rule.
    const noEstimate: WorkNoEstimate = settings.sizeBy === 'teamTime' ? settings.noEstimate : 'averagePace';
    teamTime = computeTeamTime(
      [...epics, ...extra].map((issue) => ({
        key: issue.key,
        group: teamTimeGroup(issue),
        start: issue.derivedTiming.start,
        due: issue.derivedTiming.due,
        estimateDays: estimateDays(issue),
      })),
      noEstimate,
      now,
    );
  }

  return issuesOrReleases.map((item) => {
    if (!isDerivedIssue(item)) {
      return item;
    }
    if (!isEpic(item)) {
      return { ...item, workSize: legacyWorkSize(item) };
    }
    const estimate = estimateDays(item);
    const spanDays = item.derivedTiming.datesDaysOfWork;
    const teamTimeResult = teamTime.get(item.key) ?? null;
    const measures: Record<WorkSizeFrom, number | null> = {
      estimate,
      dates: spanDays,
      teamTime: teamTimeResult?.total ?? null,
    };
    const sizeFrom = chain.find((method) => measures[method] != null) ?? null;
    const size = sizeFrom ? measures[sizeFrom] : null;

    let completed = 0;
    if (size != null) {
      completed =
        sizeFrom === 'teamTime'
          ? (teamTimeResult?.completed ?? 0)
          : datesCompletedDays(item.derivedTiming.start, item.derivedTiming.due, size, now);
    }

    const workSize: WorkSize = {
      totalDaysOfWork: size,
      completedDaysOfWork: completed,
      sizeFrom,
      legacy: false,
      estimateDays: estimate,
      spanDays,
      teamTimeDays: measures.teamTime,
    };
    return { ...item, workSize };
  });
}

export function isEpic(issue: DerivedIssue): boolean {
  return issue.hierarchyLevel === EPIC_HIERARCHY_LEVEL;
}

/** Today's sizing, straight from `derivedTiming` (honors each team's Spread effort toggle). */
function legacyWorkSize(issue: DerivedIssue): WorkSize {
  const timing = issue.derivedTiming;
  const hasEstimate = timing.isStoryPointsMedianValid || timing.isStoryPointsValid;
  const hasDates = timing.datesDaysOfWork != null;
  let sizeFrom: WorkSizeFrom | null = null;
  if (!issue.team?.spreadEffortAcrossDates && hasDates) sizeFrom = 'dates';
  else if (hasEstimate) sizeFrom = 'estimate';
  else if (hasDates) sizeFrom = 'dates';

  return {
    totalDaysOfWork: timing.totalDaysOfWork,
    completedDaysOfWork: timing.completedDaysOfWork,
    sizeFrom,
    legacy: true,
    estimateDays: null,
    spanDays: null,
    teamTimeDays: null,
  };
}

/**
 * Estimate in days, the same units as today (points ÷ points per day per track), or `null` when the
 * item has no estimate: the confidence-adjusted median (missing confidence = 50%), else story points.
 */
export function estimateDays(issue: DerivedIssue): number | null {
  const timing = issue.derivedTiming;
  let trackDays: number | null = null;
  if (timing.isStoryPointsMedianValid) {
    trackDays = timing.deterministicTotalDaysOfWork;
  } else if (timing.isStoryPointsValid) {
    trackDays = timing.storyPointsDaysOfWork;
  }
  if (trackDays == null || !Number.isFinite(trackDays)) {
    return null;
  }
  return trackDays;
}

/**
 * Completed days from elapsed time: size × the elapsed share of start → due. One date only keeps
 * today's handling: start only → elapsed days capped at size; due only → 0, then all of it.
 */
export function datesCompletedDays(start: Date | undefined, due: Date | undefined, size: number, now: Date): number {
  if (start && start >= now) return 0;
  if (due && due <= now) return size;
  if (!start) return 0;
  if (!due) return Math.min(getBusinessDatesCount(start, now), size);
  const span = getBusinessDatesCount(start, due);
  return span ? (size * getBusinessDatesCount(start, now)) / span : 0;
}

// ---- team time ----

type TeamTimeInput = {
  key: string;
  /** Items only share days with items in the same group (team + hierarchy level). */
  group: string;
  start?: Date;
  due?: Date;
  estimateDays: number | null;
};

export type TeamTimeResult = { total: number; completed: number };

function teamTimeGroup(issue: DerivedIssue) {
  return `${issue.team?.name ?? ''}\u0000${issue.hierarchyLevel}`;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Splits each business day among the group's items active that day, in proportion to
 * their density (estimate ÷ date span). An item's team time is the sum of its daily shares, and
 * its completed days are the shares on days up to `now`. Days are stepped exactly like
 * `getBusinessDatesCount`, so a lone item's team time equals its date span.
 */
export function computeTeamTime(
  items: TeamTimeInput[],
  noEstimate: WorkNoEstimate,
  now: Date,
): Map<string, TeamTimeResult> {
  const groups = new Map<string, Array<TeamTimeInput & { start: Date; due: Date; span: number }>>();
  for (const item of items) {
    if (!item.start || !item.due) continue;
    const span = getBusinessDatesCount(item.start, item.due);
    if (!span) continue;
    const list = groups.get(item.group) ?? [];
    list.push({ ...item, start: item.start, due: item.due, span });
    groups.set(item.group, list);
  }

  const result = new Map<string, TeamTimeResult>();
  for (const group of groups.values()) {
    const densities = group.filter((i) => i.estimateDays != null).map((i) => i.estimateDays! / i.span);
    const averagePace = densities.length ? densities.reduce((a, b) => a + b, 0) / densities.length : 1;

    const days = new Map<string, { counts: boolean; shares: Array<{ key: string; weight: number }> }>();
    for (const item of group) {
      if (item.estimateDays == null && noEstimate === 'leaveOut') continue;
      const weight = item.estimateDays != null ? item.estimateDays / item.span : averagePace;
      const cursor = new Date(item.start.getTime());
      while (cursor <= item.due) {
        const weekday = cursor.getDay();
        if (weekday !== 0 && weekday !== 6) {
          const key = dayKey(cursor);
          const day = days.get(key) ?? { counts: cursor <= now, shares: [] };
          day.shares.push({ key: item.key, weight });
          days.set(key, day);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      result.set(item.key, { total: 0, completed: 0 });
    }

    for (const day of days.values()) {
      const totalWeight = day.shares.reduce((a, s) => a + s.weight, 0);
      if (totalWeight <= 0) continue;
      for (const { key, weight } of day.shares) {
        const share = weight / totalWeight;
        const entry = result.get(key)!;
        entry.total += share;
        if (day.counts) entry.completed += share;
      }
    }
  }
  return result;
}
