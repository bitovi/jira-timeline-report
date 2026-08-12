export interface TraceWorkItem {
  startDay: number;
  daysOfWork: number;
  artificiallyDelayed: boolean;
}

export interface TraceLinkedIssue {
  key: string;
  mutableWorkItem: TraceWorkItem;
  linkedBlockedBy: TraceLinkedIssue[];
}

export interface TraceNode {
  work: TraceWorkItem;
  previous: TraceNode | null;
}

export type HopType = 'capacity' | 'dependency' | 'root';

export interface Hop {
  issueKey: string;
  hopType: HopType;
  workDays: number;
  queuedDays: number;
}

/** The earliest day this issue could have started, given only its blockers (ignores team capacity). */
export function earliestStartFromBlockers(issue: TraceLinkedIssue): number {
  return issue.linkedBlockedBy.reduce((prev, blocker) => {
    return Math.max(prev, blocker.mutableWorkItem.startDay + blocker.mutableWorkItem.daysOfWork);
  }, 0);
}

function argmaxBlockerByEndDay(blockers: TraceLinkedIssue[]): TraceLinkedIssue {
  return blockers.reduce((best, blocker) => {
    const bestEnd = best.mutableWorkItem.startDay + best.mutableWorkItem.daysOfWork;
    const end = blocker.mutableWorkItem.startDay + blocker.mutableWorkItem.daysOfWork;
    return end > bestEnd ? blocker : best;
  });
}

/**
 * Walks backward from `startIssue` (typically the last-finishing item in a single Monte Carlo
 * iteration), classifying each hop as a capacity hop (the item's own team track was busy) or a
 * dependency hop (the item started exactly when its blockers allowed). Stops at a "root" hop: an
 * issue with no blockers and no track predecessor. See spec/024-critical-path/README.md, "The fix:
 * trace the driving chain per iteration".
 */
export function traceDrivingChain(
  startIssue: TraceLinkedIssue,
  nodeByWorkItem: Map<TraceWorkItem, TraceNode>,
  issueByWorkItem: Map<TraceWorkItem, TraceLinkedIssue>,
): Hop[] {
  const hops: Hop[] = [];
  const visited = new Set<string>();
  let current: TraceLinkedIssue | null = startIssue;

  while (current && !visited.has(current.key)) {
    visited.add(current.key);
    const work = current.mutableWorkItem;
    // queuedDays only counts if there were blockers to wait for; otherwise it's 0
    const queuedDays =
      current.linkedBlockedBy.length > 0 ? Math.max(0, work.startDay - earliestStartFromBlockers(current)) : 0;
    const workDays = work.daysOfWork;

    if (work.artificiallyDelayed) {
      const node = nodeByWorkItem.get(work);
      const previousWork = node?.previous?.work ?? null;
      const next = previousWork ? (issueByWorkItem.get(previousWork) ?? null) : null;
      hops.push({ issueKey: current.key, hopType: next ? 'capacity' : 'root', workDays, queuedDays });
      current = next;
    } else if (current.linkedBlockedBy.length > 0) {
      hops.push({ issueKey: current.key, hopType: 'dependency', workDays, queuedDays });
      current = argmaxBlockerByEndDay(current.linkedBlockedBy);
    } else {
      hops.push({ issueKey: current.key, hopType: 'root', workDays, queuedDays });
      current = null;
    }
  }

  return hops;
}
