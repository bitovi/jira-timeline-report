import type { DerivedIssue } from '../../../../jira/derived/derive';

import { partition, indexByKey, groupBy } from '../../../../utils/array/array-helpers';
import { getEstimationData } from '../../../../jira/derived/work-timing/work-timing';
import { getBlocksKeys } from '../../../../jira/linked-issue/blocks-links';
import { jiraDayOffsets } from './business-day-offset';

type Mutable<T> = {
  -readonly [P in keyof T]: T[P] extends ReadonlyArray<infer U>
    ? MutableArray<U>
    : T[P] extends object
      ? Mutable<T[P]>
      : T[P];
};
type MutableArray<T> = Array<Mutable<T>>;

type LinkedIssueBuilder = Mutable<LinkedIssue>;

export type LinkedIssue = DerivedIssue & {
  readonly linkedChildren: LinkedIssue[];
  readonly linkedParent: LinkedIssue | null;
  readonly linkedBlocks: LinkedIssue[];
  readonly linkedBlockedBy: LinkedIssue[];
  readonly blocksWorkDepth: number;
  /**
   * Set when the user froze this issue at its Jira dates. Business-day offsets from the plan start
   * (`selectedStartDate`), possibly negative; `dueDay` is exclusive. At least one is non-null.
   */
  readonly frozen: FrozenOffsets | null;
  /**
   * How the scheduler places this item (spec/044 backward-scheduling.md): `frozen` at its Jira
   * dates, `backward` as late as possible before the frozen items downstream of it, otherwise
   * `forward` from the start date.
   */
  readonly scheduleDirection: ScheduleDirection;
  /** Own days plus the longest chain of blockers upstream — the mirror of `blocksWorkDepth`. */
  readonly blockedByWorkDepth: number;
  readonly mutableWorkItem: {
    daysOfWork: number;
    startDay: number | null;
    artificiallyDelayed?: boolean;
    track?: number;
    /** Frozen only: this iteration's start/due, which can be before day 0. */
    frozenStartDay?: number;
    frozenDueDay?: number;
    /** The day this work must finish by so every frozen item downstream of it can start on time. */
    latestFinish?: number;
    mustStartBy?: number;
  };
};

export type FrozenOffsets = { startDay: number | null; dueDay: number | null };

export type ScheduleDirection = 'frozen' | 'backward' | 'forward';

export type LinkIssuesOptions = {
  /** Keys the user froze. Keys not in `issues`, or whose issue has no Jira dates, are ignored. */
  frozenKeys?: ReadonlySet<string>;
  /** The plan's day 0. Only read when something is frozen. */
  startDate?: Date;
};

/** An issue can be frozen when Jira gives it a start or a due date (fields, falling back to sprints). */
export function canFreeze(issue: Pick<DerivedIssue, 'derivedTiming'>): boolean {
  return Boolean(issue.derivedTiming?.start || issue.derivedTiming?.due);
}
type LinkedIssueBuilderIndex = Record<string, LinkedIssueBuilder>;
type LinkedIssueIndex = Record<string, LinkedIssue>;

export type BlocksCycleIssue = { key: string; summary: string; url: string };

/** Thrown when the `Blocks` graph contains a cycle — the links contradict each other, so there is
 * no well-defined schedule. Carries the chain so the UI can name the issues that need fixing. */
export class BlocksCycleError extends Error {
  readonly cycle: BlocksCycleIssue[];
  constructor(cycle: BlocksCycleIssue[]) {
    super(`Contradictory "Blocks" links form a cycle: ${cycle.map((issue) => issue.key).join(' \u2192 ')}`);
    this.name = 'BlocksCycleError';
    this.cycle = cycle;
  }
}

export function linkIssues(
  issues: DerivedIssue[],
  probablisticallySelectIssueTiming: boolean,
  { frozenKeys, startDate }: LinkIssuesOptions = {},
): LinkedIssue[] {
  const clones = issues.map((issue) => {
    return {
      linkedChildren: [],
      linkedParent: null,
      linkedBlocks: [],
      linkedBlockedBy: [],
      blocksWorkDepth: -1,
      blockedByWorkDepth: -1,
      scheduleDirection: 'forward',
      frozen:
        frozenKeys?.has(issue.key) && startDate && canFreeze(issue)
          ? jiraDayOffsets(startDate, issue.derivedTiming)
          : null,
      mutableWorkItem: {
        daysOfWork: issue.derivedTiming.deterministicTotalDaysOfWork,
        startDay: null,
      },
      //daysOfWork:
      ...issue,
    };
  }) as LinkedIssueBuilder[];

  const issueByKey = indexByKey(clones, 'key');

  linkParentAndChildren(clones, issueByKey);
  linkDirectBlocks(clones, issueByKey);

  const cycle = findBlocksCycle(clones);
  if (cycle) {
    throw new BlocksCycleError(cycle.map((issue) => ({ key: issue.key, summary: issue.summary, url: issue.url })));
  }

  clones.forEach(setBlocksWorkDepthDeterministically);
  clones.forEach(setBlockedByWorkDepthDeterministically);
  assignScheduleDirections(clones);
  clones.sort((iA, iB) => iB.blocksWorkDepth - iA.blocksWorkDepth);

  return clones as LinkedIssue[];
}

/** Depth-first search over `linkedBlocks`, returning the first cycle found as the ordered chain of
 * issues that closes the loop (last entry repeats the first), or `null` if the graph is acyclic. */
function findBlocksCycle(issues: LinkedIssueBuilder[]): LinkedIssueBuilder[] | null {
  const visited = new Set<string>();
  const onStack = new Set<string>();
  const stack: LinkedIssueBuilder[] = [];

  function visit(issue: LinkedIssueBuilder): LinkedIssueBuilder[] | null {
    if (visited.has(issue.key)) return null;
    if (onStack.has(issue.key)) {
      const start = stack.findIndex((stacked) => stacked.key === issue.key);
      return [...stack.slice(start), issue];
    }
    onStack.add(issue.key);
    stack.push(issue);
    for (const blocked of issue.linkedBlocks) {
      const cycle = visit(blocked);
      if (cycle) return cycle;
    }
    stack.pop();
    onStack.delete(issue.key);
    visited.add(issue.key);
    return null;
  }

  for (const issue of issues) {
    const cycle = visit(issue);
    if (cycle) return cycle;
  }
  return null;
}

/**
 * Prepares an issue for one scheduling run. Without `quantile` each length is a fresh random sample
 * (one Monte Carlo iteration); with it, every length is that percentile of its distribution, for
 * the plan pass in plan.ts.
 */
export function resetLinkedIssue(issue: LinkedIssue, quantile?: number) {
  const work = issue.mutableWorkItem;
  work.artificiallyDelayed = undefined;
  work.startDay = null;

  work.latestFinish = undefined;
  work.mustStartBy = undefined;

  const length = () =>
    quantile === undefined
      ? getEstimationData(issue, {}).probablisticTotalDaysOfWork
      : getEstimationData(issue, { uncertaintyWeight: quantile }).deterministicTotalDaysOfWork;

  const frozen = issue.frozen;
  if (!frozen) {
    work.daysOfWork = length();
    return;
  }

  // Dates held fixed are not randomised; a missing date is filled in from this iteration's length.
  let start: number, due: number;
  if (frozen.startDay != null && frozen.dueDay != null) {
    start = frozen.startDay;
    due = Math.max(frozen.dueDay, frozen.startDay);
  } else {
    const sampled = length();
    if (frozen.startDay != null) {
      start = frozen.startDay;
      due = start + sampled;
    } else {
      due = frozen.dueDay as number;
      start = due - sampled;
    }
  }
  work.frozenStartDay = start;
  work.frozenDueDay = due;
  // The whole span takes capacity, including any part before the start date.
  work.daysOfWork = due - start;
}

// `findBlocksCycle` in `linkIssues` guarantees the graph is acyclic before this ever runs, so it
// doesn't need its own cycle guard.
function setBlocksWorkDepthDeterministically(issue: LinkedIssueBuilder): number {
  if (issue.blocksWorkDepth !== -1) {
    return issue.blocksWorkDepth;
  }
  if (!issue.linkedBlocks.length) {
    return (issue.blocksWorkDepth = issue.derivedTiming.deterministicTotalDaysOfWork);
  } else {
    return (issue.blocksWorkDepth =
      issue.derivedTiming.deterministicTotalDaysOfWork +
      issue.linkedBlocks.reduce((max, issue) => {
        return Math.max(max, setBlocksWorkDepthDeterministically(issue));
      }, 0));
  }
}

function setBlockedByWorkDepthDeterministically(issue: LinkedIssueBuilder): number {
  if (issue.blockedByWorkDepth !== -1) {
    return issue.blockedByWorkDepth;
  }
  return (issue.blockedByWorkDepth =
    issue.derivedTiming.deterministicTotalDaysOfWork +
    issue.linkedBlockedBy.reduce((max, blocker) => Math.max(max, setBlockedByWorkDepthDeterministically(blocker)), 0));
}

/**
 * Backward = not downstream of any frozen item, and blocks a frozen or backward item. Defined that
 * way rather than "upstream of a frozen item" so a backward item's deadline never depends on a
 * forward item placed after it (X → Y → frozen, with Y after another frozen item, leaves X forward,
 * with a deadline through Y). It also means a backward item's blockers are always backward.
 */
function assignScheduleDirections(issues: LinkedIssueBuilder[]) {
  const frozen = issues.filter((issue) => issue.frozen);
  if (!frozen.length) return;

  const downstream = new Set<string>();
  const markDownstream = (issue: LinkedIssueBuilder) => {
    for (const blocked of issue.linkedBlocks) {
      if (downstream.has(blocked.key)) continue;
      downstream.add(blocked.key);
      markDownstream(blocked);
    }
  };
  frozen.forEach(markDownstream);

  const isBackward = new Map<string, boolean>();
  const backward = (issue: LinkedIssueBuilder): boolean => {
    const memo = isBackward.get(issue.key);
    if (memo !== undefined) return memo;
    const result =
      !issue.frozen &&
      !downstream.has(issue.key) &&
      issue.linkedBlocks.some((blocked) => blocked.frozen || backward(blocked));
    isBackward.set(issue.key, result);
    return result;
  };

  for (const issue of issues) {
    issue.scheduleDirection = issue.frozen ? 'frozen' : backward(issue) ? 'backward' : 'forward';
  }
}

function linkParentAndChildren(issues: LinkedIssueBuilder[], issueByKey: LinkedIssueBuilderIndex) {
  const issuesByParentKey = groupBy(issues, (issue) => issue.parentKey || '');

  for (let parentKey in issuesByParentKey) {
    if (parentKey) {
      const issue = issueByKey[parentKey];
      const children = issuesByParentKey[parentKey];
      if (issue) {
        issue.linkedChildren = children;
        //@ts-ignore
        children.forEach((child) => (child.linkedParent = issue));
      } else {
        //console.log("Unable to find epic", epicKey, "perhaps it is marked as done but has an issue not done");
      }
    }
  }
}

function linkDirectBlocks(issues: LinkedIssueBuilder[], issueByKey: LinkedIssueBuilderIndex) {
  issues.forEach((issue) => {
    const issueBlocks = getBlocksKeys(issue.issue.fields['Linked Issues'])
      .filter((blockedKey) => {
        const blocked = issueByKey[blockedKey];
        if (blocked && blocked.type !== issue.type) {
          console.log(issue.type, issue.summary, 'is blocking', blocked.type, blocked.summary, '. This is ignored');
          return false;
        } else {
          return true;
        }
      })
      .map((blockKey) => {
        return issueByKey[blockKey];
      })
      // we might want to warn about missing blocked issues
      .filter((blockedIssue) => blockedIssue);

    issue.linkedBlocks = issueBlocks;

    issue.linkedBlocks.forEach((blocker) => {
      blocker.linkedBlockedBy.push(issue);
    });
  });
}
