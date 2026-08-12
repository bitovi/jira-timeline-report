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

export type HopType = 'dependency' | 'root';

export interface Hop {
  issueKey: string;
  /** Whether this issue was reached from a blocker (`dependency`) or ended the walk (`root`). */
  hopType: HopType;
  workDays: number;
  /**
   * `startDay − earliestStartFromBlockers` — the gap between this issue being unblocked and its
   * team's track having room. Non-zero exactly when the scheduler pushed it past its
   * blocker-ready date, i.e. when it queued behind other work in this plan.
   */
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
    if (end !== bestEnd) return end > bestEnd ? blocker : best;
    // Deterministic tiebreak, so the trace doesn't jitter run to run on equal end days.
    return blocker.key < best.key ? blocker : best;
  });
}

/**
 * Walks backward from `startIssue` (the last-finishing item in a single Monte Carlo iteration)
 * along blocker links, taking the blocker that finished last at each step, and stops at an issue
 * with no blockers.
 *
 * Each hop records the days that issue spent working and the days it spent queued behind other
 * work in this plan. Because an issue starts either exactly when its last blocker ended or later,
 * work + queued along the chain sums to the elapsed time the chain covers.
 *
 * The walk deliberately does *not* step sideways onto the team track when an issue was capacity
 * delayed. Doing so pulled unrelated epics onto the chain — and their whole upstream lineage with
 * them — which is why nearly every epic in a large plan reported ~100% criticality. Capacity delay
 * is reported as the delayed issue's own `queuedDays`, not as extra chain members. See
 * spec/024-critical-path/issues-and-concerns.md #1.
 */
export function traceDrivingChain(startIssue: TraceLinkedIssue): Hop[] {
  const hops: Hop[] = [];
  const visited = new Set<string>();
  let current: TraceLinkedIssue | null = startIssue;

  while (current && !visited.has(current.key)) {
    visited.add(current.key);
    const work = current.mutableWorkItem;
    const queuedDays = Math.max(0, work.startDay - earliestStartFromBlockers(current));

    if (current.linkedBlockedBy.length > 0) {
      hops.push({ issueKey: current.key, hopType: 'dependency', workDays: work.daysOfWork, queuedDays });
      current = argmaxBlockerByEndDay(current.linkedBlockedBy);
    } else {
      hops.push({ issueKey: current.key, hopType: 'root', workDays: work.daysOfWork, queuedDays });
      current = null;
    }
  }

  return hops;
}
