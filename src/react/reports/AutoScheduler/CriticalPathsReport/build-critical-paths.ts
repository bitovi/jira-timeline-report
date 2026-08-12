// src/react/reports/AutoScheduler/CriticalPathsReport/build-critical-paths.ts
import type { SimulationIssueResult, StatsUIData } from '../scheduler/stats-analyzer';

export type CriticalPathRow = {
  rootKey: string;
  criticalityIndex: number;
  chain: SimulationIssueResult[];
  totalWorkDays: number;
  totalQueuedDays: number;
  totalDays: number;
  biggestByWork: SimulationIssueResult;
  biggestByQueuedDelay: SimulationIssueResult;
  fanOut: SimulationIssueResult[];
  fanOutTotalDays: number;
};

function byCriticalityIndex(a: SimulationIssueResult, b: SimulationIssueResult): number {
  const critDiff = b.criticalityIndex - a.criticalityIndex;
  if (critDiff !== 0) return critDiff;
  // Tiebreaker: use blocksWorkDepth to ensure blockers come before blocked items
  return (b.linkedIssue.blocksWorkDepth || 0) - (a.linkedIssue.blocksWorkDepth || 0);
}

function biggestBy(
  items: SimulationIssueResult[],
  value: (item: SimulationIssueResult) => number,
): SimulationIssueResult {
  return items.reduce((best, item) => (value(item) > value(best) ? item : best));
}

function addFanOut(
  fanOut: Map<string, SimulationIssueResult>,
  candidates: SimulationIssueResult[],
  excludedKeys: Set<string>,
  keyToWorkItem: Record<string, SimulationIssueResult>,
) {
  candidates.forEach((workItem) => {
    const key = workItem.linkedIssue.key;
    if (excludedKeys.has(key)) return;
    excludedKeys.add(key);
    if (!fanOut.has(key)) {
      fanOut.set(key, workItem);
      const nextBlocks = (workItem.linkedIssue.linkedBlocks || [])
        .map((link: { key: string }) => keyToWorkItem[link.key])
        .filter(Boolean)
        .sort(byCriticalityIndex);
      addFanOut(fanOut, nextBlocks, excludedKeys, keyToWorkItem);
    }
  });
}

function buildChain(
  root: SimulationIssueResult,
  excludedKeys: Set<string>,
  keyToWorkItem: Record<string, SimulationIssueResult>,
): { chain: SimulationIssueResult[]; fanOut: SimulationIssueResult[] } {
  const chain: SimulationIssueResult[] = [root];
  const fanOut = new Map<string, SimulationIssueResult>();
  let current = root;

  while (true) {
    const candidates = (current.linkedIssue.linkedBlocks || [])
      .map((link: { key: string }) => keyToWorkItem[link.key])
      .filter((workItem) => workItem && !excludedKeys.has(workItem.linkedIssue.key))
      .sort(byCriticalityIndex);
    if (!candidates.length) break;

    const [next, ...rest] = candidates;
    chain.push(next);
    excludedKeys.add(next.linkedIssue.key);
    addFanOut(fanOut, rest, excludedKeys, keyToWorkItem);
    current = next;
  }

  return { chain, fanOut: Array.from(fanOut.values()) };
}

export function buildCriticalPaths(uiData: StatsUIData): CriticalPathRow[] {
  const keyToWorkItem: Record<string, SimulationIssueResult> = {};
  uiData.simulationIssueResults.forEach((item) => {
    keyToWorkItem[item.linkedIssue.key] = item;
  });

  const sortedRoots = [...uiData.simulationIssueResults].sort(byCriticalityIndex);
  const excludedKeys = new Set<string>();
  const rows: CriticalPathRow[] = [];

  for (const candidate of sortedRoots) {
    const key = candidate.linkedIssue.key;
    if (excludedKeys.has(key)) continue;
    excludedKeys.add(key);

    const { chain, fanOut } = buildChain(candidate, excludedKeys, keyToWorkItem);

    const totalWorkDays = chain.reduce((sum, wi) => sum + wi.meanWorkDays, 0);
    const totalQueuedDays = chain.reduce((sum, wi) => sum + wi.meanQueuedDays, 0);
    const fanOutTotalDays = fanOut.reduce((sum, wi) => sum + wi.adjustedDaysOfWork, 0);

    rows.push({
      rootKey: key,
      criticalityIndex: candidate.criticalityIndex,
      chain,
      totalWorkDays,
      totalQueuedDays,
      totalDays: totalWorkDays + totalQueuedDays,
      biggestByWork: biggestBy(chain, (wi) => wi.meanWorkDays),
      biggestByQueuedDelay: biggestBy(chain, (wi) => wi.meanQueuedDays),
      fanOut,
      fanOutTotalDays,
    });
  }

  return rows.sort((a, b) => b.criticalityIndex - a.criticalityIndex);
}
