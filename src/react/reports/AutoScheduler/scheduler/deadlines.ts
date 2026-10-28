/**
 * The minimum shape the backward pass needs. `LinkedIssue` satisfies it structurally; keeping it
 * narrow lets tests build graphs without `DerivedIssue` fixtures.
 */
export interface DeadlineIssue {
  key: string;
  frozen: unknown | null;
  linkedBlocks: DeadlineIssue[];
  mutableWorkItem: {
    daysOfWork: number;
    /** Frozen only: this iteration's unclipped start. */
    frozenStartDay?: number;
    latestFinish?: number;
    mustStartBy?: number;
  };
}

/**
 * Backward pass over `linkedBlocks`: the day each item must finish by so that every frozen item
 * downstream of it can start on its fixed date. Writes `latestFinish` (and, where it is finite,
 * `mustStartBy`) onto each item's `mutableWorkItem` rather than returning a map, because this runs
 * once per Monte Carlo iteration and a fresh map per run is pure allocation churn.
 *
 * - frozen: `latestFinish = frozenStartDay` — its own deadline, whatever is downstream of it
 * - unfrozen: `min over successors s of (s frozen ? s.frozenStartDay : latestFinish(s) − s.daysOfWork)`,
 *   `+∞` when nothing downstream is frozen
 *
 * Memoised on `latestFinish`, which `resetLinkedIssue` clears, so the pass is O(V + E). The graph is
 * acyclic — `linkIssues` throws on a cycle before a simulation can start.
 */
export function computeDeadlines(issues: DeadlineIssue[]): void {
  for (const issue of issues) {
    latestFinish(issue);
  }
}

function latestFinish(issue: DeadlineIssue): number {
  const work = issue.mutableWorkItem;
  if (work.latestFinish !== undefined) return work.latestFinish;

  if (issue.frozen) {
    return (work.latestFinish = work.frozenStartDay as number);
  }

  let deadline = Number.POSITIVE_INFINITY;
  for (const successor of issue.linkedBlocks) {
    const successorDeadline = successor.frozen
      ? (successor.mutableWorkItem.frozenStartDay as number)
      : latestFinish(successor) - successor.mutableWorkItem.daysOfWork;
    if (successorDeadline < deadline) deadline = successorDeadline;
  }

  work.latestFinish = deadline;
  if (deadline !== Number.POSITIVE_INFINITY) {
    work.mustStartBy = deadline - work.daysOfWork;
  }
  return deadline;
}
