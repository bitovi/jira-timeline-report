/**
 * Per-hierarchy-level filters (spec/043-filters-redesign).
 *
 * `levelFilters` is keyed by level NAME (`'Epic'`, the same naming `issueHierarchy` and
 * `selectedIssueType` use), `'Release'`, or `'all'`. Issues are matched to a level by
 * `hierarchyLevel` rather than `type`, because a level named "Epic" can contain other types.
 *
 * Older params (`filterRows`, `hideUnknownInitiatives`, the scatter date range, the release picker
 * and `cardsChildFilterRows`) are read as fallbacks by {@link resolveLevelFilters}, so old saved
 * reports and links keep filtering the same way.
 */
import { FilterRow, FilterableIssueOrRelease, matchesAllFilterRows } from './filter-rows';
import {
  isDueInDateRange,
  parseISODateRangeBoundary,
} from '../../../react/reports/shared/timeline/helpers/dateRangeFilter';

export const ALL_LEVELS = 'all';
export const RELEASE_LEVEL = 'Release';

/** `'all'`, a level name from `issueHierarchy` (`'Epic'`), or `'Release'`. */
export type LevelKey = string;

export interface LevelFilter {
  rows: FilterRow[];
  hideWithoutDates?: boolean;
  /** ISO `YYYY-MM-DD` */
  dueDateStart?: string;
  dueDateEnd?: string;
  // Releases tab only
  releasesToShow?: string[];
  showOnlySemverReleases?: boolean;
}

export type LevelFilters = Record<LevelKey, LevelFilter>;

export interface HierarchyLevel {
  name: string;
  hierarchyLevel: number;
}

/** The slice of route data / `ChildReportConfig` the resolver reads. */
export interface LevelFiltersConfig {
  levelFilters?: LevelFilters | null;
  primaryIssueType?: string;
  secondaryIssueType?: string;
  issueHierarchy?: HierarchyLevel[] | null;
  effectiveFilterRows?: FilterRow[];
  hideUnknownInitiatives?: boolean;
  scatterDateRangeStart?: string;
  scatterDateRangeEnd?: string;
  releasesToShow?: string[];
  showOnlySemverReleases?: boolean;
  cardsChildFilterRows?: FilterRow[];
}

export interface LevelDates {
  start?: Date | null;
  due?: Date | null;
}

export interface LevelFilterableIssue extends FilterableIssueOrRelease {
  name?: string;
  names?: { semver?: unknown };
}

export interface MatchLevelFilterOptions {
  dates: LevelDates;
  /** Scatter hides items with no due date; every other report hides items without `start < due`. */
  scatter?: boolean;
  /** The Report on level's range is applied by the report components, not the view model. */
  skipDateRange?: boolean;
}

/** The key of the "Report on" level: `'Release'` when reporting on releases. */
export function reportOnLevelKey(config: Pick<LevelFiltersConfig, 'primaryIssueType'>): LevelKey | undefined {
  return config.primaryIssueType || undefined;
}

/** The key of the level directly below Report on, which Cards renders as children. */
export function childLevelKey(config: LevelFiltersConfig): LevelKey | undefined {
  if (config.primaryIssueType === RELEASE_LEVEL) {
    return config.secondaryIssueType || undefined;
  }
  const hierarchy = config.issueHierarchy ?? [];
  const index = hierarchy.findIndex(({ name }) => name === config.primaryIssueType);
  return index >= 0 ? hierarchy[index + 1]?.name : undefined;
}

/**
 * The hierarchy split around Report on. When reporting on releases nothing is above, and every
 * level from the secondary type down is below.
 */
export function splitLevels(config: LevelFiltersConfig): { above: HierarchyLevel[]; below: HierarchyLevel[] } {
  const hierarchy = config.issueHierarchy ?? [];
  const isRelease = config.primaryIssueType === RELEASE_LEVEL;
  const pivotName = isRelease ? config.secondaryIssueType : config.primaryIssueType;
  const pivot = hierarchy.find(({ name }) => name === pivotName);
  if (!pivot) {
    return { above: [], below: [] };
  }
  return {
    above: isRelease ? [] : hierarchy.filter(({ hierarchyLevel }) => hierarchyLevel > pivot.hierarchyLevel),
    below: hierarchy.filter(({ hierarchyLevel }) =>
      isRelease ? hierarchyLevel <= pivot.hierarchyLevel : hierarchyLevel < pivot.hierarchyLevel,
    ),
  };
}

/** The level key an issue or release belongs to. */
export function levelKeyOf(
  issue: { type?: string; hierarchyLevel?: number },
  hierarchy: HierarchyLevel[] | null | undefined,
): LevelKey | undefined {
  if (issue.type === RELEASE_LEVEL) {
    return RELEASE_LEVEL;
  }
  return (hierarchy ?? []).find(({ hierarchyLevel }) => hierarchyLevel === issue.hierarchyLevel)?.name;
}

/** Drops `undefined` fields so a fallback entry looks like one the panel would write. */
function compact(filter: LevelFilter): LevelFilter {
  return Object.fromEntries(Object.entries(filter).filter(([, value]) => value !== undefined)) as LevelFilter;
}

/**
 * `levelFilters` merged with the legacy params. A fallback applies only when that level has no
 * entry of its own, so once the panel writes a level, the legacy params stop affecting it.
 */
export function resolveLevelFilters(config: LevelFiltersConfig): LevelFilters {
  const levels: LevelFilters = { ...(config.levelFilters ?? {}) };

  const reportOn = reportOnLevelKey(config);
  if (reportOn && !levels[reportOn]) {
    const isRelease = reportOn === RELEASE_LEVEL;
    levels[reportOn] = compact({
      rows: config.effectiveFilterRows ?? [],
      hideWithoutDates: config.hideUnknownInitiatives || undefined,
      dueDateStart: config.scatterDateRangeStart || undefined,
      dueDateEnd: config.scatterDateRangeEnd || undefined,
      releasesToShow: config.releasesToShow?.length ? config.releasesToShow : undefined,
      showOnlySemverReleases: (isRelease && config.showOnlySemverReleases) || undefined,
    });
  }

  const child = childLevelKey(config);
  if (child && !levels[child] && config.cardsChildFilterRows?.length) {
    levels[child] = { rows: config.cardsChildFilterRows };
  }

  return levels;
}

/** True when `filter` would remove anything. */
export function isLevelFilterActive(filter: LevelFilter | undefined): boolean {
  return countActiveFilters(filter) > 0;
}

/** Rows with values, hide-without-dates, the date range (once), the release picker and semver. */
export function countActiveFilters(filter: LevelFilter | undefined): number {
  if (!filter) {
    return 0;
  }
  return (
    (filter.rows ?? []).filter((row) => row.value.length).length +
    (filter.hideWithoutDates ? 1 : 0) +
    (filter.dueDateStart || filter.dueDateEnd ? 1 : 0) +
    (filter.releasesToShow?.length ? 1 : 0) +
    (filter.showOnlySemverReleases ? 1 : 0)
  );
}

function hasDates({ start, due }: LevelDates, scatter: boolean | undefined): boolean {
  if (scatter) {
    return due != null;
  }
  return start != null && due != null && start < due;
}

/**
 * Rows, release picker, semver, hide-without-dates and the due-date range. Undated issues pass the
 * range; only hide-without-dates removes them (the Gantt's `filterIssuesKeepingUndated` rule).
 */
export function matchesLevelFilter(
  issue: LevelFilterableIssue,
  filter: LevelFilter | undefined,
  { dates, scatter, skipDateRange }: MatchLevelFilterOptions,
): boolean {
  if (!filter) {
    return true;
  }
  if (!matchesAllFilterRows(issue, filter.rows ?? [])) {
    return false;
  }
  if (filter.releasesToShow?.length && !filter.releasesToShow.includes(issue.name ?? '')) {
    return false;
  }
  if (filter.showOnlySemverReleases && !issue.names?.semver) {
    return false;
  }
  if (filter.hideWithoutDates && !hasDates(dates, scatter)) {
    return false;
  }
  if (!skipDateRange && dates.due) {
    const range = {
      from: parseISODateRangeBoundary(filter.dueDateStart),
      to: parseISODateRangeBoundary(filter.dueDateEnd),
    };
    if ((range.from || range.to) && !isDueInDateRange(dates.due, range)) {
      return false;
    }
  }
  return true;
}

/** The overlap of several ISO ranges: the latest start and the earliest end. */
export function intersectDateRange(...filters: (LevelFilter | undefined)[]): { start: string; end: string } {
  // ISO `YYYY-MM-DD` strings sort chronologically.
  const starts = filters.map((filter) => filter?.dueDateStart).filter((date): date is string => !!date);
  const ends = filters.map((filter) => filter?.dueDateEnd).filter((date): date is string => !!date);
  return {
    start: starts.length ? starts.reduce((a, b) => (a > b ? a : b)) : '',
    end: ends.length ? ends.reduce((a, b) => (a < b ? a : b)) : '',
  };
}

/** Walks `parentKey` upward until it reaches `hierarchyLevel`; `undefined` when there's no such ancestor. */
export function findAncestorAtLevel<T extends { parentKey?: string | null; hierarchyLevel?: number }>(
  issue: { parentKey?: string | null },
  byKey: Map<string, T>,
  hierarchyLevel: number,
): T | undefined {
  const seen = new Set<string>();
  let parentKey = issue.parentKey;
  while (parentKey && !seen.has(parentKey)) {
    seen.add(parentKey);
    const parent = byKey.get(parentKey);
    if (!parent) {
      return undefined;
    }
    if (parent.hierarchyLevel === hierarchyLevel) {
      return parent;
    }
    parentKey = parent.parentKey;
  }
  return undefined;
}

/**
 * Which issues a tab's filter applies to: `'all'` is Report on and every level below it, `'Release'`
 * is the releases, and a level name is that level. `isAbove` marks a level above Report on, whose
 * issues are never rolled up.
 */
export function levelScope(
  key: LevelKey,
  config: LevelFiltersConfig,
): { hierarchyLevels: Set<number>; includesReleases: boolean; isAbove: boolean } {
  const isRelease = config.primaryIssueType === RELEASE_LEVEL;
  const { above, below } = splitLevels(config);
  const hierarchy = config.issueHierarchy ?? [];

  if (key === ALL_LEVELS) {
    const reportOn = isRelease ? [] : hierarchy.filter(({ name }) => name === config.primaryIssueType);
    return {
      hierarchyLevels: new Set([...reportOn, ...below].map(({ hierarchyLevel }) => hierarchyLevel)),
      includesReleases: isRelease,
      isAbove: false,
    };
  }
  if (key === RELEASE_LEVEL) {
    return { hierarchyLevels: new Set(), includesReleases: true, isAbove: false };
  }
  const level = hierarchy.find(({ name }) => name === key);
  return {
    hierarchyLevels: new Set(level ? [level.hierarchyLevel] : []),
    includesReleases: false,
    isAbove: above.some(({ name }) => name === key),
  };
}

/**
 * Whether a tab's due-date range changes anything in the given report:
 * - Report on (and Releases): only Gantt and Scatter apply it, in their components.
 * - Above Report on: the view model applies it to `primaryIssuesOrReleases`, which every report
 *   with a Filters control reads.
 * - Below Report on: it hides child rows, which only Gantt, Cards and Table's tree render.
 * - All items: both of the above for the levels it covers.
 */
export function dueDateRangeApplies(key: LevelKey, config: LevelFiltersConfig & { primaryReportType?: string }) {
  const report = config.primaryReportType ?? '';
  const appliesToReportOn = report === 'due' || report === 'start-due';
  const appliesToChildren = report === 'start-due' || report === 'cards' || report === 'table';

  if (key === ALL_LEVELS) {
    return appliesToReportOn || appliesToChildren;
  }
  if (key === reportOnLevelKey(config)) {
    return appliesToReportOn;
  }
  return levelScope(key, config).isAbove || appliesToChildren;
}
