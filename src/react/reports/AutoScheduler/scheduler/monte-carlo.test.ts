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
});
