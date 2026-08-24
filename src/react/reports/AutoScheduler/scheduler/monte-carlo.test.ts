import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { DerivedIssue } from '../../../../jira/derived/derive';
import { runMonteCarlo } from './monte-carlo';

// The scheduler pipeline (linkIssues → scheduleIssues → runBatch) all handle an empty
// issue set, so we can exercise the batch-loop / teardown control flow without building
// DerivedIssue fixtures.
const noIssues = [] as unknown as DerivedIssue[];

describe('runMonteCarlo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs every batch and calls onComplete once when left to finish', () => {
    const onBatch = vi.fn();
    const onComplete = vi.fn();
    const batches = 5;

    const { runBatchAndLoop } = runMonteCarlo(noIssues, {
      onBatch,
      onComplete,
      batches,
      batchSize: 1,
      timeBetweenBatches: 1,
    });

    runBatchAndLoop();
    vi.advanceTimersByTime(batches * 2); // enough for every scheduled batch to fire

    expect(onBatch).toHaveBeenCalledTimes(batches);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('stops the scheduled loop after teardown() and never calls onComplete', () => {
    const onBatch = vi.fn();
    const onComplete = vi.fn();

    const { runBatchAndLoop, teardown } = runMonteCarlo(noIssues, {
      onBatch,
      onComplete,
      batches: 5,
      batchSize: 1,
      timeBetweenBatches: 1,
    });

    runBatchAndLoop(); // runs the first batch and schedules the next
    expect(onBatch).toHaveBeenCalledTimes(1);

    teardown();
    vi.advanceTimersByTime(1000); // give any remaining timers a chance to fire

    expect(onBatch).toHaveBeenCalledTimes(1); // no further batches ran
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('does not run a batch when invoked after teardown (guards an already-queued callback)', () => {
    const onBatch = vi.fn();
    const onComplete = vi.fn();

    const { runBatchAndLoop, teardown } = runMonteCarlo(noIssues, {
      onBatch,
      onComplete,
      batches: 5,
      batchSize: 1,
      timeBetweenBatches: 1,
    });

    teardown();
    // Simulate a timer callback that was already dequeued from the event loop when
    // teardown() ran — clearTimeout can't cancel it, so the torndown guard must.
    runBatchAndLoop();

    expect(onBatch).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('records one critical path iteration per run', () => {
    const onBatch = vi.fn();
    const onComplete = vi.fn();

    const { runBatchAndLoop } = runMonteCarlo(noIssues, {
      onBatch,
      onComplete,
      batches: 1,
      batchSize: 3,
      timeBetweenBatches: 1,
    });

    runBatchAndLoop();

    const { batchData } = onBatch.mock.calls[0][0];
    expect(batchData.criticalPathAccumulator.iterations).toBe(3);
    expect(batchData.criticalPathAccumulator.meanPathLength()).toBe(0); // no issues, no path
  });
});

function makeTeam(name: string) {
  return { name, parallelWorkLimit: 1, velocity: 1, pointsPerDayPerTrack: 1 } as DerivedIssue['team'];
}

function makeDerivedIssue(overrides: Partial<DerivedIssue> & { key: string }): DerivedIssue {
  return {
    key: overrides.key,
    parentKey: null,
    team: makeTeam('team-a'),
    derivedTiming: {
      deterministicTotalDaysOfWork: 5,
      probablisticTotalDaysOfWork: 5,
      isConfidenceValid: false,
      usedConfidence: 0,
      isStoryPointsValid: false,
      defaultOrStoryPoints: 0,
      storyPointsDaysOfWork: 0,
      isStoryPointsMedianValid: false,
      defaultOrStoryPointsMedian: 0,
      storyPointsMedianDaysOfWork: 0,
      deterministicExtraPoints: 0,
      deterministicExtraDaysOfWork: 0,
      deterministicTotalPoints: 0,
      probablisticExtraPoints: 0,
      probablisticExtraDaysOfWork: 0,
      probablisticTotalPoints: 0,
      hasStartAndDueDate: false,
      startAndDueDateDaysOfWork: null,
      hasSprintStartAndEndDate: false,
      sprintDaysOfWork: null,
      sprintStartData: null,
      endSprintData: null,
      totalDaysOfWork: null,
      defaultOrTotalDaysOfWork: null,
      completedDaysOfWork: 0,
      datesCompletedDaysOfWork: 0,
      datesDaysOfWork: null,
      estimatedDaysOfWork: null,
    },
    issue: { fields: { 'Linked Issues': [] } },
    type: 'Epic',
    ...overrides,
  } as unknown as DerivedIssue;
}

describe('runBatch criticality accumulation (via runMonteCarlo)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accumulates a criticality index for every issue across a batch', () => {
    // Two issues, same team (parallelWorkLimit: 1, so one track): B blocks A. Every iteration, A is
    // the last-finishing item and the trace should walk backward through the dependency hop to B.
    const blocker: DerivedIssue = makeDerivedIssue({ key: 'B' });
    const blocked: DerivedIssue = makeDerivedIssue({
      key: 'A',
      issue: { fields: { 'Linked Issues': [{ type: { name: 'Blocks' }, outwardIssue: { key: 'B' } }] } },
    } as any);

    const onBatch = vi.fn();
    const { runBatchAndLoop } = runMonteCarlo([blocked, blocker], {
      onBatch,
      onComplete: vi.fn(),
      batches: 1,
      batchSize: 10,
      timeBetweenBatches: 1,
      probabilisticallySelectIssueTiming: false,
    });

    runBatchAndLoop();
    vi.advanceTimersByTime(10);

    expect(onBatch).toHaveBeenCalledTimes(1);
    const { batchData } = onBatch.mock.calls[0][0];
    expect(batchData.criticalityAccumulator.iterations).toBe(10);
    expect(batchData.criticalityAccumulator.criticalityIndex('A')).toBe(1);
    expect(batchData.criticalityAccumulator.criticalityIndex('B')).toBe(1);
  });

  it('does not mark every epic sharing a busy team track as critical', () => {
    // spec/024-critical-path/issues-and-concerns.md #1: twelve completely unlinked epics on one
    // one-track team. Each iteration has exactly one last-finishing epic and there are no
    // dependency links at all, so exactly one epic can be on the driving lineage per iteration —
    // the other eleven are only what it queued behind. Criticality across all of them must
    // therefore total one iteration's worth, not twelve.
    const issues = Array.from({ length: 12 }, (_, i) => makeDerivedIssue({ key: `LEAF-${i}` }));

    const onBatch = vi.fn();
    const { runBatchAndLoop } = runMonteCarlo(issues, {
      onBatch,
      onComplete: vi.fn(),
      batches: 1,
      batchSize: 10,
      timeBetweenBatches: 1,
    });

    runBatchAndLoop();
    vi.advanceTimersByTime(10);

    const { batchData } = onBatch.mock.calls[0][0];
    const acc = batchData.criticalityAccumulator;
    const indexes = issues.map((issue) => acc.criticalityIndex(issue.key));

    expect(indexes.reduce((sum, index) => sum + index, 0)).toBeCloseTo(1);
    expect(indexes.filter((index) => index === 1).length).toBeLessThanOrEqual(1);
  });

  it('attributes a purely capacity-driven delay as queued time', () => {
    // Same twelve unlinked epics: whichever one finishes last waited behind the rest of the track,
    // so the driving chain has to report queued days even though nothing blocks anything.
    const issues = Array.from({ length: 12 }, (_, i) => makeDerivedIssue({ key: `LEAF-${i}` }));

    const onBatch = vi.fn();
    const { runBatchAndLoop } = runMonteCarlo(issues, {
      onBatch,
      onComplete: vi.fn(),
      batches: 1,
      batchSize: 10,
      timeBetweenBatches: 1,
    });

    runBatchAndLoop();
    vi.advanceTimersByTime(10);

    const { batchData } = onBatch.mock.calls[0][0];
    const acc = batchData.criticalityAccumulator;
    const totalQueued = issues.reduce((sum, issue) => sum + acc.meanQueuedDays(issue.key), 0);

    expect(totalQueued).toBeGreaterThan(0);
  });
});

describe('runBatch critical path accumulation (via runMonteCarlo)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('walks the blocking chain and keeps days added additive against the path length', () => {
    // A is blocked by B, so every iteration's longest chain is B → A regardless of the sampled
    // durations. Both epics share a one-track team, but the critical path ignores that entirely.
    const blocker: DerivedIssue = makeDerivedIssue({ key: 'B' });
    const blocked: DerivedIssue = makeDerivedIssue({
      key: 'A',
      issue: { fields: { 'Linked Issues': [{ type: { name: 'Blocks' }, outwardIssue: { key: 'B' } }] } },
    } as any);

    const onBatch = vi.fn();
    const { runBatchAndLoop } = runMonteCarlo([blocked, blocker], {
      onBatch,
      onComplete: vi.fn(),
      batches: 1,
      batchSize: 10,
      timeBetweenBatches: 1,
    });

    runBatchAndLoop();
    vi.advanceTimersByTime(10);

    const { batchData } = onBatch.mock.calls[0][0];
    const acc = batchData.criticalPathAccumulator;

    expect(acc.iterations).toBe(10);
    expect(acc.onPathIndex('A')).toBe(1);
    expect(acc.onPathIndex('B')).toBe(1);
    expect(acc.topPaths(1)[0].keys).toEqual(['A', 'B']);
    // The identity the whole report rests on: per-epic days added sum to the mean path length.
    expect(acc.daysAdded('A') + acc.daysAdded('B')).toBeCloseTo(acc.meanPathLength(), 10);
  });

  it('ignores team contention, so the critical path is at most the scheduled finish', () => {
    // Twelve unlinked epics on one one-track team. Nothing blocks anything, so the longest chain is
    // a single epic, while the schedule has to queue all twelve end to end.
    const issues = Array.from({ length: 12 }, (_, i) => makeDerivedIssue({ key: `LEAF-${i}` }));

    const onBatch = vi.fn();
    const { runBatchAndLoop } = runMonteCarlo(issues, {
      onBatch,
      onComplete: vi.fn(),
      batches: 1,
      batchSize: 10,
      timeBetweenBatches: 1,
    });

    runBatchAndLoop();
    vi.advanceTimersByTime(10);

    const { batchData } = onBatch.mock.calls[0][0];
    const acc = batchData.criticalPathAccumulator;
    const meanScheduledFinish = batchData.lastDays.reduce((sum: number, day: number) => sum + day, 0) / 10;

    expect(acc.topPaths(1)[0].keys).toHaveLength(1);
    expect(acc.meanPathLength()).toBeLessThan(meanScheduledFinish);
  });
});
