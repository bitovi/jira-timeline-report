import { describe, expect, it } from 'vitest';

import { buildSizingExample, EXAMPLE_DAYS } from './sizing-example';
import { resolveWorkSettings } from './work-settings';

const bySize = (raw: Parameters<typeof resolveWorkSettings>[0]) =>
  Object.fromEntries(buildSizingExample(resolveWorkSettings(raw)).rows.map((r) => [r.item.key, r]));

describe('buildSizingExample', () => {
  it('team time, average pace: matches the mockup (W1 = W2 = W3 = 3, W4 by estimate, W5 by level average)', () => {
    const rows = bySize({ sizeBy: 'teamTime' });
    expect(rows.W1.teamTimeDays).toBeCloseTo(3);
    expect(rows.W2.teamTimeDays).toBeCloseTo(3);
    expect(rows.W3.teamTimeDays).toBeCloseTo(3);
    expect(rows.W1).toMatchObject({ sizeFrom: 'teamTime', isFallback: false });
    expect(rows.W4).toMatchObject({ size: 7, sizeFrom: 'estimate', isFallback: true });
    expect(rows.W5.sizeFrom).toBe('average');
    expect(rows.W5.size).toBeCloseTo((3 + 3 + 3 + 7) / 4);
  });

  it('team time, leave out + unsized: W1 takes W3’s days (W1 = 5) and the rest have no size', () => {
    const rows = bySize({ sizeBy: 'teamTime', noEstimate: 'leaveOut', sizeFallback: 'none', missingSize: 'unsized' });
    expect(rows.W1.size).toBeCloseTo(5);
    expect(rows.W2.size).toBeCloseTo(3);
    expect(rows.W3).toMatchObject({ leftOut: true, teamTimeDays: null, size: null, sizeFrom: 'unsized' });
    expect(rows.W4).toMatchObject({ size: null, sizeFrom: 'unsized' });
  });

  it('estimate, then date span', () => {
    const rows = bySize({ sizeBy: 'estimate', sizeFallback: 'dates' });
    expect(rows.W1).toMatchObject({ size: 2, sizeFrom: 'estimate' });
    expect(rows.W3).toMatchObject({ size: 4, sizeFrom: 'dates', isFallback: true });
  });

  it('the default is today’s sizing: dates, then estimate', () => {
    const example = buildSizingExample(resolveWorkSettings({}));
    const rows = Object.fromEntries(example.rows.map((r) => [r.item.key, r]));
    expect(rows.W1).toMatchObject({ size: 8, sizeFrom: 'dates' });
    expect(rows.W4).toMatchObject({ size: 7, sizeFrom: 'estimate' });
  });

  it.each([[{ sizeBy: 'teamTime' }], [{ sizeBy: 'teamTime', noEstimate: 'leaveOut' }]] as const)(
    'the per-day split adds up to each item’s team time (%j)',
    (raw) => {
      const example = buildSizingExample(resolveWorkSettings(raw));
      expect(example.days).toHaveLength(EXAMPLE_DAYS);
      for (const row of example.rows) {
        const fromDays = example.days.flatMap((d) => d.shares).filter((s) => s.key === row.item.key);
        const sum = fromDays.reduce((a, s) => a + s.amount, 0);
        expect(sum).toBeCloseTo(row.teamTimeDays ?? 0);
      }
      // Each busy day is exactly one team-day; day 10 is idle.
      for (const day of example.days) {
        const total = day.shares.reduce((a, s) => a + s.amount, 0);
        expect(total).toBeCloseTo(day.shares.length ? 1 : 0);
      }
      expect(example.days[EXAMPLE_DAYS - 1].shares).toHaveLength(0);
    },
  );
});
