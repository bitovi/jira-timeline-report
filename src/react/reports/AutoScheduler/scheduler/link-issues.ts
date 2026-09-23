import type { DerivedIssue } from '../../../../jira/derived/derive';

import { partition, indexByKey, groupBy } from '../../../../utils/array/array-helpers';
import { getEstimationData } from '../../../../jira/derived/work-timing/work-timing';
import { getBlocksKeys } from '../../../../jira/linked-issue/blocks-links';

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
  readonly mutableWorkItem: {
    daysOfWork: number;
    startDay: number | null;
    artificiallyDelayed?: boolean;
    track?: number;
  };
};
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

export function linkIssues(issues: DerivedIssue[], probablisticallySelectIssueTiming: boolean): LinkedIssue[] {
  const clones = issues.map((issue) => {
    return {
      linkedChildren: [],
      linkedParent: null,
      linkedBlocks: [],
      linkedBlockedBy: [],
      blocksWorkDepth: -1,
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

export function resetLinkedIssue(issue: LinkedIssue) {
  issue.mutableWorkItem.artificiallyDelayed = undefined;
  issue.mutableWorkItem.startDay = null;
  issue.mutableWorkItem.daysOfWork = getEstimationData(issue, {}).probablisticTotalDaysOfWork;
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
