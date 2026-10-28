import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DerivedIssue } from '../../../../jira/derived/derive';
import { getDatesFromSimulationIssue } from '../IssueSimulationRow';
import { StatsAnalyzer, applyPlan, mustStartByAtWeight, planStartAtWeight, withOverlapInfo } from './stats-analyzer';

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

describe('mustStartByAtWeight', () => {
  const days = Array.from({ length: 100 }, (_, i) => i); // sorted

  it('reports the (100 − p)th percentile, the earliest start that is safe with confidence p', () => {
    expect(mustStartByAtWeight(days, 90)).toBe(10);
    expect(mustStartByAtWeight(days, 50)).toBe(50);
  });

  it('reports the mean at average', () => {
    expect(mustStartByAtWeight(days, 'average')).toBe(49.5);
  });

  it('is undefined with no deadline', () => {
    expect(mustStartByAtWeight([], 80)).toBeUndefined();
  });
});

describe('applyPlan', () => {
  const own = {
    startDayBottom: 6,
    dueDayTop: 20,
    adjustedDaysOfWork: 9,
    startDateWithTimeEnoughToFinish: 11,
    mostCommonTrack: 1,
  };

  it('draws the bar at the planned position and keeps the item’s own window for the whisker', () => {
    expect(applyPlan(own, { startDay: 4, dueDay: 12, track: 0 })).toMatchObject({
      startDateWithTimeEnoughToFinish: 4,
      dueDayTop: 12,
      adjustedDaysOfWork: 8,
      track: 0,
      ownDueDayTop: 20,
      // Its own 9-day size, ending at its own percentile end.
      ownWindowStart: 11,
      ownWindowEnd: 20,
    });
  });

  it('mirrors the window of work feeding a frozen item from its early start', () => {
    expect(applyPlan(own, { startDay: 4, dueDay: 12, track: 0 }, { backward: true })).toMatchObject({
      ownWindowStart: 6,
      ownWindowEnd: 15,
    });
    expect(applyPlan({ ...own, dueDayTop: 10 }, undefined, { backward: true }).ownWindowEnd).toBe(10);
  });

  it('keeps the item’s own bar until there is a plan', () => {
    expect(applyPlan(own, undefined)).toMatchObject({
      startDateWithTimeEnoughToFinish: 11,
      dueDayTop: 20,
      track: 1,
      ownDueDayTop: 20,
    });
  });
});

describe('planStartAtWeight', () => {
  // 23 of 100 runs start early, some by a lot — the report that showed "must start by" with no early bar.
  const firstStartDays = [...Array.from({ length: 23 }, (_, i) => -40 + i), ...Array.from({ length: 77 }, () => 0)];

  it('uses the middle run at average, so a minority of early runs does not move the date', () => {
    expect(planStartAtWeight(firstStartDays, 'average')).toMatchObject({ startDay: 0, beforeStartPercent: 23 });
  });

  it('reports the date that is early enough in the slider share of runs', () => {
    expect(planStartAtWeight(firstStartDays, 90).startDay).toBe(-30);
    expect(planStartAtWeight(firstStartDays, 50).startDay).toBe(0);
  });

  it('gives the late end of the start band as the mirror percentile', () => {
    expect(planStartAtWeight(firstStartDays, 90)).toMatchObject({ startDay: -30, startDayLate: 0 });
    expect(planStartAtWeight(firstStartDays, 'average').startDayLate).toBe(0);
  });

  it('is 0 with nothing early', () => {
    expect(planStartAtWeight([0, 0, 3], 80)).toMatchObject({ startDay: 0, beforeStartPercent: 0 });
  });
});

describe('withOverlapInfo', () => {
  const team = { parallelWorkLimit: 1 };
  const bar = (start: number, due: number, isOverflowTrack = false) => ({
    linkedIssue: { frozen: {}, team },
    isOverflowTrack,
    startDateWithTimeEnoughToFinish: start,
    dueDayTop: due,
  });

  it('reports how many frozen items overlap, on how many tracks, and when', () => {
    const [, overflow] = withOverlapInfo([bar(0, 10), bar(5, 15, true)]);

    expect(overflow.overlapInfo).toEqual({ overlapping: 2, tracks: 1, startDay: 5, endDay: 10 });
  });

  it('counts over-capacity deadline work, not only frozen items', () => {
    const unfrozenOverflow = { ...bar(5, 12, true), linkedIssue: { frozen: null, team } };
    const [, overflow] = withOverlapInfo([bar(0, 10), unfrozenOverflow]);

    expect(overflow.overlapInfo).toMatchObject({ overlapping: 2, startDay: 5, endDay: 10 });
  });

  it('leaves items on real tracks alone', () => {
    expect(withOverlapInfo([bar(0, 10)])[0]).not.toHaveProperty('overlapInfo');
  });
});

describe('StatsAnalyzer frozen items', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const startDate = new Date(Date.UTC(2026, 0, 5)); // Monday
  const frozenIssue = (key: string, start: Date, due: Date, overrides: object = {}) =>
    makeDerivedIssue({
      key,
      derivedTiming: { deterministicTotalDaysOfWork: 5, probablisticTotalDaysOfWork: 5, start, due },
      ...overrides,
    } as any);

  function run(issues: DerivedIssue[], frozenKeys: string[], uncertaintyWeight: number | 'average' = 'average') {
    let latest: any = null;
    const analyzer = new StatsAnalyzer({
      issues,
      uncertaintyWeight,
      setUIState: (data) => (latest = data),
      frozenKeys: new Set(frozenKeys),
      startDate,
    });
    vi.advanceTimersByTime(2000);
    analyzer.teardown();
    return Object.fromEntries(latest.simulationIssueResults.map((r: any) => [r.linkedIssue.key, r]));
  }

  it('reports a blocker that ends after its frozen dependent starts as late in every run', () => {
    // A (0–10) blocks B (starts day 5), both frozen on different teams.
    const a = frozenIssue('A', new Date(2026, 0, 5), new Date(2026, 0, 16), {
      issue: { fields: { 'Linked Issues': [{ type: { name: 'Blocks' }, outwardIssue: { key: 'B' } }] } },
    });
    const b = frozenIssue('B', new Date(2026, 0, 12), new Date(2026, 0, 16), { team: makeTeam('team-b') });

    const byKey = run([a, b], ['A', 'B']);

    expect(byKey.A.lateForFrozenPercent).toBe(100);
    expect(byKey.B.lateForFrozenPercent).toBe(0);
    expect(byKey.A.startDayBottom).toBe(0);
    expect(byKey.A.dueDayTop).toBe(10);
  });

  it('draws a backward chain in order: a blocker never after the work it blocks', () => {
    // The report this came from: Create a promotion → Add promotion to cart (long, very uncertain) →
    // frozen. At 90% the blocker used to be drawn from the runs where the long epic was short.
    const linksTo = (key: string) => ({
      issue: { fields: { 'Linked Issues': [{ type: { name: 'Blocks' }, outwardIssue: { key } }] } },
    });
    const blocker = makeDerivedIssue({ key: 'A', storyPointsMedian: 3, confidence: 90, ...linksTo('B') } as any);
    const long = makeDerivedIssue({
      key: 'B',
      team: makeTeam('team-b'),
      storyPointsMedian: 40,
      confidence: 10,
      ...linksTo('F'),
    } as any);
    const frozen = frozenIssue('F', new Date(2026, 6, 6), new Date(2026, 6, 10), { team: makeTeam('team-c') });

    for (const weight of [60, 90, 'average'] as const) {
      const byKey = run([blocker, long, frozen], ['F'], weight);
      // Bars come from one plan run, so a blocker ends exactly when, or before, the work it blocks starts.
      expect(byKey.A.dueDayTop).toBeLessThanOrEqual(byKey.B.startDateWithTimeEnoughToFinish + 1e-9);
      expect(byKey.B.dueDayTop).toBeLessThanOrEqual(byKey.F.startDateWithTimeEnoughToFinish + 1e-9);
    }
  });

  it('flags the second of two overlapping frozen items on a one-track team as overflow', () => {
    const first = frozenIssue('A', new Date(2026, 0, 5), new Date(2026, 0, 16));
    const second = frozenIssue('B', new Date(2026, 0, 12), new Date(2026, 0, 23));

    const byKey = run([first, second], ['A', 'B']);

    expect(byKey.A.isOverflowTrack).toBe(false);
    expect(byKey.B.isOverflowTrack).toBe(true);
  });

  it('reports when the plan has to start, following the slider, and how often an item starts too early', () => {
    // U (5+ days, sampled) must finish before frozen F starts on day 2, so it starts before day 0.
    const blocker = makeDerivedIssue({
      key: 'U',
      storyPointsMedian: 5,
      confidence: 50,
      issue: { fields: { 'Linked Issues': [{ type: { name: 'Blocks' }, outwardIssue: { key: 'F' } }] } },
    } as any);
    const frozen = frozenIssue('F', new Date(2026, 0, 7), new Date(2026, 0, 9), { team: makeTeam('team-b') });

    let latest: any = null;
    const run50 = new StatsAnalyzer({
      issues: [blocker, frozen],
      uncertaintyWeight: 50,
      setUIState: (data) => (latest = data),
      frozenKeys: new Set(['F']),
      startDate,
    });
    vi.advanceTimersByTime(2000);
    const at50 = latest.planStart.startDay;
    run50.updateUncertaintyWeight(90);
    const at90 = latest.planStart.startDay;
    run50.teardown();

    const u = latest.simulationIssueResults.find((r: any) => r.linkedIssue.key === 'U');
    expect(latest.endDaySimulationResult.linkedIssue.summary).toBe('Overall timing');
    expect(latest.endDaySimulationResult.startDays).toBe(latest.planStart.startDays);
    // Runs that start on or after the start date all count as "no early start needed".
    expect(latest.planStart.startDays.every((day: number) => day <= 0)).toBe(true);
    expect(at50).toBeLessThan(0);
    expect(at90).toBeLessThanOrEqual(at50);
    expect(u.beforeStartPercent).toBeGreaterThan(50);
    expect(u.mustStartByDay).toBeUndefined();
    expect(u.dueDayTop).toBeCloseTo(2);
  });
});

describe('StatsAnalyzer plan (spec/044 consistent-plan.md)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const startDate = new Date(Date.UTC(2026, 0, 5)); // Monday
  const blocks = (key?: string) => ({
    issue: { fields: { 'Linked Issues': key ? [{ type: { name: 'Blocks' }, outwardIssue: { key } }] : [] } },
  });
  // Six uncertain epics in a chain on a one-track team — the IMP-116 report.
  const keys = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6'];
  const chain = keys.map((key, i) =>
    makeDerivedIssue({ key, url: `#${key}`, storyPointsMedian: 10, confidence: 40, ...blocks(keys[i + 1]) } as any),
  );

  function analyze(issues: DerivedIssue[], uncertaintyWeight: number | 'average', frozenKeys: string[] = []) {
    let latest: any = null;
    const analyzer = new StatsAnalyzer({
      issues,
      uncertaintyWeight,
      setUIState: (data) => (latest = data),
      frozenKeys: new Set(frozenKeys),
      startDate,
    });
    vi.advanceTimersByTime(2000);
    return {
      analyzer,
      latest: () => latest,
      bars: () => [...latest.simulationIssueResults].sort((a, b) => a.dueDayTop - b.dueDayTop),
    };
  }

  it('lays the chain end to end, finishing when the simulation does, with shorter-than-90% lengths', () => {
    const { analyzer, latest, bars } = analyze(chain, 90);
    analyzer.teardown();

    const sorted = bars();
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].startDateWithTimeEnoughToFinish).toBeGreaterThanOrEqual(sorted[i - 1].dueDayTop - 1e-9);
    }
    expect(
      Math.abs(sorted[sorted.length - 1].dueDayTop - latest().endDaySimulationResult.dueDayTop),
    ).toBeLessThanOrEqual(0.5);
    expect(latest().planQuantile).toBeLessThan(90);
    // Each epic's own 90% finish still reaches past its bar.
    expect(sorted.some((bar: any) => bar.ownDueDayTop > bar.dueDayTop)).toBe(true);
    expect(sorted.every((bar: any) => bar.track === 0 && !bar.isOverflowTrack)).toBe(true);
  });

  it('stretches lengths past the median at the median slider, because estimates run long', () => {
    const { analyzer, latest } = analyze(chain, 50);
    analyzer.teardown();

    expect(latest().planQuantile).toBeGreaterThan(50);
  });

  it('reproduces the same plan, with no over-capacity track, once its dates are written and frozen', () => {
    const { analyzer, bars } = analyze(chain, 90);
    analyzer.teardown();
    const before = bars();

    // What Update Epic Dates writes, read back the way Jira dates are parsed (local midnight).
    const written = new Map(
      before.map((bar: any) => {
        const dates = getDatesFromSimulationIssue(bar, startDate);
        const local = (date: Date) => new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        return [
          bar.linkedIssue.key,
          { start: local(dates.startDateWithTimeEnoughToFinish), due: local(dates.dueDateTop) },
        ];
      }),
    );
    const frozenChain = chain.map((issue) => ({
      ...issue,
      derivedTiming: { ...issue.derivedTiming, ...written.get(issue.key) },
    }));

    const again = analyze(frozenChain, 90, keys);
    again.analyzer.teardown();

    const after = again.bars();
    expect(after.every((bar: any) => !bar.isOverflowTrack)).toBe(true);
    after.forEach((bar: any, i: number) => {
      expect(
        Math.abs(bar.startDateWithTimeEnoughToFinish - before[i].startDateWithTimeEnoughToFinish),
      ).toBeLessThanOrEqual(0.5);
      expect(Math.abs(bar.dueDayTop - before[i].dueDayTop)).toBeLessThanOrEqual(0.5);
    });
  });
});
