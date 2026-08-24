export interface PathWorkItem {
  daysOfWork: number;
}

/**
 * The minimum shape `findLongestPath` needs. `LinkedIssue` satisfies it structurally, but keeping
 * the interface narrow means tests can build graphs without constructing `DerivedIssue` fixtures.
 */
export interface PathIssue {
  key: string;
  mutableWorkItem: PathWorkItem;
  /** Issues this one blocks — i.e. successors in the dependency graph. */
  linkedBlocks: PathIssue[];
}

export interface LongestPath {
  /** Issue keys in dependency order, from the start of the chain to the end. */
  keys: string[];
  /** `days[i]` is `keys[i]`'s sampled duration on this run. Sums to `totalDays`. */
  days: number[];
  totalDays: number;
}

/** A fresh object each time, because callers own what they are handed and `keys` is mutable. */
const emptyPath = (): LongestPath => ({ keys: [], days: [], totalDays: 0 });

/**
 * Finds the longest chain of `Blocks` links, weighted by each issue's current
 * `mutableWorkItem.daysOfWork`. Team capacity is deliberately ignored: this answers "how long
 * would this plan take if nothing ever waited for a free track", which is the quantity the
 * critical-path report decomposes. See spec/024-critical-path/dependency-floor.md.
 *
 * Runs in O(V + E) per call via memoisation, which matters because it runs once per Monte Carlo
 * iteration (10,000 times per simulation).
 */
export function findLongestPath(issues: PathIssue[]): LongestPath {
  if (issues.length === 0) return emptyPath();

  // Longest total duration of any chain that *starts* at this issue, including its own days.
  const forwardDays = new Map<string, number>();
  // The successor to step to in order to realise that longest chain.
  const nextIssue = new Map<string, PathIssue | null>();
  const inProgress = new Set<string>();

  function visit(issue: PathIssue): number {
    const memo = forwardDays.get(issue.key);
    if (memo !== undefined) return memo;

    // A cycle means the `Blocks` links in Jira contradict each other. There is no longest path
    // through a cycle, so we stop the walk here rather than hang the simulation.
    if (inProgress.has(issue.key)) return 0;
    inProgress.add(issue.key);

    let best: PathIssue | null = null;
    let bestDays = 0;
    for (const successor of issue.linkedBlocks) {
      const days = visit(successor);
      const better = best === null || days > bestDays || (days === bestDays && successor.key < best.key);
      if (better) {
        best = successor;
        bestDays = days;
      }
    }

    inProgress.delete(issue.key);
    const total = issue.mutableWorkItem.daysOfWork + (best === null ? 0 : bestDays);
    forwardDays.set(issue.key, total);
    nextIssue.set(issue.key, best);
    return total;
  }

  let start: PathIssue | null = null;
  let startDays = -1;
  for (const issue of issues) {
    const days = visit(issue);
    const better = start === null || days > startDays || (days === startDays && issue.key < start.key);
    if (better) {
      start = issue;
      startDays = days;
    }
  }

  if (start === null) return emptyPath();

  const keys: string[] = [];
  const days: number[] = [];
  let totalDays = 0;
  const walked = new Set<string>();
  let current: PathIssue | null = start;
  while (current !== null && !walked.has(current.key)) {
    walked.add(current.key);
    keys.push(current.key);
    days.push(current.mutableWorkItem.daysOfWork);
    totalDays += current.mutableWorkItem.daysOfWork;
    current = nextIssue.get(current.key) ?? null;
  }

  return { keys, days, totalDays };
}
