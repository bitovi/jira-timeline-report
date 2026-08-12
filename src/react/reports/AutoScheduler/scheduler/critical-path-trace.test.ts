import { describe, it, expect } from 'vitest';
import { traceDrivingChain, earliestStartFromBlockers, type TraceLinkedIssue } from './critical-path-trace';

function makeIssue(key: string, startDay: number, daysOfWork: number, artificiallyDelayed = false): TraceLinkedIssue {
  return {
    key,
    mutableWorkItem: { startDay, daysOfWork, artificiallyDelayed },
    linkedBlockedBy: [],
  };
}

describe('earliestStartFromBlockers', () => {
  it('is 0 with no blockers', () => {
    const issue = makeIssue('A', 0, 5);
    expect(earliestStartFromBlockers(issue)).toBe(0);
  });

  it('is the max end day across blockers', () => {
    const blockerA = makeIssue('B1', 0, 3); // ends day 3
    const blockerB = makeIssue('B2', 0, 7); // ends day 7
    const issue = makeIssue('A', 7, 2);
    issue.linkedBlockedBy = [blockerA, blockerB];
    expect(earliestStartFromBlockers(issue)).toBe(7);
  });
});

describe('traceDrivingChain', () => {
  it('does not pull an unrelated track neighbour onto the chain', () => {
    // Same team, one track: B finishes day 5, A starts day 5 with nothing blocking it. A only
    // waited for the track, so the delay is A's queued time — B is not part of A's chain.
    const trackPredecessor = makeIssue('B', 0, 5);
    const startIssue = makeIssue('A', 5, 4, true);

    const hops = traceDrivingChain(startIssue);

    expect(hops).toEqual([{ issueKey: 'A', hopType: 'root', workDays: 4, queuedDays: 5 }]);
    expect(hops.some((hop) => hop.issueKey === trackPredecessor.key)).toBe(false);
  });

  it('follows a dependency hop to the blocker with the latest end day', () => {
    const earlyBlocker = makeIssue('B1', 0, 3); // ends day 3
    const lateBlocker = makeIssue('B2', 0, 6); // ends day 6 — this is the real driver
    const startIssue = makeIssue('A', 6, 2, false); // starts exactly when its last blocker ends
    startIssue.linkedBlockedBy = [earlyBlocker, lateBlocker];

    const hops = traceDrivingChain(startIssue);

    expect(hops).toEqual([
      { issueKey: 'A', hopType: 'dependency', workDays: 2, queuedDays: 0 },
      { issueKey: 'B2', hopType: 'root', workDays: 6, queuedDays: 0 },
    ]);
  });

  it('breaks ties between equal end days by issue key', () => {
    const blockerZ = makeIssue('Z', 0, 4);
    const blockerA = makeIssue('A', 0, 4);
    const startIssue = makeIssue('T', 4, 1);
    startIssue.linkedBlockedBy = [blockerZ, blockerA];

    expect(traceDrivingChain(startIssue).map((hop) => hop.issueKey)).toEqual(['T', 'A']);
  });

  it('reports queued days when a blocked issue started later than its blockers required', () => {
    // A's blockers were all done by day 2, but its team's track wasn't free until day 10.
    const blocker = makeIssue('C', 0, 2);
    const startIssue = makeIssue('A', 10, 3, true);
    startIssue.linkedBlockedBy = [blocker];

    expect(traceDrivingChain(startIssue)[0]).toEqual({
      issueKey: 'A',
      hopType: 'dependency',
      workDays: 3,
      queuedDays: 8,
    });
  });

  it('reports queued days for a capacity-delayed issue that has no blockers at all', () => {
    // The common real-world case: an unlinked epic that simply sat behind its team's other work.
    // Measuring queued only against blockers would report 0 here and hide the whole delay.
    expect(traceDrivingChain(makeIssue('A', 12, 3, true))[0].queuedDays).toBe(12);
  });

  it('work and queued days sum to the elapsed time the chain covers', () => {
    const root = makeIssue('R', 0, 5); // days 0–5
    const middle = makeIssue('M', 9, 4); // unblocked at 5, started at 9 → 4 queued
    middle.linkedBlockedBy = [root];
    const tip = makeIssue('T', 13, 2); // unblocked at 13, started at 13 → 0 queued
    tip.linkedBlockedBy = [middle];

    const hops = traceDrivingChain(tip);
    const total = hops.reduce((sum, hop) => sum + hop.workDays + hop.queuedDays, 0);

    expect(total).toBe(15); // tip ends day 15, root starts day 0
  });

  it('stops at a root issue with no blockers', () => {
    expect(traceDrivingChain(makeIssue('A', 0, 4))).toEqual([
      { issueKey: 'A', hopType: 'root', workDays: 4, queuedDays: 0 },
    ]);
  });

  it('does not loop forever if the blocker graph has a cycle', () => {
    const a = makeIssue('A', 5, 1);
    const b = makeIssue('B', 0, 5);
    a.linkedBlockedBy = [b];
    b.linkedBlockedBy = [a];

    expect(traceDrivingChain(a).map((hop) => hop.issueKey)).toEqual(['A', 'B']);
  });
});
