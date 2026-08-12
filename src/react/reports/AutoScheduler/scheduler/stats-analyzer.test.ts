import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DerivedIssue } from '../../../../jira/derived/derive';
import { StatsAnalyzer } from './stats-analyzer';

function makeTeam(name: string) {
  return { name, parallelWorkLimit: 1, velocity: 1, pointsPerDayPerTrack: 1 } as DerivedIssue['team'];
}

function makeDerivedIssue(overrides: Partial<DerivedIssue> & { key: string }): DerivedIssue {
  return {
    parentKey: null,
    team: makeTeam('team-a'),
    derivedTiming: { deterministicTotalDaysOfWork: 5, probablisticTotalDaysOfWork: 5 },
    issue: { fields: { 'Linked Issues': [] } },
    type: 'Epic',
    ...overrides,
  } as unknown as DerivedIssue;
}

describe('StatsAnalyzer criticality fields', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('adds criticalityIndex, meanWorkDays, meanQueuedDays to every simulation issue result', () => {
    const blocker = makeDerivedIssue({ key: 'B' });
    const blocked = makeDerivedIssue({
      key: 'A',
      issue: { fields: { 'Linked Issues': [{ type: { name: 'Blocks' }, outwardIssue: { key: 'B' } }] } },
    } as any);

    let latestUIData: any = null;
    const analyzer = new StatsAnalyzer({
      issues: [blocked, blocker],
      uncertaintyWeight: 'average',
      setUIState: (data) => {
        latestUIData = data;
      },
    });

    vi.advanceTimersByTime(2000); // enough for the default batch count to finish
    analyzer.teardown();

    expect(latestUIData).not.toBeNull();
    const results = latestUIData.simulationIssueResults;
    const byKey = Object.fromEntries(results.map((r: any) => [r.linkedIssue.key, r]));

    expect(byKey['A'].criticalityIndex).toBeGreaterThan(0);
    expect(byKey['B'].criticalityIndex).toBeGreaterThan(0);
    expect(typeof byKey['A'].meanWorkDays).toBe('number');
    expect(typeof byKey['A'].meanQueuedDays).toBe('number');
  });
});
