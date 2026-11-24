import { describe, expect, it } from 'vitest';
import { addWorkSize, WithWorkSize } from './work-size';
import { resolveWorkSettings, RawWorkSettings } from './work-settings';
import { getBusinessDatesCount } from '../../../utils/date/business-days';
import type { DerivedIssue } from '../../derived/derive';
import type { IssueOrRelease } from '../rollup';

/** spec/046 § Per-issue size and progress, § Team time over dates. */

// Mon 1 Jan 2024 is business day 1.
const d = (month: number, day: number) => new Date(2024, month - 1, day);
/** The nth business day from Mon 1 Jan 2024 (1-based). */
function businessDay(n: number) {
  const date = d(1, 1);
  let count = 1;
  while (count < n) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) count++;
  }
  return date;
}
const endOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23);

type Fixture = {
  key: string;
  team?: string;
  level?: number;
  start?: Date;
  due?: Date;
  /** confidence-adjusted estimate, track-days */
  estimate?: number | null;
  points?: number | null;
  tracks?: number;
  status?: 'To Do' | 'In Progress' | 'Done';
  spread?: boolean;
  legacyTotal?: number | null;
  legacyCompleted?: number;
};

function issue(f: Fixture): DerivedIssue {
  const span = f.start && f.due ? getBusinessDatesCount(f.start, f.due) : null;
  const estimate = f.estimate ?? null;
  return {
    key: f.key,
    type: 'Epic',
    hierarchyLevel: f.level ?? 1,
    statusCategory: f.status ?? 'In Progress',
    team: { name: f.team ?? 'A', parallelWorkLimit: f.tracks ?? 1, spreadEffortAcrossDates: !!f.spread },
    derivedTiming: {
      start: f.start,
      due: f.due,
      datesDaysOfWork: span,
      isStoryPointsMedianValid: estimate != null,
      isConfidenceValid: true,
      deterministicTotalDaysOfWork: estimate,
      storyPointsMedianDaysOfWork: estimate,
      isStoryPointsValid: f.points != null,
      storyPointsDaysOfWork: f.points ?? 0,
      totalDaysOfWork: f.legacyTotal ?? null,
      completedDaysOfWork: f.legacyCompleted ?? 0,
    },
  } as unknown as DerivedIssue;
}

function size(fixtures: Fixture[], raw: RawWorkSettings, now: Date, otherWork: Fixture[] = []) {
  const result = addWorkSize(fixtures.map(issue) as IssueOrRelease[], resolveWorkSettings(raw), {
    now,
    otherWork: otherWork.map(issue),
  }) as Array<IssueOrRelease & WithWorkSize>;
  return Object.fromEntries(result.map((i) => [i.key, i.workSize]));
}

describe('addWorkSize', () => {
  describe('only epics follow the settings (spec § Scope: epics only)', () => {
    it('stories and initiatives keep derivedTiming, sized by Spread effort', () => {
      const r = size(
        [
          { key: 'dates', level: 0, start: d(1, 1), due: d(1, 26), estimate: 5, legacyTotal: 20, legacyCompleted: 7 },
          {
            key: 'spread',
            level: 2,
            start: d(1, 1),
            due: d(1, 26),
            estimate: 5,
            spread: true,
            legacyTotal: 5,
            legacyCompleted: 2,
          },
          { key: 'none', level: 0 },
        ],
        { sizeBy: 'teamTime' },
        d(1, 12),
      );
      expect(r.dates).toMatchObject({ totalDaysOfWork: 20, completedDaysOfWork: 7, sizeFrom: 'dates', legacy: true });
      expect(r.spread).toMatchObject({ totalDaysOfWork: 5, completedDaysOfWork: 2, sizeFrom: 'estimate' });
      expect(r.none).toMatchObject({ totalDaysOfWork: null, sizeFrom: null });
    });

    it('defaults to date span, then estimate, for epics', () => {
      const r = size(
        [
          { key: 'dated', start: d(1, 1), due: d(1, 26), estimate: 5, spread: true },
          { key: 'estimated', estimate: 5 },
        ],
        {},
        d(1, 12),
      );
      expect(r.dated).toMatchObject({ totalDaysOfWork: 20, sizeFrom: 'dates', legacy: false });
      expect(r.estimated).toMatchObject({ totalDaysOfWork: 5, sizeFrom: 'estimate' });
    });
  });

  it('estimates stay in today’s units (not divided by tracks)', () => {
    const r = size([{ key: 'a', estimate: 30, tracks: 2 }], { sizeBy: 'estimate' }, d(1, 12));
    expect(r.a.totalDaysOfWork).toBe(30);
    expect(r.a.sizeFrom).toBe('estimate');
  });

  describe('size each item by + fallback', () => {
    const now = d(1, 12);
    const items: Fixture[] = [
      { key: 'both', start: d(1, 1), due: d(1, 26), estimate: 5 },
      { key: 'datesOnly', start: d(1, 1), due: d(1, 26) },
      { key: 'estimateOnly', estimate: 5 },
    ];
    it('dates, then estimate', () => {
      const r = size(items, { sizeBy: 'dates' }, now);
      expect([r.both.totalDaysOfWork, r.datesOnly.totalDaysOfWork, r.estimateOnly.totalDaysOfWork]).toEqual([
        20, 20, 5,
      ]);
      expect(r.estimateOnly.sizeFrom).toBe('estimate');
    });
    it('dates without the estimate fallback', () => {
      const r = size(items, { sizeBy: 'dates', sizeFallback: 'none' }, now);
      expect(r.estimateOnly.totalDaysOfWork).toBeNull();
    });
    it('estimate, then dates', () => {
      const r = size(items, { sizeBy: 'estimate' }, now);
      expect([r.both.totalDaysOfWork, r.datesOnly.totalDaysOfWork, r.estimateOnly.totalDaysOfWork]).toEqual([5, 20, 5]);
    });
    it('estimate only', () => {
      const r = size(items, { sizeBy: 'estimate', sizeFallback: 'none' }, now);
      expect(r.datesOnly.totalDaysOfWork).toBeNull();
    });
    it('estimate, then team time', () => {
      const r = size(items, { sizeBy: 'estimate', sizeFallback: 'teamTime' }, now);
      expect(r.datesOnly.sizeFrom).toBe('teamTime');
    });
    it('an invalid fallback falls back to the primary’s default', () => {
      const r = size(items, { sizeBy: 'dates', sizeFallback: 'teamTime' }, now);
      expect(r.estimateOnly.totalDaysOfWork).toBe(5);
    });
  });

  describe('completed days', () => {
    it('size × elapsed share of start → due', () => {
      // 10 of 20 business days elapsed
      const r = size(
        [{ key: 'x', estimate: 20, start: d(1, 1), due: d(1, 26) }],
        { sizeBy: 'estimate' },
        endOf(d(1, 12)),
      );
      expect(r.x.completedDaysOfWork).toBeCloseTo(10);
    });
    it('0 without dates, whatever the status', () => {
      const r = size([{ key: 'x', estimate: 20, status: 'Done' }], { sizeBy: 'estimate' }, d(1, 12));
      expect(r.x.completedDaysOfWork).toBe(0);
    });
  });

  describe('team time over dates', () => {
    const farFuture = new Date(2030, 0, 1);

    it('worked example: A and B (8 team-days each) overlapping get 8 each', () => {
      const r = size(
        [
          { key: 'A', start: businessDay(1), due: businessDay(12), estimate: 8 },
          { key: 'B', start: businessDay(5), due: businessDay(16), estimate: 8 },
        ],
        { sizeBy: 'teamTime' },
        farFuture,
      );
      expect(r.A.totalDaysOfWork).toBeCloseTo(8);
      expect(r.B.totalDaysOfWork).toBeCloseTo(8);
      expect(r.A.sizeFrom).toBe('teamTime');
    });

    it('does not depend on the track count', () => {
      const r = size(
        [
          { key: 'A', start: businessDay(1), due: businessDay(12), estimate: 16, tracks: 2 },
          { key: 'B', start: businessDay(5), due: businessDay(16), estimate: 16, tracks: 2 },
        ],
        { sizeBy: 'teamTime' },
        farFuture,
      );
      expect(r.A.totalDaysOfWork).toBeCloseTo(8);
    });

    it('a lone item gets its whole date span', () => {
      const r = size(
        [{ key: 'A', start: businessDay(1), due: businessDay(10), estimate: 2 }],
        { sizeBy: 'teamTime' },
        farFuture,
      );
      expect(r.A.totalDaysOfWork).toBeCloseTo(10);
      expect(r.A.spanDays).toBe(10);
    });

    it('splits days by density', () => {
      // A 3/10 per day, B 1/10 per day over the same 10 days → 7.5 and 2.5
      const r = size(
        [
          { key: 'A', start: businessDay(1), due: businessDay(10), estimate: 3 },
          { key: 'B', start: businessDay(1), due: businessDay(10), estimate: 1 },
        ],
        { sizeBy: 'teamTime' },
        farFuture,
      );
      expect(r.A.totalDaysOfWork).toBeCloseTo(7.5);
      expect(r.B.totalDaysOfWork).toBeCloseTo(2.5);
    });

    it('only shares days within the same team, and only between epics', () => {
      const r = size(
        [
          { key: 'A', start: businessDay(1), due: businessDay(10), estimate: 3 },
          { key: 'otherTeam', team: 'B', start: businessDay(1), due: businessDay(10), estimate: 3 },
          { key: 'story', level: 0, start: businessDay(1), due: businessDay(10), estimate: 3, legacyTotal: 10 },
        ],
        { sizeBy: 'teamTime' },
        farFuture,
      );
      expect(r.A.totalDaysOfWork).toBeCloseTo(10);
      expect(r.otherTeam.totalDaysOfWork).toBeCloseTo(10);
      expect(r.story).toMatchObject({ totalDaysOfWork: 10, legacy: true, teamTimeDays: null });
    });

    it('ignores other work that isn’t an epic', () => {
      const r = size(
        [{ key: 'A', start: businessDay(1), due: businessDay(10), estimate: 3 }],
        { sizeBy: 'teamTime' },
        farFuture,
        [{ key: 'S', level: 0, start: businessDay(1), due: businessDay(10), estimate: 3 }],
      );
      expect(r.A.totalDaysOfWork).toBeCloseTo(10);
    });

    describe('if it has dates but no estimate', () => {
      const items: Fixture[] = [
        { key: 'A', start: businessDay(1), due: businessDay(10), estimate: 5 },
        { key: 'C', start: businessDay(1), due: businessDay(10) },
      ];
      it('average pace: it shares days like an estimated item', () => {
        const r = size(items, { sizeBy: 'teamTime' }, farFuture);
        expect(r.A.totalDaysOfWork).toBeCloseTo(5);
        expect(r.C.totalDaysOfWork).toBeCloseTo(5);
      });
      it('leave out: others get its days and it falls through to the next rule', () => {
        const r = size(items, { sizeBy: 'teamTime', noEstimate: 'leaveOut' }, farFuture);
        expect(r.A.totalDaysOfWork).toBeCloseTo(10);
        expect(r.C.totalDaysOfWork).toBeNull(); // fallback is estimate, and it has none
      });
    });

    it('completed = the shares on days up to today', () => {
      const r = size(
        [
          { key: 'A', start: businessDay(1), due: businessDay(12), estimate: 8 },
          { key: 'B', start: businessDay(5), due: businessDay(16), estimate: 8 },
        ],
        { sizeBy: 'teamTime' },
        endOf(businessDay(6)),
      );
      // A alone days 1–4, then half of days 5 and 6
      expect(r.A.completedDaysOfWork).toBeCloseTo(5);
      expect(r.B.completedDaysOfWork).toBeCloseTo(1);
    });

    it('falls back to the estimate without dates', () => {
      const r = size([{ key: 'A', estimate: 4 }], { sizeBy: 'teamTime' }, farFuture);
      expect(r.A).toMatchObject({ totalDaysOfWork: 4, sizeFrom: 'estimate' });
    });

    it('the team’s other work shrinks an item’s team time without being returned', () => {
      const a: Fixture = { key: 'A', start: businessDay(1), due: businessDay(10), estimate: 5 };
      const f: Fixture = { key: 'F', start: businessDay(1), due: businessDay(10), estimate: 5 };
      const r = size([a], { sizeBy: 'teamTime' }, farFuture, [f]);
      expect(r.A.totalDaysOfWork).toBeCloseTo(5);
      expect(r.F).toBeUndefined();
    });
  });
});
