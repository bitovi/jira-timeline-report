// src/react/reports/AutoScheduler/CriticalPathsReport/build-critical-paths.test.ts
import { describe, it, expect } from 'vitest';
import { buildCriticalPaths } from './build-critical-paths';
import type { SimulationIssueResult, StatsUIData } from '../scheduler/stats-analyzer';

function issue(overrides: Partial<SimulationIssueResult> & { key: string }): SimulationIssueResult {
  return {
    linkedIssue: {
      key: overrides.key,
      summary: overrides.key,
      url: `#${overrides.key}`,
      linkedBlocks: [],
      blocksWorkDepth: 0,
    },
    adjustedDaysOfWork: 5,
    criticalityIndex: 0,
    meanWorkDays: 0,
    meanQueuedDays: 0,
    ...overrides,
  } as unknown as SimulationIssueResult;
}

describe('buildCriticalPaths', () => {
  it('builds one row per root epic, ranked by criticality index, with a fan-out of everything else it blocks', () => {
    // C -> blocks -> B -> blocks -> A (chain), and C also blocks D (the fan-out).
    const d = issue({
      key: 'D',
      linkedIssue: { key: 'D', summary: 'D', url: '#D', linkedBlocks: [], blocksWorkDepth: 0 } as any,
    });
    const a = issue({
      key: 'A',
      criticalityIndex: 0.9,
      meanWorkDays: 10,
      meanQueuedDays: 1,
      linkedIssue: { key: 'A', summary: 'A', url: '#A', linkedBlocks: [], blocksWorkDepth: 0 } as any,
    });
    const b = issue({
      key: 'B',
      criticalityIndex: 0.9,
      meanWorkDays: 6,
      meanQueuedDays: 0,
      linkedIssue: { key: 'B', summary: 'B', url: '#B', linkedBlocks: [{ key: 'A' }], blocksWorkDepth: 1 } as any,
    });
    const c = issue({
      key: 'C',
      criticalityIndex: 0.9,
      meanWorkDays: 4,
      meanQueuedDays: 2,
      linkedIssue: {
        key: 'C',
        summary: 'C',
        url: '#C',
        linkedBlocks: [{ key: 'B' }, { key: 'D' }],
        blocksWorkDepth: 2,
      } as any,
    });

    const uiData = { simulationIssueResults: [d, a, b, c] } as unknown as StatsUIData;

    const rows = buildCriticalPaths(uiData);

    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.rootKey).toBe('C');
    expect(row.chain.map((wi) => wi.linkedIssue.key)).toEqual(['C', 'B', 'A']);
    expect(row.fanOut.map((wi) => wi.linkedIssue.key)).toEqual(['D']);
    expect(row.totalWorkDays).toBe(20); // 10 + 6 + 4
    // C is the first epic on the chain, so its own 2 queued days sit before the span starts.
    expect(row.totalQueuedDays).toBe(1); // B's 0 + A's 1
    expect(row.totalDays).toBe(21);
    expect(row.biggestByWork.linkedIssue.key).toBe('A'); // 10 work days is the largest
    expect(row.biggestByQueuedDelay.linkedIssue.key).toBe('C'); // 2 queued days is the largest
  });

  it('ranks rows by criticality index, descending', () => {
    const low = issue({
      key: 'LOW',
      criticalityIndex: 0.1,
      linkedIssue: { key: 'LOW', summary: 'LOW', url: '#LOW', linkedBlocks: [], blocksWorkDepth: 0 } as any,
    });
    const high = issue({
      key: 'HIGH',
      criticalityIndex: 0.8,
      linkedIssue: { key: 'HIGH', summary: 'HIGH', url: '#HIGH', linkedBlocks: [], blocksWorkDepth: 0 } as any,
    });
    const uiData = { simulationIssueResults: [low, high] } as unknown as StatsUIData;

    const rows = buildCriticalPaths(uiData);

    expect(rows.map((r) => r.rootKey)).toEqual(['HIGH', 'LOW']);
  });
});
