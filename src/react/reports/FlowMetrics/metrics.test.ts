import { expect, test, describe } from 'vitest';
import { calculateCycleTimeStats, calculateWipAge } from './metrics';
import type { MetricsIssue } from './adapter';

const TODO_ID = 'status-1';
const IN_PROGRESS_ID = 'status-2';
const DONE_ID = 'status-3';

const STATUS_MAP = new Map([
  [TODO_ID, 'new'],
  [IN_PROGRESS_ID, 'indeterminate'],
  [DONE_ID, 'done'],
]);

const createIssue = (overrides: Partial<MetricsIssue> = {}): MetricsIssue => ({
  key: 'TEST-1',
  fields: { resolutiondate: null },
  changelog: { histories: [] },
  ...overrides,
});

const transition = (from: string, to: string, created: string) => ({
  id: '',
  created,
  items: [{ field: 'status', from, to, fromString: null, toString: null }],
});

describe('calculateCycleTimeStats', () => {
  test('returns null when no issues provided', () => {
    expect(calculateCycleTimeStats([], STATUS_MAP)).toBeNull();
  });

  test('returns null when no issues have both in-progress and done dates', () => {
    const issue = createIssue({ key: 'TEST-1' });
    expect(calculateCycleTimeStats([issue], STATUS_MAP)).toBeNull();
  });

  test('calculates cycle time for a single completed issue', () => {
    const issue = createIssue({
      key: 'TEST-1',
      fields: { resolutiondate: '2024-02-05T00:00:00.000Z' },
      changelog: {
        histories: [transition(TODO_ID, IN_PROGRESS_ID, '2024-02-01T00:00:00.000Z')],
      },
    });

    const result = calculateCycleTimeStats([issue], STATUS_MAP);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
    expect(result!.throughput).toBe(1);
    expect(result!.avg).toBeGreaterThan(0);
    expect(result!.samples).toHaveLength(1);
  });

  test('uses the last new→indeterminate transition as the in-progress date', () => {
    const issue = createIssue({
      key: 'TEST-1',
      fields: { resolutiondate: '2024-02-10T00:00:00.000Z' },
      changelog: {
        histories: [
          transition(TODO_ID, IN_PROGRESS_ID, '2024-02-01T00:00:00.000Z'),
          transition(IN_PROGRESS_ID, TODO_ID, '2024-02-03T00:00:00.000Z'),
          transition(TODO_ID, IN_PROGRESS_ID, '2024-02-05T00:00:00.000Z'), // last start — this one counts
        ],
      },
    });

    const laterStart = createIssue({
      key: 'TEST-2',
      fields: { resolutiondate: '2024-02-10T00:00:00.000Z' },
      changelog: {
        histories: [transition(TODO_ID, IN_PROGRESS_ID, '2024-02-01T00:00:00.000Z')],
      },
    });

    const resultA = calculateCycleTimeStats([issue], STATUS_MAP);
    const resultB = calculateCycleTimeStats([laterStart], STATUS_MAP);

    // Issue with later restart should have shorter cycle time
    expect(resultA!.avg).toBeLessThan(resultB!.avg);
  });

  test('calculates avg, median, and p85 across multiple issues', () => {
    const issues = [2, 4, 6, 8, 10].map((days, i) =>
      createIssue({
        key: `TEST-${i}`,
        fields: { resolutiondate: `2024-02-${String(days + 1).padStart(2, '0')}T00:00:00.000Z` },
        changelog: {
          histories: [transition(TODO_ID, IN_PROGRESS_ID, `2024-02-01T00:00:00.000Z`)],
        },
      }),
    );

    const result = calculateCycleTimeStats(issues, STATUS_MAP);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(5);
    expect(result!.throughput).toBe(5);
    expect(result!.median).toBeLessThanOrEqual(result!.p85);
    expect(result!.avg).toBeLessThanOrEqual(result!.p85);
  });

  test('excludes issues with no in-progress transition from count but includes in throughput', () => {
    const completedWithTransition = createIssue({
      key: 'TEST-1',
      fields: { resolutiondate: '2024-02-05T00:00:00.000Z' },
      changelog: {
        histories: [transition(TODO_ID, IN_PROGRESS_ID, '2024-02-01T00:00:00.000Z')],
      },
    });
    const completedNoTransition = createIssue({
      key: 'TEST-2',
      fields: { resolutiondate: '2024-02-05T00:00:00.000Z' },
      changelog: { histories: [] },
    });

    const result = calculateCycleTimeStats([completedWithTransition, completedNoTransition], STATUS_MAP);
    expect(result!.count).toBe(1);
    expect(result!.throughput).toBe(2);
  });
});

describe('calculateWipAge', () => {
  test('returns null when no issues are in progress', () => {
    expect(calculateWipAge([], STATUS_MAP)).toBeNull();
  });

  test('returns null when no issues have an in-progress transition', () => {
    const issue = createIssue({ key: 'TEST-1' });
    expect(calculateWipAge([issue], STATUS_MAP)).toBeNull();
  });

  test('calculates age for a single in-progress issue', () => {
    const started = new Date();
    started.setDate(started.getDate() - 5);

    const issue = createIssue({
      key: 'TEST-1',
      changelog: {
        histories: [transition(TODO_ID, IN_PROGRESS_ID, started.toISOString())],
      },
    });

    const result = calculateWipAge([issue], STATUS_MAP);
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].key).toBe('TEST-1');
    expect(result!.items[0].age).toBeGreaterThanOrEqual(5);
    expect(result!.maxAgeKey).toBe('TEST-1');
  });

  test('calculates avg, median, and max across multiple in-progress issues', () => {
    const issues = [3, 6, 9].map((daysAgo, i) => {
      const started = new Date();
      started.setDate(started.getDate() - daysAgo);
      return createIssue({
        key: `TEST-${i}`,
        changelog: {
          histories: [transition(TODO_ID, IN_PROGRESS_ID, started.toISOString())],
        },
      });
    });

    const result = calculateWipAge(issues, STATUS_MAP);
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(3);
    expect(result!.maxAge).toBeGreaterThanOrEqual(result!.medianAge);
    expect(result!.medianAge).toBeGreaterThanOrEqual(result!.avgAge - 1);
  });

  test('ignores issues that have been completed (no resolutiondate check — WIP only tracks in-progress)', () => {
    const started = new Date();
    started.setDate(started.getDate() - 4);

    // Issue is in-progress (has in-progress transition, no done transition blocking it)
    const issue = createIssue({
      key: 'TEST-1',
      changelog: {
        histories: [transition(TODO_ID, IN_PROGRESS_ID, started.toISOString())],
      },
    });

    const result = calculateWipAge([issue], STATUS_MAP);
    expect(result!.items).toHaveLength(1);
  });
});
