import { describe, it, expect } from 'vitest';
import {
  traceDrivingChain,
  earliestStartFromBlockers,
  type TraceLinkedIssue,
  type TraceWorkItem,
} from './critical-path-trace';

function makeIssue(key: string, startDay: number, daysOfWork: number, artificiallyDelayed = false): TraceLinkedIssue {
  return {
    key,
    mutableWorkItem: { startDay, daysOfWork, artificiallyDelayed },
    linkedBlockedBy: [],
  };
}

function nodeMapFrom(chainInStartOrder: TraceLinkedIssue[]) {
  // Builds a same-team single-track node chain: chainInStartOrder[0] is earliest on the track.
  const nodeByWorkItem = new Map<TraceWorkItem, { work: TraceWorkItem; previous: { work: TraceWorkItem } | null }>();
  let previous: { work: TraceWorkItem } | null = null;
  for (const issue of chainInStartOrder) {
    const node = { work: issue.mutableWorkItem, previous };
    nodeByWorkItem.set(issue.mutableWorkItem, node);
    previous = node;
  }
  return nodeByWorkItem;
}

function issueMapFrom(issues: TraceLinkedIssue[]) {
  const issueByWorkItem = new Map<TraceWorkItem, TraceLinkedIssue>();
  issues.forEach((issue) => issueByWorkItem.set(issue.mutableWorkItem, issue));
  return issueByWorkItem;
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
  it('follows a capacity hop to the track predecessor', () => {
    // Same team, one track: B finishes day 5, A starts day 5 with no blockers — but marked
    // artificiallyDelayed because the track, not a dependency, is what pushed it.
    const trackPredecessor = makeIssue('B', 0, 5);
    const startIssue = makeIssue('A', 5, 4, true);
    const nodeByWorkItem = nodeMapFrom([trackPredecessor, startIssue]);
    const issueByWorkItem = issueMapFrom([trackPredecessor, startIssue]);

    const hops = traceDrivingChain(startIssue, nodeByWorkItem, issueByWorkItem);

    expect(hops).toEqual([
      { issueKey: 'A', hopType: 'capacity', workDays: 4, queuedDays: 0 },
      { issueKey: 'B', hopType: 'root', workDays: 5, queuedDays: 0 },
    ]);
  });

  it('follows a dependency hop to the blocker with the latest end day', () => {
    const earlyBlocker = makeIssue('B1', 0, 3); // ends day 3
    const lateBlocker = makeIssue('B2', 0, 6); // ends day 6 — this is the real driver
    const startIssue = makeIssue('A', 6, 2, false); // starts exactly when its last blocker ends
    startIssue.linkedBlockedBy = [earlyBlocker, lateBlocker];
    const nodeByWorkItem = nodeMapFrom([]); // no track predecessor involved
    const issueByWorkItem = issueMapFrom([earlyBlocker, lateBlocker, startIssue]);

    const hops = traceDrivingChain(startIssue, nodeByWorkItem, issueByWorkItem);

    expect(hops).toEqual([
      { issueKey: 'A', hopType: 'dependency', workDays: 2, queuedDays: 0 },
      { issueKey: 'B2', hopType: 'root', workDays: 6, queuedDays: 0 },
    ]);
  });

  it('reports queued days when a capacity-delayed issue started later than its blockers required', () => {
    const trackPredecessor = makeIssue('B', 0, 10); // ends day 10
    // A's blockers were all done by day 2, but the track wasn't free until day 10.
    const blocker = makeIssue('C', 0, 2);
    const startIssue = makeIssue('A', 10, 3, true);
    startIssue.linkedBlockedBy = [blocker];
    const nodeByWorkItem = nodeMapFrom([trackPredecessor, startIssue]);
    const issueByWorkItem = issueMapFrom([trackPredecessor, blocker, startIssue]);

    const hops = traceDrivingChain(startIssue, nodeByWorkItem, issueByWorkItem);

    expect(hops[0]).toEqual({ issueKey: 'A', hopType: 'capacity', workDays: 3, queuedDays: 8 });
  });

  it('stops at a root issue with no blockers and no track predecessor', () => {
    const startIssue = makeIssue('A', 0, 4);
    const hops = traceDrivingChain(startIssue, nodeMapFrom([]), issueMapFrom([startIssue]));
    expect(hops).toEqual([{ issueKey: 'A', hopType: 'root', workDays: 4, queuedDays: 0 }]);
  });

  it('does not loop forever if the graph has a cycle', () => {
    const a = makeIssue('A', 5, 1, true);
    const b = makeIssue('B', 0, 5, true);
    // A's track predecessor is B, and (pathologically) B's track predecessor is A.
    const nodeByWorkItem = new Map<TraceWorkItem, { work: TraceWorkItem; previous: { work: TraceWorkItem } | null }>();
    const nodeA = { work: a.mutableWorkItem, previous: null as { work: TraceWorkItem } | null };
    const nodeB = { work: b.mutableWorkItem, previous: null as { work: TraceWorkItem } | null };
    nodeA.previous = nodeB;
    nodeB.previous = nodeA;
    nodeByWorkItem.set(a.mutableWorkItem, nodeA);
    nodeByWorkItem.set(b.mutableWorkItem, nodeB);
    const issueByWorkItem = issueMapFrom([a, b]);

    const hops = traceDrivingChain(a, nodeByWorkItem, issueByWorkItem);

    expect(hops.map((h) => h.issueKey)).toEqual(['A', 'B']);
  });
});
