/**
 * Report-level Work settings for the Rollup Calculation section: how much work an **epic** is.
 * Follows spec/046-rollup-calculation-settings/mockups/sizing-picture.html and spec § Scope: epics
 * only. Other levels keep today's sizing.
 *
 * Every setting is optional: a missing one means its default. The defaults (date span → estimate →
 * level average) reproduce today's sizing for teams with Spread effort off.
 */

/** Jira's hierarchy level for epics: the only level the Work settings apply to. */
export const EPIC_HIERARCHY_LEVEL = 1;

export const SIZE_BY = ['teamTime', 'estimate', 'dates'] as const;
export type WorkSizeBy = (typeof SIZE_BY)[number];

export const SIZE_FALLBACKS = ['estimate', 'dates', 'teamTime', 'none'] as const;
export type WorkSizeFallback = (typeof SIZE_FALLBACKS)[number];

export const NO_ESTIMATE = ['averagePace', 'leaveOut'] as const;
export type WorkNoEstimate = (typeof NO_ESTIMATE)[number];

export const MISSING_SIZE = ['levelAverage', 'unsized'] as const;
export type WorkMissingSize = (typeof MISSING_SIZE)[number];

export type WorkSettings = {
  sizeBy: WorkSizeBy;
  sizeFallback: WorkSizeFallback;
  noEstimate: WorkNoEstimate;
  teamTimeOtherWork: boolean;
  missingSize: WorkMissingSize;
};

/** The fallbacks each primary allows, first = its default. */
export const FALLBACKS_FOR: Record<WorkSizeBy, WorkSizeFallback[]> = {
  teamTime: ['estimate', 'none'],
  dates: ['estimate', 'none'],
  estimate: ['dates', 'teamTime', 'none'],
};

/**
 * Route keys and defaults. A param equal to its default is left out of the URL. `sizeFallback`'s
 * default depends on `sizeBy`, so its stored default is `''` and {@link resolveWorkSettings}
 * resolves it.
 */
export const WORK_PARAMS = {
  sizeBy: { key: 'workSizeBy', default: 'dates' as WorkSizeBy, values: SIZE_BY },
  sizeFallback: { key: 'workSizeFallback', default: '' as WorkSizeFallback | '', values: ['', ...SIZE_FALLBACKS] },
  noEstimate: { key: 'workNoEstimate', default: 'averagePace' as WorkNoEstimate, values: NO_ESTIMATE },
  missingSize: { key: 'workMissingSize', default: 'levelAverage' as WorkMissingSize, values: MISSING_SIZE },
} as const;

export const WORK_TEAM_TIME_OTHER_WORK_KEY = 'workTeamTimeOtherWork';
/** Optional JQL appended to the other-work queries (Sources tab), like `childJQL`. */
export const WORK_TEAM_TIME_OTHER_WORK_JQL_KEY = 'workTeamTimeOtherWorkJql';

export type RawWorkSettings = Partial<{
  sizeBy: string;
  sizeFallback: string;
  noEstimate: string;
  teamTimeOtherWork: boolean;
  missingSize: string;
}>;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Normalizes raw route values (any of which may be missing or invalid) into full settings. */
export function resolveWorkSettings(raw: RawWorkSettings = {}): WorkSettings {
  const sizeBy = pick(raw.sizeBy, SIZE_BY, WORK_PARAMS.sizeBy.default);
  const allowedFallbacks = FALLBACKS_FOR[sizeBy];
  return {
    sizeBy,
    sizeFallback: pick(raw.sizeFallback, allowedFallbacks, allowedFallbacks[0]),
    noEstimate: pick(raw.noEstimate, NO_ESTIMATE, WORK_PARAMS.noEstimate.default),
    teamTimeOtherWork: Boolean(raw.teamTimeOtherWork),
    missingSize: pick(raw.missingSize, MISSING_SIZE, WORK_PARAMS.missingSize.default),
  };
}

export const DEFAULT_WORK_SETTINGS: WorkSettings = resolveWorkSettings();

/** Whether team time is part of the sizing (main rule or fallback). */
export function usesTeamTime(settings: WorkSettings): boolean {
  return settings.sizeBy === 'teamTime' || (settings.sizeBy === 'estimate' && settings.sizeFallback === 'teamTime');
}
