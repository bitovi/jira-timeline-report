import type { DerivedIssue } from '../../../../jira/derived/derive';
import type { LinkedIssue } from './link-issues';

import { resetLinkedIssue, linkIssues } from './link-issues';
import { scheduleIssues } from './schedule';
import { traceDrivingChain, type TraceLinkedIssue, type TraceWorkItem, type TraceNode } from './critical-path-trace';
import { CriticalityAccumulator } from './criticality-accumulator';

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
};

export type BatchDatas = {
  batchIssueData: BatchIssueData[];
  lastDays: number[];
  criticalityAccumulator: CriticalityAccumulator;
};

function buildNodeByWorkItem(teamWork: ReturnType<typeof scheduleIssues>): Map<TraceWorkItem, TraceNode> {
  const nodeByWorkItem = new Map<TraceWorkItem, TraceNode>();
  Object.values(teamWork).forEach((team) => {
    team.workPlans.workNodes().forEach((node) => {
      nodeByWorkItem.set(node.work as TraceWorkItem, node as unknown as TraceNode);
    });
  });
  return nodeByWorkItem;
}

function runBatch(linkedIssues: LinkedIssue[], { batchSize }: { batchSize: number }): BatchDatas {
  const items: BatchIssueData[] = linkedIssues.map((linkedIssue) => ({
    linkedIssue,
    startDays: [],
    dueDays: [],
    daysOfWork: [],
    trackNumbers: [],
  }));

  // Stable across every iteration of this batch — object identity of `mutableWorkItem` never changes,
  // only its properties are reset. Used by the trace to walk from a ScheduledWorkNode's `.work` back to
  // the LinkedIssue that owns it.
  const issueByWorkItem = new Map<TraceWorkItem, TraceLinkedIssue>();
  linkedIssues.forEach((issue) =>
    issueByWorkItem.set(issue.mutableWorkItem as TraceWorkItem, issue as unknown as TraceLinkedIssue),
  );

  const lastDays: number[] = [];
  const criticalityAccumulator = new CriticalityAccumulator();

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
    let lastIssue: LinkedIssue | null = null;

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

      if (dueDay > lastDay) {
        lastDay = dueDay;
        lastIssue = linkedIssue;
      }
    }

    lastDays[i] = lastDay;

    if (lastIssue) {
      const nodeByWorkItem = buildNodeByWorkItem(teamWork);
      const hops = traceDrivingChain(lastIssue as unknown as TraceLinkedIssue, nodeByWorkItem, issueByWorkItem);
      criticalityAccumulator.addIteration(hops);
    }
  }

  return { batchIssueData: items, lastDays, criticalityAccumulator };
}
