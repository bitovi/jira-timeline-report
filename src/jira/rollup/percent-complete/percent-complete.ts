import { CalculationType, RollupLevelAndCalculation } from '../../shared/types';
import {
  rollupGroupedHierarchy,
  groupIssuesByHierarchyLevelOrType,
  zipRollupDataOntoGroupedData,
  IssueOrRelease,
  isDerivedIssue,
} from '../rollup';
import { EPIC_HIERARCHY_LEVEL, WorkMissingSize } from '../work-size/work-settings';
import type { WithWorkSize } from '../work-size/work-size';

/**
 * The work rollup behind Percent Complete and estimated-time totals. Known days (from an item's own
 * size) and averaged days (placeholders for items without a size) are carried separately, with a
 * per-team breakdown that always adds up to the totals. See spec/046 § Work rollup.
 */

export type TeamWork = {
  knownWorkingDays: number;
  knownCompletedWorkingDays: number;
  averagedWorkingDays: number;
  averagedCompletedWorkingDays: number;
};

export type WorkRollupSource = 'self' | 'children' | 'average' | 'unsized';

export type WorkRollup = {
  source: WorkRollupSource;
  /** Every contributing item had a size. */
  userSpecifiedValues: boolean;

  knownWorkingDays: number;
  knownCompletedWorkingDays: number;
  readonly knownRemainingWorkingDays: number;

  averagedWorkingDays: number;
  averagedCompletedWorkingDays: number;
  readonly averagedRemainingWorkingDays: number;

  /** Known + averaged (the old `totalWorkingDays`). */
  readonly workingDaysWithAverages: number;
  /** The old `completedWorkingDays`. */
  readonly completedWorkingDaysWithAverages: number;
  /** The old `remainingWorkingDays`. */
  readonly remainingWorkingDaysWithAverages: number;

  /** This issue (if it has no size) and every descendant without a size. Informational: adds no days. */
  unsizedIssueKeys: string[];
  /** Keyed by team name. Σ byTeam = the totals above. */
  byTeam: Record<string, TeamWork>;
};

export type WithPercentComplete = {
  completionRollup: WorkRollup;
};

export type PercentCompleteMeta = {
  /** Known totals at this level, to compute the level average from. */
  totalDaysOfWorkForAverage: number[];
  /** Items waiting for the level average once it's known. */
  needsAverageSet: Array<{ rollup: WorkRollup; team: string; done: boolean }>;
  /** Set once the level is finalized. */
  averageTotalDays: number;
};

export type WorkRollupOptions = {
  missingSize?: WorkMissingSize;
};

/**
 * Parent vs. children for each group of `groupIssuesByHierarchyLevelOrType` (low → high). Only the
 * epic level follows its date rollup setting (spec § Scope: epics only); `null` = today's rule.
 */
export type ParentRules = Array<CalculationType | null>;

export function epicParentRules(rollupTimingLevelsAndCalculations: RollupLevelAndCalculation[]): ParentRules {
  return rollupTimingLevelsAndCalculations
    .map(({ hierarchyLevel, calculation }) => (hierarchyLevel === EPIC_HIERARCHY_LEVEL ? calculation : null))
    .reverse();
}

/** Team key for issues without a team (only test fixtures, in practice). */
export const NO_TEAM = '(no team)';

const DEFAULT_LEVEL_AVERAGE = 30;

function sum(arr: number[]) {
  return arr.reduce((partialSum, a) => partialSum + a, 0);
}
function average(arr: number[]) {
  return arr.length > 0 ? sum(arr) / arr.length : 0;
}

export function addPercentComplete<T>(
  issuesOrReleases: IssueOrRelease<T>[],
  rollupTimingLevelsAndCalculations: RollupLevelAndCalculation[],
  options: WorkRollupOptions = {},
): IssueOrRelease<T & WithPercentComplete>[] {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTimingLevelsAndCalculations);
  const rolledUp = rollupPercentComplete(groupedIssues, {
    missingSize: options.missingSize,
    parentRules: epicParentRules(rollupTimingLevelsAndCalculations),
  });
  const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUp, (item, values) => ({
    ...item,
    completionRollup: values,
  }));
  return zipped.flat();
}

/**
 * @param groupedHierarchy Starting from low to high
 */
export function rollupPercentComplete<T>(
  groupedHierarchy: IssueOrRelease<T>[][],
  { missingSize = 'levelAverage', parentRules = [] }: { missingSize?: WorkMissingSize; parentRules?: ParentRules } = {},
) {
  return rollupGroupedHierarchy(groupedHierarchy, {
    createMetadataForHierarchyLevel(): PercentCompleteMeta {
      return {
        totalDaysOfWorkForAverage: [],
        needsAverageSet: [],
        averageTotalDays: 0,
      };
    },
    createRollupDataFromParentAndChild(issueOrRelease, children: WorkRollup[], levelIndex, metadata) {
      const rule = PARENT_RULES[parentRules[levelIndex] ?? 'childrenFirstThenParent'] ?? childrenFirstThenParent;
      return rule(issueOrRelease, children, { metadata, missingSize });
    },
    finalizeMetadataForHierarchyLevel(metadata) {
      const ave = average(metadata.totalDaysOfWorkForAverage) || DEFAULT_LEVEL_AVERAGE;
      metadata.averageTotalDays = ave;
      for (const { rollup, team, done } of metadata.needsAverageSet) {
        rollup.averagedWorkingDays += ave;
        rollup.byTeam[team].averagedWorkingDays += ave;
        // a Done item takes on the average, all of it completed
        if (done) {
          rollup.averagedCompletedWorkingDays += ave;
          rollup.byTeam[team].averagedCompletedWorkingDays += ave;
        }
      }
    },
  });
}

// ---- building blocks ----

type Context = { metadata: PercentCompleteMeta; missingSize: WorkMissingSize };

type RollupInit = Partial<
  Pick<
    WorkRollup,
    | 'source'
    | 'userSpecifiedValues'
    | 'knownWorkingDays'
    | 'knownCompletedWorkingDays'
    | 'averagedWorkingDays'
    | 'averagedCompletedWorkingDays'
    | 'unsizedIssueKeys'
    | 'byTeam'
  >
>;

export function createWorkRollup(init: RollupInit = {}): WorkRollup {
  return {
    source: 'self',
    userSpecifiedValues: false,
    knownWorkingDays: 0,
    knownCompletedWorkingDays: 0,
    averagedWorkingDays: 0,
    averagedCompletedWorkingDays: 0,
    unsizedIssueKeys: [],
    byTeam: {},
    ...init,
    get knownRemainingWorkingDays() {
      return this.knownWorkingDays - this.knownCompletedWorkingDays;
    },
    get averagedRemainingWorkingDays() {
      return this.averagedWorkingDays - this.averagedCompletedWorkingDays;
    },
    get workingDaysWithAverages() {
      return this.knownWorkingDays + this.averagedWorkingDays;
    },
    get completedWorkingDaysWithAverages() {
      return this.knownCompletedWorkingDays + this.averagedCompletedWorkingDays;
    },
    get remainingWorkingDaysWithAverages() {
      return this.workingDaysWithAverages - this.completedWorkingDaysWithAverages;
    },
  };
}

function emptyTeamWork(): TeamWork {
  return { knownWorkingDays: 0, knownCompletedWorkingDays: 0, averagedWorkingDays: 0, averagedCompletedWorkingDays: 0 };
}

function teamOf<T>(issueOrRelease: IssueOrRelease<T>): string {
  return (isDerivedIssue(issueOrRelease) && issueOrRelease.team?.name) || NO_TEAM;
}

/** An issue's own size: `workSize` when the sizing stage ran, else `derivedTiming` (today's). */
function ownSize<T>(issueOrRelease: IssueOrRelease<T>): { total: number | null; completed: number } | null {
  if (!isDerivedIssue(issueOrRelease)) {
    return null;
  }
  const workSize = (issueOrRelease as Partial<WithWorkSize>).workSize;
  if (workSize) {
    return { total: workSize.totalDaysOfWork, completed: workSize.completedDaysOfWork };
  }
  const timing = issueOrRelease.derivedTiming;
  return timing ? { total: timing.totalDaysOfWork, completed: timing.completedDaysOfWork } : null;
}

/** A size of 0 counts as no size, as it always has. */
function hasOwnSize(size: ReturnType<typeof ownSize>): size is { total: number; completed: number } {
  return Boolean(size?.total);
}

function union(...lists: string[][]): string[] {
  return [...new Set(lists.flat())];
}

/** The issue's key when it's an issue without a size (releases never count). */
function selfIfUnsized<T>(issueOrRelease: IssueOrRelease<T>): string[] {
  return isDerivedIssue(issueOrRelease) && !hasOwnSize(ownSize(issueOrRelease)) ? [issueOrRelease.key] : [];
}

export function sumChildRollups(children: WorkRollup[]): WorkRollup {
  const byTeam: Record<string, TeamWork> = {};
  for (const child of children) {
    for (const [team, work] of Object.entries(child.byTeam)) {
      const into = (byTeam[team] ??= emptyTeamWork());
      into.knownWorkingDays += work.knownWorkingDays;
      into.knownCompletedWorkingDays += work.knownCompletedWorkingDays;
      into.averagedWorkingDays += work.averagedWorkingDays;
      into.averagedCompletedWorkingDays += work.averagedCompletedWorkingDays;
    }
  }
  return createWorkRollup({
    source: 'children',
    userSpecifiedValues: children.every((child) => child.userSpecifiedValues),
    knownWorkingDays: sum(children.map((c) => c.knownWorkingDays)),
    knownCompletedWorkingDays: sum(children.map((c) => c.knownCompletedWorkingDays)),
    averagedWorkingDays: sum(children.map((c) => c.averagedWorkingDays)),
    averagedCompletedWorkingDays: sum(children.map((c) => c.averagedCompletedWorkingDays)),
    unsizedIssueKeys: union(...children.map((c) => c.unsizedIssueKeys)),
    byTeam,
  });
}

/** Children's sum, with the parent itself added to the gaps when it has no size. */
function childrenResult<T>(parent: IssueOrRelease<T>, kids: WorkRollup, { metadata }: Context): WorkRollup {
  // only fully-known sums feed the level average (averaged = 0, so known = total)
  if (kids.userSpecifiedValues) {
    metadata.totalDaysOfWorkForAverage.push(kids.knownWorkingDays);
  }
  kids.unsizedIssueKeys = union(kids.unsizedIssueKeys, selfIfUnsized(parent));
  return kids;
}

/** The parent's own size; all of it goes to the parent's team. */
function selfResult<T>(
  issue: IssueOrRelease<T>,
  size: { total: number; completed: number },
  childKeys: string[],
  { metadata }: Context,
): WorkRollup {
  metadata.totalDaysOfWorkForAverage.push(size.total);
  return createWorkRollup({
    source: 'self',
    userSpecifiedValues: true,
    knownWorkingDays: size.total,
    knownCompletedWorkingDays: size.completed,
    unsizedIssueKeys: childKeys,
    byTeam: {
      [teamOf(issue)]: { ...emptyTeamWork(), knownWorkingDays: size.total, knownCompletedWorkingDays: size.completed },
    },
  });
}

/** An issue's own data when it has no size: the level average (later) or nothing. */
function noSizeResult<T>(issueOrRelease: IssueOrRelease<T>, childKeys: string[], context: Context): WorkRollup {
  if (!isDerivedIssue(issueOrRelease)) {
    // a release with no children
    return createWorkRollup({ unsizedIssueKeys: childKeys });
  }
  const team = teamOf(issueOrRelease);
  const unsizedIssueKeys = union(childKeys, [issueOrRelease.key]);
  if (context.missingSize === 'unsized') {
    return createWorkRollup({ source: 'unsized', unsizedIssueKeys, byTeam: { [team]: emptyTeamWork() } });
  }
  // Today an unsized item's completed days are always 0, but they've always been counted as known,
  // so keep them there.
  const completed = ownSize(issueOrRelease)?.completed || 0;
  const rollup = createWorkRollup({
    source: 'average',
    knownWorkingDays: completed,
    knownCompletedWorkingDays: completed,
    unsizedIssueKeys,
    byTeam: { [team]: { ...emptyTeamWork(), knownWorkingDays: completed, knownCompletedWorkingDays: completed } },
  });
  context.metadata.needsAverageSet.push({ rollup, team, done: issueOrRelease.statusCategory === 'Done' });
  return rollup;
}

// ---- rollup ----

/** Children when every child has a size, else the parent's size, else whatever the children have. Today's rule. */
export function childrenFirstThenParent<T>(
  parent: IssueOrRelease<T>,
  children: WorkRollup[],
  context: Context,
): WorkRollup {
  const kids = children.length ? sumChildRollups(children) : null;
  if (kids && kids.userSpecifiedValues) {
    return childrenResult(parent, kids, context);
  }
  const size = ownSize(parent);
  if (hasOwnSize(size)) {
    return selfResult(parent, size, kids?.unsizedIssueKeys ?? [], context);
  }
  if (kids) {
    return childrenResult(parent, kids, context);
  }
  return noSizeResult(parent, [], context);
}

/** The epic's own size, stories ignored ("From parent"). */
export function parentOnly<T>(parent: IssueOrRelease<T>, children: WorkRollup[], context: Context): WorkRollup {
  const childKeys = children.length ? sumChildRollups(children).unsizedIssueKeys : [];
  const size = ownSize(parent);
  return hasOwnSize(size) ? selfResult(parent, size, childKeys, context) : noSizeResult(parent, childKeys, context);
}

/** The children's total whenever there are children ("From children"). */
export function childrenOnly<T>(parent: IssueOrRelease<T>, children: WorkRollup[], context: Context): WorkRollup {
  if (children.length) {
    return childrenResult(parent, sumChildRollups(children), context);
  }
  return parentOnly(parent, children, context);
}

/** The parent's own size when it has one, else its children ("From parent, then children"). */
export function parentFirstThenChildren<T>(
  parent: IssueOrRelease<T>,
  children: WorkRollup[],
  context: Context,
): WorkRollup {
  const size = ownSize(parent);
  if (hasOwnSize(size) || !children.length) {
    return parentOnly(parent, children, context);
  }
  return childrenResult(parent, sumChildRollups(children), context);
}

/** Date rollup setting → work rule. "Earliest to latest" has no size meaning, so it keeps today's rule. */
const PARENT_RULES: Partial<
  Record<CalculationType, <T>(parent: IssueOrRelease<T>, children: WorkRollup[], context: Context) => WorkRollup>
> = {
  parentOnly,
  childrenOnly,
  parentFirstThenChildren,
  childrenFirstThenParent,
  widestRange: childrenFirstThenParent,
};
