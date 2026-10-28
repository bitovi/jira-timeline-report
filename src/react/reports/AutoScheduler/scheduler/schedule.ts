import type { DerivedIssue } from '../../../../jira/derived/derive';

import { partition, indexByKey, groupBy } from '../../../../utils/array/array-helpers';

import type { LinkedIssue } from './link-issues';
import { WorkPlans } from './workplan';
import { computeDeadlines } from './deadlines';

type WorkIssue = {
  linkedIssue: LinkedIssue;
  startDay: number | null;
  daysOfWork: number;
  artificiallyDelayed?: boolean;
};

export function makeWorkIssues(linkedIssues: LinkedIssue[], probablisticallySelectIssueTiming: boolean): WorkIssue[] {
  return linkedIssues.map((issue) => {
    return {
      linkedIssue: issue,
      startDay: null,
      daysOfWork: probablisticallySelectIssueTiming
        ? issue.derivedTiming.probablisticTotalDaysOfWork
        : issue.derivedTiming.deterministicTotalDaysOfWork,
    };
  });
}

export function makeTeamWork(linkedIssues: LinkedIssue[]) {
  const groups = groupBy(linkedIssues, (issue) => issue.team.name);
  const teamWork = Object.keys(groups).map((teamKey) => {
    const issue = groups[teamKey][0];
    return {
      teamKey,
      workPlans: new WorkPlans(issue.team.parallelWorkLimit),
      velocity: issue.team.velocity,
    };
  });
  return indexByKey(teamWork, 'teamKey');
}

type TeamWorkIndex = ReturnType<typeof makeTeamWork>;

export function scheduleIssues(sortedLinkedIssues: LinkedIssue[] /*, probablisticallySelectIssueTiming: boolean*/) {
  // Callers must reset (and, for `findLongestPath`, sample) `daysOfWork` before calling this —
  // resetting again here would silently resample against the critical path already computed from
  // this same iteration's durations. See `runBatch` in monte-carlo.ts.
  const teamWork = makeTeamWork(sortedLinkedIssues);

  const frozen = sortedLinkedIssues.filter((issue) => issue.frozen);
  if (!frozen.length) {
    // Exactly the original algorithm, so a plan with nothing frozen schedules identically.
    sortedLinkedIssues.forEach((issue) => {
      planIssue(issue, teamWork, byBlocksWorkDepth, null);
    });
    return teamWork;
  }

  // spec/044 backward-scheduling.md: frozen items at their dates, then the work upstream of them as
  // late as possible, then everything else forward from the start date.
  reserveFrozen(frozen, teamWork);
  planBackward(frozen, teamWork);
  computeDeadlines(sortedLinkedIssues);

  // Work with a deadline is placed first, so it gets the tracks before unconstrained work.
  const walkedPlaced = new Set<string>();
  [...sortedLinkedIssues].sort(byDeadlineThenDepth).forEach((issue) => {
    planIssue(issue, teamWork, byDeadlineThenDepth, walkedPlaced);
  });
  return teamWork;
}

type IssueOrder = (a: LinkedIssue, b: LinkedIssue) => number;

const byBlocksWorkDepth: IssueOrder = (iA, iB) => iB.blocksWorkDepth - iA.blocksWorkDepth;

const byDeadlineThenDepth: IssueOrder = (iA, iB) => {
  const a = iA.mutableWorkItem.latestFinish ?? Number.POSITIVE_INFINITY;
  const b = iB.mutableWorkItem.latestFinish ?? Number.POSITIVE_INFINITY;
  if (a !== b) return a < b ? -1 : 1;
  return iB.blocksWorkDepth - iA.blocksWorkDepth;
};

/**
 * Pins every frozen item at its full span — including any part before the start date — before
 * anything else is placed, in `(start, key)` order so the track each lands on is stable across
 * iterations.
 */
function reserveFrozen(frozen: LinkedIssue[], teamWork: TeamWorkIndex) {
  const ordered = [...frozen].sort((a, b) => {
    const startA = a.mutableWorkItem.frozenStartDay as number;
    const startB = b.mutableWorkItem.frozenStartDay as number;
    if (startA !== startB) return startA - startB;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  for (const issue of ordered) {
    const work = issue.mutableWorkItem;
    teamWork[issue.team.name].workPlans.reserve(work, work.frozenStartDay as number);
  }
}

const byBlockedByWorkDepth: IssueOrder = (iA, iB) => iB.blockedByWorkDepth - iA.blockedByWorkDepth;

/** The frozen and backward items an item must finish before; forward items it blocks just wait. */
function constrainingSuccessors(issue: LinkedIssue) {
  return issue.linkedBlocks.filter(
    (blocked) => blocked.scheduleDirection === 'frozen' || blocked.scheduleDirection === 'backward',
  );
}

/**
 * The mirror of the forward pass: walk upstream from each frozen item (latest first) and place each
 * backward item as late as it can go once everything it must finish before is placed. Siblings
 * with the longest upstream chain go first, mirroring `blocksWorkDepth` going forward.
 */
function planBackward(frozen: LinkedIssue[], teamWork: TeamWorkIndex) {
  const visit = (issue: LinkedIssue) => {
    [...issue.linkedBlockedBy].sort(byBlockedByWorkDepth).forEach(tryPlace);
  };
  const tryPlace = (issue: LinkedIssue) => {
    if (issue.scheduleDirection !== 'backward' || issue.mutableWorkItem.startDay != null) return;
    const successors = constrainingSuccessors(issue);
    if (successors.some((successor) => successor.mutableWorkItem.startDay == null)) return;
    const latestFinish = Math.min(...successors.map((successor) => successor.mutableWorkItem.startDay as number));
    teamWork[issue.team.name].workPlans.scheduleWorkBackward(issue.mutableWorkItem, latestFinish);
    visit(issue);
  };
  [...frozen]
    .sort((a, b) => (b.mutableWorkItem.frozenStartDay as number) - (a.mutableWorkItem.frozenStartDay as number))
    .forEach(visit);
}

// This function tries to plan an issue.
// It is recursive. It will plan the issue and then try to plan everything the issue
// blocks.
function planIssue(
  issue: LinkedIssue,
  workByTeams: TeamWorkIndex,
  order: IssueOrder,
  walkedPlaced: Set<string> | null,
) {
  // Frozen and backward items were placed before the forward pass and never move, but their
  // dependents still need planning. Walk them once, however many routes lead here.
  if (issue.scheduleDirection !== 'forward') {
    if (walkedPlaced!.has(issue.key)) return;
    walkedPlaced!.add(issue.key);
    [...issue.linkedBlocks].sort(order).forEach((block) => planIssue(block, workByTeams, order, walkedPlaced));
    return;
  }

  // Has everything that blocks this work already been scheduled?
  if (areAllBlockersScheduled(issue)) {
    // schedule
    if (issue.mutableWorkItem.startDay == null) {
      // Look at each blocker and get the first date when all blockers will be done
      var firstDayWorkCouldStartOn = earliestStartTimeFromBlockers(issue);

      /*console.log(new Array(firstDayWorkCouldStartOn).join(" "),
              issue.blocksWorkDepth,
              issue.work.daysOfWork,
              issue.Summary,
              "rescheduled");*/

      // Try to place this work in the first place the team could absorb it.
      scheduleIssue(issue, firstDayWorkCouldStartOn, workByTeams);

      if (issue.linkedBlocks) {
        // this sorting can probably be done earlier, once for deterministic plans
        [...issue.linkedBlocks].sort(order).forEach((block) => planIssue(block, workByTeams, order, walkedPlaced));
      }
    }
  } else {
    // If there is a blocker that hasn't been scheduled, we will wait on the blocker
    // to be scheduled.  It will then recurse to this issue and schedule it.
  }
}

// Try to find the first available time  the work could be scheduled for this team.
function scheduleIssue(linkedIssue: LinkedIssue, firstDayWorkCouldStartOn: number, teamWorkIndex: TeamWorkIndex) {
  var team = teamWorkIndex[linkedIssue.team.name];
  //if(work.issue["Issue key"] === "YUMPOS-4131") {
  //	debugger;
  //}

  const latestFinish = linkedIssue.mutableWorkItem.latestFinish;
  if (latestFinish !== undefined && latestFinish !== Number.POSITIVE_INFINITY) {
    team.workPlans.scheduleWorkWithDeadline(linkedIssue.mutableWorkItem, firstDayWorkCouldStartOn, latestFinish);
  } else {
    team.workPlans.sheduleWork(linkedIssue.mutableWorkItem, firstDayWorkCouldStartOn);
  }
  //console.log(new Array(Math.ceil(work.startDay / 2)).join(" "), work.startDay, work.issue.Summary)
}

// Start day is set on everything
function areAllBlockersScheduled(linkedIssue: LinkedIssue) {
  return linkedIssue.linkedBlockedBy.every((issue) => issue.mutableWorkItem.startDay != null);
}

function earliestStartTimeFromBlockers(issue: LinkedIssue) {
  return issue.linkedBlockedBy.reduce((prev, blocker) => {
    if (blocker.mutableWorkItem.startDay == null) {
      const error = new Error('Unable to calculate, no startDay');
      //@ts-ignore
      error.data = { issue, blocker };
      throw error;
    }
    return Math.max(prev, blocker.mutableWorkItem.startDay + blocker.mutableWorkItem.daysOfWork);
  }, 0);
}
