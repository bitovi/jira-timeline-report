import type { DerivedIssue } from '../../../../jira/derived/derive';
import type { LinkedIssue } from './link-issues';

import { resetLinkedIssue, linkIssues } from './link-issues';
import { scheduleIssues } from './schedule';
import { traceDrivingChain, type TraceLinkedIssue } from './critical-path-trace';
import { CriticalityAccumulator } from './criticality-accumulator';
import { findLongestPath } from './longest-path';
import { CriticalPathAccumulator } from './critical-path-accumulator';

export function runMonteCarlo(
  issues: DerivedIssue[],
  {
    onBatch,
    onComplete,
    batchSize = 20,
    batches = 500,
    timeBetweenBatches = 1,
    probabilisticallySelectIssueTiming = true,
    frozenKeys,
    startDate,
  }: {
    onBatch(BatchResults: { batchData: BatchDatas; percentComplete: number }): void;
    onComplete(): void;
    batchSize?: number;
    batches?: number;
    timeBetweenBatches?: number;
    probabilisticallySelectIssueTiming?: boolean;
    /** Issues held at their Jira dates. See spec/044-autoscheduler-frozen-items. */
    frozenKeys?: ReadonlySet<string>;
    /** Day 0 of the plan; frozen items' Jira dates are converted to offsets from it. */
    startDate?: Date;
  },
) {
  // we are going to track the start/due date of each work item in the simulation
  // something else can deal with composing the stats

  // make the issues we will work with
  const linkedIssues = linkIssues(issues, probabilisticallySelectIssueTiming, { frozenKeys, startDate });

  let batchesRemaining = batches;
  const totalSimulations = batchSize * batches;
  function percentComplete() {
    return ((batches - batchesRemaining) / batches) * 100;
  }

  let timer: ReturnType<typeof setTimeout>;
  let torndown = false;

  function runBatchAndLoop() {
    // Bail out if this simulation was torn down (e.g. config changed and a new
    // simulation started). `clearTimeout` handles the pending timer, but a batch
    // callback already dequeued from the event loop can't be canceled that way —
    // this guard stops it from posting stale results or rescheduling itself.
    if (torndown) return;
    const batchData = runBatch(linkedIssues, { batchSize });
    batchesRemaining--;
    onBatch({ batchData, percentComplete: percentComplete() });
    if (batchesRemaining > 0) {
      timer = setTimeout(runBatchAndLoop, timeBetweenBatches);
    } else {
      onComplete();
    }
  }

  function teardown() {
    torndown = true;
    clearTimeout(timer);
  }

  return { linkedIssues, runBatchAndLoop, teardown };
}

export type BatchIssueData = {
  linkedIssue: LinkedIssue;
  startDays: number[];
  dueDays: number[];
  daysOfWork: number[];
  trackNumbers: number[];
  /** Only iterations where the item had a finite deadline from a frozen item downstream. */
  mustStartByDays: number[];
  /** Iterations where it finished after a frozen item it directly blocks was due to start. */
  lateForFrozenCount: number;
  /** Iterations where it started before the start date (day 0). */
  beforeStartCount: number;
};

export type BatchDatas = {
  batchIssueData: BatchIssueData[];
  lastDays: number[];
  /** Per iteration, the earliest start of any non-frozen item, capped at 0 — when work has to begin. */
  firstStartDays: number[];
  criticalityAccumulator: CriticalityAccumulator;
  criticalPathAccumulator: CriticalPathAccumulator;
};

function runBatch(linkedIssues: LinkedIssue[], { batchSize }: { batchSize: number }): BatchDatas {
  const items: BatchIssueData[] = linkedIssues.map((linkedIssue) => ({
    linkedIssue,
    startDays: [],
    dueDays: [],
    daysOfWork: [],
    trackNumbers: [],
    mustStartByDays: [],
    lateForFrozenCount: 0,
    beforeStartCount: 0,
  }));
  const firstStartDays: number[] = [];
  const anyFrozen = linkedIssues.some((issue) => issue.frozen);

  const lastDays: number[] = [];
  const criticalityAccumulator = new CriticalityAccumulator();
  const criticalPathAccumulator = new CriticalPathAccumulator();

  for (let i = 0; i < batchSize; i++) {
    // Reset state
    for (const linkedIssue of linkedIssues) {
      resetLinkedIssue(linkedIssue);
    }

    // Runs on the freshly sampled durations and before scheduling, because the critical path
    // deliberately ignores team capacity — it is the finish this plan would reach if nothing ever
    // waited for a free track. See spec/024-critical-path/dependency-floor.md.
    //
    // Unconditional. It has to happen here — `onBatch` sorts each epic's `daysOfWork` independently,
    // which destroys the per-iteration alignment this needs — and measured overhead is ~13% of a
    // batch (36ms/287ms/605ms on a 10,000-run simulation at 50/200/500 epics). Gating it behind a
    // flag would mean re-running the whole simulation to switch on, which costs 100% instead.
    criticalPathAccumulator.addIteration(findLongestPath(linkedIssues));

    // Schedules against these same samples — `scheduleIssues` must not reset `daysOfWork` again,
    // or the critical path above and the scheduled finish below would be drawn from different runs.
    const teamWork = scheduleIssues(linkedIssues);

    Object.values(teamWork).forEach((team) => {
      team.workPlans.plans.forEach((plan, index) => {
        for (const workItem of plan) {
          workItem.work.track = index;
        }
      });
    });

    let lastDay = 0;
    let lastIssue: LinkedIssue | null = null;
    let firstStartDay = Number.POSITIVE_INFINITY;

    for (let li = 0; li < linkedIssues.length; li++) {
      const linkedIssue = linkedIssues[li];
      const workItem = linkedIssue.mutableWorkItem;
      const startDay = workItem.startDay as number;
      const daysOfWork = workItem.daysOfWork;
      const dueDay = startDay + daysOfWork;

      items[li].startDays.push(startDay);
      items[li].daysOfWork.push(daysOfWork);
      items[li].dueDays.push(dueDay);
      items[li].trackNumbers.push(workItem.track as number);

      if (anyFrozen) {
        // For backward work the bar's own start already is the must-start date.
        if (workItem.mustStartBy !== undefined && linkedIssue.scheduleDirection === 'forward') {
          items[li].mustStartByDays.push(workItem.mustStartBy);
        }
        if (isLateForFrozen(linkedIssue)) {
          items[li].lateForFrozenCount++;
        }
        if (startDay < 0) {
          items[li].beforeStartCount++;
        }
        if (!linkedIssue.frozen && startDay < firstStartDay) {
          firstStartDay = startDay;
        }
      }

      if (dueDay > lastDay) {
        lastDay = dueDay;
        lastIssue = linkedIssue;
      }
    }

    lastDays[i] = lastDay;
    // Capped at day 0: a run whose first work starts after the start date needed no early start,
    // and that is all this distribution answers. Its exact late start would only scatter noise.
    firstStartDays[i] = Math.min(0, firstStartDay);

    if (lastIssue) {
      const hops = traceDrivingChain(lastIssue as unknown as TraceLinkedIssue);
      criticalityAccumulator.addIteration(hops);
    }
  }

  return { batchIssueData: items, lastDays, firstStartDays, criticalityAccumulator, criticalPathAccumulator };
}

/** The item's end, unclipped for frozen items, so one that ends before the plan still compares correctly. */
function endDay(issue: LinkedIssue): number {
  const work = issue.mutableWorkItem;
  return issue.frozen ? (work.frozenDueDay as number) : (work.startDay as number) + work.daysOfWork;
}

/** True when this item ends after a frozen item it directly blocks is due to start. */
export function isLateForFrozen(issue: LinkedIssue): boolean {
  let end: number | null = null;
  for (const blocked of issue.linkedBlocks) {
    if (!blocked.frozen) continue;
    end ??= endDay(issue);
    if (end > (blocked.mutableWorkItem.frozenStartDay as number)) return true;
  }
  return false;
}
