import type { DerivedIssue } from '../../../../jira/derived/derive';
import type { LinkedIssue } from './link-issues';

import { resetLinkedIssue, linkIssues } from './link-issues';
import { scheduleIssues } from './schedule';

export function runMonteCarlo(
  issues: DerivedIssue[],
  {
    onBatch,
    onComplete,
    batchSize = 20,
    batches = 500,
    timeBetweenBatches = 1,
    probabilisticallySelectIssueTiming = true,
  }: {
    onBatch(BatchResults: { batchData: BatchDatas; percentComplete: number }): void;
    onComplete(): void;
    batchSize?: number;
    batches?: number;
    timeBetweenBatches?: number;
    probabilisticallySelectIssueTiming?: boolean;
  },
) {
  // we are going to track the start/due date of each work item in the simulation
  // something else can deal with composing the stats

  // make the issues we will work with
  const linkedIssues = linkIssues(issues, probabilisticallySelectIssueTiming);

  let batchesRemaining = batches;
  const totalSimulations = batchSize * batches;
  function percentComplete() {
    return ((batches - batchesRemaining) / batches) * 100;
  }

  let timer: ReturnType<typeof setTimeout>;
  let torndown = false;

  function runBatchAndLoop() {
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
};

export type BatchDatas = {
  batchIssueData: BatchIssueData[];
  lastDays: number[];
};

function runBatch(linkedIssues: LinkedIssue[], { batchSize }: { batchSize: number }): BatchDatas {
  const items: BatchIssueData[] = linkedIssues.map((linkedIssue) => ({
    linkedIssue,
    startDays: [],
    dueDays: [],
    daysOfWork: [],
    trackNumbers: [],
  }));

  const lastDays: number[] = [];

  for (let i = 0; i < batchSize; i++) {
    // Reset state
    for (const linkedIssue of linkedIssues) {
      resetLinkedIssue(linkedIssue);
    }

    const teamWork = scheduleIssues(linkedIssues);

    Object.values(teamWork).forEach((team) => {
      team.workPlans.plans.forEach((plan, index) => {
        for (const workItem of plan) {
          workItem.work.track = index;
        }
      });
    });

    let lastDay = 0;

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

      lastDay = Math.max(lastDay, dueDay);
    }

    lastDays[i] = lastDay;
  }

  return { batchIssueData: items, lastDays };
}
