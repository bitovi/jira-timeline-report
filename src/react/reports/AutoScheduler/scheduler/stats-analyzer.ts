import type { DerivedIssue } from '../../../../jira/derived/derive';
import { runMonteCarlo } from './monte-carlo';

import type { BatchDatas, BatchIssueData } from './monte-carlo';

import type { LinkedIssue } from './link-issues';
import { linkIssues } from './link-issues';
import { calibratePlan } from './plan';
import type { Plan, PlannedItem } from './plan';

import { computeLogSpread } from './log-spread';
import { CriticalityAccumulator } from './criticality-accumulator';
import { CriticalPathAccumulator } from './critical-path-accumulator';

import {
  insertSortedArrayInPlace,
  average,
  mostCommonNumber,
  last,
  groupBy,
} from '../../../../utils/array/array-helpers';

// TODO: could this be some simple interface?
export type UncertaintyWeight = number | 'average';
export type StatsUIData = ReturnType<StatsAnalyzer['dataForUI']>;
export type MinimalSimulationIssueResult = StatsUIData['endDaySimulationResult'];
export type SimulationIssueResult = StatsUIData['simulationIssueResults'][number];

export type SimulationData = BatchIssueData & {
  sourceIssue: DerivedIssue;
  linkedIssue: LinkedIssue;
};

export type MinimalSimulationIssue = {
  linkedIssue: {
    summary: string;
    key: string;
  };
  startDays: number[];
  dueDays: number[];
  daysOfWork: number[];
  trackNumbers: number[];
};

export class StatsAnalyzer {
  simulationIssues: SimulationData[];
  lastDays: number[];
  /** Sorted. Per iteration, when the plan's first non-frozen item started; negative before day 0. */
  firstStartDays: number[] = [];
  percentComplete: number;
  uncertaintyWeight: number | 'average';
  setUIState: (data: StatsUIData) => void;
  _teardown: () => void;
  criticalityAccumulator = new CriticalityAccumulator();
  criticalPathAccumulator = new CriticalPathAccumulator();
  iterations = 0;
  /** A separate copy for the plan pass, which must not touch the simulation's mutable work items. */
  planIssues: LinkedIssue[];
  planCache?: {
    plan: Plan;
    uncertaintyWeight: UncertaintyWeight;
    ownDue: Map<string, number>;
    start: number;
    final: boolean;
  };
  constructor({
    issues,
    uncertaintyWeight,
    setUIState,
    frozenKeys,
    startDate,
  }: {
    issues: DerivedIssue[];
    uncertaintyWeight: number | 'average';
    setUIState: (data: StatsUIData) => void;
    frozenKeys?: ReadonlySet<string>;
    startDate?: Date;
  }) {
    const { linkedIssues, runBatchAndLoop, teardown } = runMonteCarlo(issues, {
      onBatch: this.onBatch.bind(this),
      onComplete: this.onComplete.bind(this),
      frozenKeys,
      startDate,
    });
    this._teardown = teardown;
    this.planIssues = linkIssues(issues, false, { frozenKeys, startDate });
    // initialize data for each linkedIssue
    this.simulationIssues = linkedIssues.map((linkedIssue, i) => {
      return {
        sourceIssue: issues[i],
        linkedIssue,
        startDays: [],
        dueDays: [],
        daysOfWork: [],
        trackNumbers: [],
        mustStartByDays: [],
        lateForFrozenCount: 0,
        beforeStartCount: 0,
      };
    });
    this.lastDays = [];
    this.percentComplete = 0;
    this.uncertaintyWeight = uncertaintyWeight;
    this.setUIState = setUIState;
    runBatchAndLoop();
  }
  updateUncertaintyWeight(uncertaintyWeight: number | 'average') {
    if (this.uncertaintyWeight !== uncertaintyWeight) {
      this.uncertaintyWeight = uncertaintyWeight;
      this.setUIState(this.dataForUI());
    }
  }

  onBatch({ batchData, percentComplete }: { batchData: BatchDatas; percentComplete: number }) {
    this.percentComplete = percentComplete;

    for (let i = 0; i < this.simulationIssues.length; i++) {
      const simulationIssue = this.simulationIssues[i];
      const batchForIssue = batchData.batchIssueData[i];
      insertSortedArrayInPlace(simulationIssue.daysOfWork, batchForIssue.daysOfWork);
      insertSortedArrayInPlace(simulationIssue.dueDays, batchForIssue.dueDays);
      insertSortedArrayInPlace(simulationIssue.startDays, batchForIssue.startDays);
      insertSortedArrayInPlace(simulationIssue.trackNumbers, batchForIssue.trackNumbers);
      insertSortedArrayInPlace(simulationIssue.mustStartByDays, batchForIssue.mustStartByDays);
      simulationIssue.lateForFrozenCount += batchForIssue.lateForFrozenCount;
      simulationIssue.beforeStartCount += batchForIssue.beforeStartCount;
    }
    this.iterations += batchData.lastDays.length;
    insertSortedArrayInPlace(this.lastDays, batchData.lastDays);
    insertSortedArrayInPlace(this.firstStartDays, batchData.firstStartDays);
    this.criticalityAccumulator.merge(batchData.criticalityAccumulator);
    this.criticalPathAccumulator.merge(batchData.criticalPathAccumulator);

    this.setUIState(this.dataForUI());
  }
  onComplete() {
    this.percentComplete = 100;
    this.setUIState(this.dataForUI());
  }
  dataForUI() {
    const endDaySimulation: MinimalSimulationIssue = {
      linkedIssue: {
        summary: 'Overall timing',
        key: '[~DUE DATE~]',
      },
      // Each run's earliest start, so the row's start histogram is the plan's start distribution.
      startDays: this.firstStartDays.length ? this.firstStartDays : [0],
      dueDays: this.lastDays,
      daysOfWork: [0],
      trackNumbers: [0],
    };

    const endDaySimulationResult = getUncertaintyThresholdData(endDaySimulation, this.uncertaintyWeight);
    const planStart = planStartAtWeight(this.firstStartDays, this.uncertaintyWeight);

    // Each item's own numbers at the slider, then the plan calibrated against their finishes.
    const ownResults = this.simulationIssues.map((simulationIssue) =>
      getUncertaintyThresholdData(simulationIssue, this.uncertaintyWeight),
    );
    const ownDue = new Map<string, number>();
    this.simulationIssues.forEach((simulationIssue, i) => {
      if (simulationIssue.linkedIssue.scheduleDirection === 'forward') {
        ownDue.set(simulationIssue.linkedIssue.key, ownResults[i].dueDayTop);
      }
    });
    const plan = this.planFor(ownDue, planStart.startDay);

    const simulationIssueResults = this.simulationIssues.map((simulationIssue, i) => {
      const key = simulationIssue.linkedIssue.key;
      const result = applyPlan(ownResults[i], plan.items.get(key), {
        backward: simulationIssue.linkedIssue.scheduleDirection === 'backward',
      });
      return {
        ...result,
        mustStartByDay: mustStartByAtWeight(simulationIssue.mustStartByDays, this.uncertaintyWeight),
        lateForFrozenPercent: this.iterations ? (simulationIssue.lateForFrozenCount / this.iterations) * 100 : 0,
        beforeStartPercent: this.iterations ? (simulationIssue.beforeStartCount / this.iterations) * 100 : 0,
        isOverflowTrack: result.track >= simulationIssue.linkedIssue.team.parallelWorkLimit,
        // Filled in per team below; needs every frozen item on the team.
        overlapInfo: undefined as OverlapInfo | undefined,
        criticalityIndex: this.criticalityAccumulator.criticalityIndex(key),
        meanWorkDays: this.criticalityAccumulator.meanWorkDays(key),
        meanQueuedDays: this.criticalityAccumulator.meanQueuedDays(key),
        sequencingDaysAdded: this.criticalPathAccumulator.daysAdded(key),
        sequencingCriticalityIndex: this.criticalPathAccumulator.onPathIndex(key),
      };
    });

    // Multiplicative spread of the whole-plan completion distribution, reported alongside the
    // per-issue confidences. `lastDays` is kept sorted ascending.
    const planSpread = computeLogSpread(this.lastDays);

    // lets get it ready for teams ...
    const teamGroups = groupBy(
      simulationIssueResults,
      (simulationIssueResult) => simulationIssueResult.linkedIssue.team.name,
    );
    const teams = Object.entries(teamGroups).map(([teamName, simulationIssueResults]) => {
      const tracks = groupByTrack(withOverlapInfo(simulationIssueResults));
      const firstIssue = last(tracks[0]);
      return {
        team: teamName,
        teamData: firstIssue.linkedIssue.team,
        // The level of the issues being scheduled, which is the level a capacity commit targets.
        hierarchyLevel: firstIssue.linkedIssue.hierarchyLevel,
        tracks: tracks,
      };
    });

    // `topPaths` is a thunk, not an array: `dataForUI` runs once per batch and the routes card shows
    // five rows, so sorting the whole path map here would throw away 499 of every 500 results.
    const criticalPath = {
      meanLength: this.criticalPathAccumulator.meanPathLength(),
      iterations: this.criticalPathAccumulator.iterations,
      distinctPathCount: this.criticalPathAccumulator.pathCount,
      topPaths: (limit: number) => this.criticalPathAccumulator.topPaths(limit),
    };

    return {
      percentComplete: this.percentComplete,
      uncertaintyWeight: this.uncertaintyWeight,
      endDaySimulationResult,
      // Unconditionally a mean, unlike `endDaySimulationResult`, so it stays comparable to
      // `criticalPath.meanLength` at every slider position.
      meanPlanFinishDays: average(this.lastDays),
      planStart,
      planQuantile: plan.quantile,
      planSpread,
      simulationIssueResults,
      teams,
      criticalPath,
    };
  }
  teardown() {
    this._teardown();
  }
  /**
   * The plan calibrated so the typical item ends on its own finish at the slider (or, with only
   * frozen work and what feeds it, starts when the simulation says work starts). Recalibrated only
   * when the slider changes, any target moves by half a day, or the simulation finishes — a full
   * search is about a dozen scheduler runs, and `dataForUI` runs once per batch.
   */
  planFor(ownDue: Map<string, number>, start: number): Plan {
    const final = this.percentComplete >= 100;
    const cached = this.planCache;
    if (
      cached &&
      cached.uncertaintyWeight === this.uncertaintyWeight &&
      cached.final === final &&
      Math.abs(cached.start - start) < 0.5 &&
      sameTargets(cached.ownDue, ownDue)
    ) {
      return cached.plan;
    }
    const plan = calibratePlan(this.planIssues, {
      ownDue,
      start,
      fallbackQuantile: this.uncertaintyWeight === 'average' ? 50 : this.uncertaintyWeight,
    });
    this.planCache = { plan, uncertaintyWeight: this.uncertaintyWeight, ownDue, start, final };
    return plan;
  }
}
/** True when every item's target is within half a day of the cached one. */
function sameTargets(cached: Map<string, number>, next: Map<string, number>): boolean {
  if (cached.size !== next.size) return false;
  for (const [key, due] of next) {
    const before = cached.get(key);
    if (before === undefined || Math.abs(before - due) >= 0.5) return false;
  }
  return true;
}

type MinimalSimulationIssueFields = {
  startDays: number[];
  dueDays: number[];
  daysOfWork: number[];
  trackNumbers: number[];
};

export function getUncertaintyThresholdData<T extends MinimalSimulationIssueFields>(
  simulationIssue: T,
  uncertaintyWeight: UncertaintyWeight,
): T & {
  startDayBottom: number;
  dueDayBottom: number;
  dueDayTop: number;
  adjustedDaysOfWork: number;
  startDateWithTimeEnoughToFinish: number;
  mostCommonTrack: number;
} {
  const startDayAverage = average(simulationIssue.startDays);
  const dueDayAverage = average(simulationIssue.dueDays);
  const length = simulationIssue.dueDays.length;

  let startDayBottom: number, dueDayBottom: number, dueDayTop: number, adjustedDaysOfWork: number;

  if (typeof uncertaintyWeight === 'number') {
    const uncertaintyIndex = Math.min(Math.round((length * uncertaintyWeight) / 100), length - 1);
    const confidenceIndex = Math.max(length - 1 - uncertaintyIndex, 0);

    startDayBottom = simulationIssue.startDays[confidenceIndex];
    dueDayBottom = simulationIssue.dueDays[confidenceIndex];
    dueDayTop = simulationIssue.dueDays[uncertaintyIndex];
    adjustedDaysOfWork = simulationIssue.daysOfWork[uncertaintyIndex];
  } else {
    startDayBottom = startDayAverage;
    dueDayBottom = dueDayAverage;
    dueDayTop = dueDayAverage;
    adjustedDaysOfWork = average(simulationIssue.daysOfWork);
  }

  return {
    ...simulationIssue,
    startDayBottom,
    dueDayBottom,
    dueDayTop,
    adjustedDaysOfWork,
    startDateWithTimeEnoughToFinish: dueDayTop - adjustedDaysOfWork,
    mostCommonTrack: mostCommonNumber(simulationIssue.trackNumbers) || 0,
  };
}

/**
 * The deadline at slider `p`: the `(100 − p)`th percentile, the earliest start that is still safe in
 * `p`% of runs. The mean at `average`. `undefined` when nothing frozen is downstream.
 */
export function mustStartByAtWeight(sortedDays: number[], uncertaintyWeight: UncertaintyWeight): number | undefined {
  if (!sortedDays.length) return undefined;
  if (uncertaintyWeight === 'average') return average(sortedDays);
  const index = Math.min(Math.round((sortedDays.length * (100 - uncertaintyWeight)) / 100), sortedDays.length - 1);
  return sortedDays[Math.max(index, 0)];
}

/**
 * When work has to begin for the frozen dates to hold. `startDay` is the start that is early enough
 * in the slider's share of runs — the median at `average`, not the mean: a minority of runs that
 * start weeks early would otherwise drag an "average" date before the start date even when most
 * runs never go there. `beforeStartPercent` reports that minority on its own.
 */
export function planStartAtWeight(sortedFirstStartDays: number[], uncertaintyWeight: UncertaintyWeight) {
  const runs = sortedFirstStartDays.length;
  let early = 0;
  while (early < runs && sortedFirstStartDays[early] < 0) early++;
  const weight = uncertaintyWeight === 'average' ? 50 : uncertaintyWeight;
  return {
    startDay: mustStartByAtWeight(sortedFirstStartDays, weight) ?? 0,
    /**
     * The other end of the start band — the mirror of the finish band's `dueDayBottom`/`dueDayTop`:
     * the start that is early enough in only `100 − p`% of runs. Equal to `startDay` at 50%.
     */
    startDayLate: mustStartByAtWeight(sortedFirstStartDays, 100 - weight) ?? 0,
    beforeStartPercent: runs ? (early / runs) * 100 : 0,
    startDays: sortedFirstStartDays,
  };
}

export type OverlapInfo = {
  /** Items holding a track regardless of capacity that overlap at the busiest point of the window. */
  overlapping: number;
  tracks: number;
  /** Business-day offsets where more such items overlap than there are tracks. */
  startDay: number;
  endDay: number;
};

type OverlapCandidate = {
  linkedIssue: { frozen: unknown | null; team: { parallelWorkLimit: number } };
  isOverflowTrack: boolean;
  startDateWithTimeEnoughToFinish: number;
  dueDayTop: number;
};

/**
 * For each item on an overflow track, the window it is over capacity in, for its tooltip. Spans are
 * the bars as drawn at the current slider position, so the tooltip agrees with what is on screen.
 */
export function withOverlapInfo<T extends OverlapCandidate>(
  teamResults: T[],
): Array<T & { overlapInfo?: OverlapInfo }> {
  // Everything that holds a track regardless of capacity: frozen items, and deadline work moved onto
  // an over-capacity track.
  const frozen = teamResults.filter((result) => result.linkedIssue.frozen || result.isOverflowTrack);
  return teamResults.map((result) => {
    if (!result.isOverflowTrack) return result;
    const tracks = result.linkedIssue.team.parallelWorkLimit;
    const start = result.startDateWithTimeEnoughToFinish;
    const end = result.dueDayTop;

    // Sweep the frozen spans clipped to this item's span.
    const events: Array<[number, number]> = [];
    for (const other of frozen) {
      const from = Math.max(other.startDateWithTimeEnoughToFinish, start);
      const to = Math.min(other.dueDayTop, end);
      if (from < to) events.push([from, 1], [to, -1]);
    }
    events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    let active = 0;
    let overlapping = 0;
    let windowStart: number | null = null;
    let windowEnd = end;
    for (const [day, delta] of events) {
      const wasOver = active > tracks;
      active += delta;
      overlapping = Math.max(overlapping, active);
      if (!wasOver && active > tracks && windowStart === null) windowStart = day;
      if (wasOver && active <= tracks) windowEnd = day;
    }
    return {
      ...result,
      overlapInfo: {
        overlapping: Math.max(overlapping, tracks + 1),
        tracks,
        startDay: windowStart ?? start,
        endDay: windowStart === null ? end : windowEnd,
      },
    };
  });
}

/**
 * Puts an item's bar where the plan pass placed it (spec/044 consistent-plan.md). The item's own
 * numbers from the simulation stay alongside for the row's marks and tooltip:
 * - `ownDaysOfWork`, its own adjusted size at the slider (the estimator's number);
 * - `ownShouldEndDay`, its own finish at the slider;
 * - `ownShouldStartDay`, the latest start that still finishes by then at that size.
 * Work feeding a frozen item is mirrored: its safe number is the early start, so it should start
 * then and end that size later (capped at its own finish).
 * Without a planned position (no plan yet) the bar keeps its own dates.
 */
export function applyPlan<
  T extends {
    startDayBottom: number;
    dueDayTop: number;
    adjustedDaysOfWork: number;
    startDateWithTimeEnoughToFinish: number;
    mostCommonTrack: number;
  },
>(
  result: T,
  planned: PlannedItem | undefined,
  { backward = false }: { backward?: boolean } = {},
): T & {
  ownDueDayTop: number;
  ownDaysOfWork: number;
  ownShouldStartDay: number;
  ownShouldEndDay: number;
  track: number;
} {
  const own = {
    ownDueDayTop: result.dueDayTop,
    ownDaysOfWork: result.adjustedDaysOfWork,
    ownShouldStartDay: backward ? result.startDayBottom : result.dueDayTop - result.adjustedDaysOfWork,
    ownShouldEndDay: backward
      ? Math.min(result.startDayBottom + result.adjustedDaysOfWork, result.dueDayTop)
      : result.dueDayTop,
  };
  if (!planned) return { ...result, ...own, track: result.mostCommonTrack };
  return {
    ...result,
    ...own,
    startDateWithTimeEnoughToFinish: planned.startDay,
    dueDayTop: planned.dueDay,
    adjustedDaysOfWork: planned.dueDay - planned.startDay,
    track: planned.track,
  };
}

function groupByTrack<T extends { track: number }>(items: T[]): T[][] {
  const trackMap = new Map<number, T[]>();

  for (const item of items) {
    const track = item.track;
    if (!trackMap.has(track)) {
      trackMap.set(track, []);
    }
    trackMap.get(track)!.push(item);
  }

  // Convert to an array of arrays, indexed by track number
  const maxTrack = Math.max(...trackMap.keys());
  const result: T[][] = [];

  for (let i = 0; i <= maxTrack; i++) {
    result[i] = trackMap.get(i) ?? [];
  }

  return result;
}
