import { describe, test, expect } from 'vitest';
import {
  intersect,
  packIssuesIntoRows,
  packIssuesIntoRowsWithSides,
  sortIssuesByLeftPosition,
  filterIssuesWithDates,
  partitionIssuesByDate,
} from './collision';
import { makeIssue, mixedMissingDueIssues } from '../fixtures';

describe('intersect', () => {
  test('overlapping ranges (either order)', () => {
    expect(intersect({ start: 10, end: 30 }, { start: 20, end: 40 })).toBe(true);
    expect(intersect({ start: 20, end: 40 }, { start: 10, end: 30 })).toBe(true);
  });

  test('touching boundaries do not overlap', () => {
    expect(intersect({ start: 10, end: 30 }, { start: 30, end: 50 })).toBe(false);
  });

  test('fully separate ranges do not overlap', () => {
    expect(intersect({ start: 10, end: 20 }, { start: 30, end: 40 })).toBe(false);
  });

  test('contained range overlaps', () => {
    expect(intersect({ start: 10, end: 50 }, { start: 20, end: 30 })).toBe(true);
  });
});

describe('packIssuesIntoRows', () => {
  test('non-overlapping issues all fit in one row', () => {
    const rows = packIssuesIntoRows([
      { key: 'A', leftPercentStart: 10, rightPercentEnd: 20 },
      { key: 'B', leftPercentStart: 30, rightPercentEnd: 40 },
      { key: 'C', leftPercentStart: 50, rightPercentEnd: 60 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].items).toHaveLength(3);
  });

  test('collision pushes overlapping issue to a second row', () => {
    const rows = packIssuesIntoRows([
      { key: 'A', leftPercentStart: 10, rightPercentEnd: 30 },
      { key: 'B', leftPercentStart: 20, rightPercentEnd: 40 }, // overlaps A
      { key: 'C', leftPercentStart: 50, rightPercentEnd: 60 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].items.map((i) => i.key)).toEqual(['A', 'C']);
    expect(rows[1].items.map((i) => i.key)).toEqual(['B']);
  });

  test('nested collisions require three rows', () => {
    const rows = packIssuesIntoRows([
      { key: 'A', leftPercentStart: 10, rightPercentEnd: 40 },
      { key: 'B', leftPercentStart: 20, rightPercentEnd: 35 }, // inside A
      { key: 'C', leftPercentStart: 25, rightPercentEnd: 50 }, // overlaps A and B
    ]);
    expect(rows).toHaveLength(3);
  });

  test('empty input yields no rows', () => {
    expect(packIssuesIntoRows([])).toEqual([]);
  });

  test('touching boundaries share a row (no overlap)', () => {
    const rows = packIssuesIntoRows([
      { key: 'A', leftPercentStart: 10, rightPercentEnd: 30 },
      { key: 'B', leftPercentStart: 30, rightPercentEnd: 50 },
    ]);
    expect(rows).toHaveLength(1);
  });
});

describe('packIssuesIntoRowsWithSides', () => {
  test('flipping a label to the opposite side lets two near-collisions share one row', () => {
    // Both labels flowing left would overlap ([30,50] and [32,52]) → 2 rows with the old packer.
    // Letting B flow right ([52,72]) clears A's left-flowing label, so they share a single row.
    const rows = packIssuesIntoRowsWithSides([
      { key: 'A', rightPercentEnd: 50, widthInPercent: 20 },
      { key: 'B', rightPercentEnd: 52, widthInPercent: 20 },
    ]);
    expect(rows).toHaveLength(1);
    const byKey = Object.fromEntries(rows[0].items.map((i) => [i.key, i.labelSide]));
    expect(byKey).toEqual({ A: 'left', B: 'right' });
  });

  test('inward bias: markers near the left edge flow right, near the right edge flow left', () => {
    const rows = packIssuesIntoRowsWithSides([
      { key: 'L', rightPercentEnd: 10, widthInPercent: 15 },
      { key: 'R', rightPercentEnd: 90, widthInPercent: 15 },
    ]);
    expect(rows).toHaveLength(1);
    const byKey = Object.fromEntries(rows[0].items.map((i) => [i.key, i.labelSide]));
    expect(byKey).toEqual({ L: 'right', R: 'left' });
  });

  test('avoids an orientation that would clip a grid edge (respects bounds)', () => {
    // Dot at 45 is left of this range's center (30), so it prefers flowing right → [45,65];
    // but 65 exceeds max=60, so it falls back to the in-bounds left orientation.
    const rows = packIssuesIntoRowsWithSides([{ key: 'A', rightPercentEnd: 45, widthInPercent: 20 }], {
      min: 0,
      max: 60,
    });
    expect(rows[0].items[0].labelSide).toBe('left');
  });

  test('keeps the preferred side when a label is wider than the whole plot (degenerate)', () => {
    const rows = packIssuesIntoRowsWithSides([{ key: 'X', rightPercentEnd: 45, widthInPercent: 120 }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].items[0].labelSide).toBe('right');
  });

  test('never overlaps two labels within the same row', () => {
    const items = [
      { key: 'A', rightPercentEnd: 30, widthInPercent: 18 },
      { key: 'B', rightPercentEnd: 34, widthInPercent: 18 },
      { key: 'C', rightPercentEnd: 60, widthInPercent: 18 },
      { key: 'D', rightPercentEnd: 64, widthInPercent: 18 },
    ];
    const rows = packIssuesIntoRowsWithSides(items);
    for (const row of rows) {
      const spans = row.items.map((i) =>
        i.labelSide === 'left'
          ? { start: i.rightPercentEnd - i.widthInPercent, end: i.rightPercentEnd }
          : { start: i.rightPercentEnd, end: i.rightPercentEnd + i.widthInPercent },
      );
      for (let a = 0; a < spans.length; a++) {
        for (let b = a + 1; b < spans.length; b++) {
          expect(spans[a].start < spans[b].end && spans[b].start < spans[a].end).toBe(false);
        }
      }
    }
  });

  test('empty input yields no rows', () => {
    expect(packIssuesIntoRowsWithSides([])).toEqual([]);
  });

  test('co-located markers stack onto separate rows instead of flowing to opposite sides', () => {
    // Two issues rounding to the same position (e.g. same month) share one marker point. They
    // must NOT share a row via opposite-side labels — the single dot would read as two points.
    const rows = packIssuesIntoRowsWithSides([
      { key: 'A', rightPercentEnd: 50, widthInPercent: 20 },
      { key: 'B', rightPercentEnd: 50, widthInPercent: 20 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].items.map((i) => i.key)).toEqual(['A']);
    expect(rows[1].items.map((i) => i.key)).toEqual(['B']);
  });

  test('a third co-located marker stacks onto its own row', () => {
    const rows = packIssuesIntoRowsWithSides([
      { key: 'A', rightPercentEnd: 40, widthInPercent: 15 },
      { key: 'B', rightPercentEnd: 40, widthInPercent: 15 },
      { key: 'C', rightPercentEnd: 40, widthInPercent: 15 },
    ]);
    expect(rows).toHaveLength(3);
  });

  test('a distinct marker still shares a row with a co-located pair once they are on separate rows', () => {
    // A and B are co-located (stack); C is elsewhere and can join whichever row it fits.
    const rows = packIssuesIntoRowsWithSides([
      { key: 'A', rightPercentEnd: 50, widthInPercent: 10 },
      { key: 'B', rightPercentEnd: 50, widthInPercent: 10 },
      { key: 'C', rightPercentEnd: 10, widthInPercent: 10 },
    ]);
    expect(rows).toHaveLength(2);
    const allKeys = rows.flatMap((row) => row.items.map((i) => i.key));
    expect(allKeys.sort()).toEqual(['A', 'B', 'C']);
  });
});

describe('sortIssuesByLeftPosition', () => {
  test('sorts ascending by leftPercentStart', () => {
    const issues = [
      { leftPercentStart: 50, key: 'C' },
      { leftPercentStart: 10, key: 'A' },
      { leftPercentStart: 30, key: 'B' },
    ];
    expect(sortIssuesByLeftPosition(issues).map((i) => i.key)).toEqual(['A', 'B', 'C']);
  });

  test('does not mutate the original array', () => {
    const issues = [
      { leftPercentStart: 50, key: 'C' },
      { leftPercentStart: 10, key: 'A' },
    ];
    sortIssuesByLeftPosition(issues);
    expect(issues.map((i) => i.key)).toEqual(['C', 'A']);
  });
});

describe('filterIssuesWithDates', () => {
  test('keeps only issues with a rollup due date', () => {
    const issues = [makeIssue({ key: 'A', due: new Date('2025-02-01') }), makeIssue({ key: 'B', due: null })];
    const result = filterIssuesWithDates(issues);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('A');
  });

  test('drops issues from the mixed fixture that lack a due date', () => {
    const result = filterIssuesWithDates(mixedMissingDueIssues);
    expect(result.map((i) => i.key)).toEqual(['PROJ-20', 'PROJ-22']);
  });

  test('empty input yields empty output', () => {
    expect(filterIssuesWithDates([])).toEqual([]);
  });
});

describe('partitionIssuesByDate', () => {
  test('splits mixed issues into dated and undated', () => {
    const result = partitionIssuesByDate(mixedMissingDueIssues);
    expect(result.dated.map((i) => i.key)).toEqual(['PROJ-20', 'PROJ-22']);
    expect(result.undated.map((i) => i.key)).toEqual(['PROJ-21']);
  });

  test('empty input yields empty partitions', () => {
    expect(partitionIssuesByDate([])).toEqual({ dated: [], undated: [] });
  });

  test('all dated issues yield an empty undated bucket', () => {
    const issues = [makeIssue({ key: 'A', due: new Date('2025-02-01') })];
    expect(partitionIssuesByDate(issues)).toEqual({ dated: issues, undated: [] });
  });
});
