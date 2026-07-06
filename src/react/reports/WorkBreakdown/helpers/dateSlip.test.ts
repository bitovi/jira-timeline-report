import { describe, test, expect } from 'vitest';
import { dateSlip } from './dateSlip';

const DAY = 1000 * 60 * 60 * 24;

describe('dateSlip', () => {
  test('no prior period → none', () => {
    expect(dateSlip({ status: 'behind', due: new Date('2025-07-24') })).toEqual({ kind: 'none' });
  });

  test('ahead status with a prior date → improved (teal), labeled with the prior date', () => {
    const slip = dateSlip({
      status: 'ahead',
      due: new Date('2025-10-03'),
      lastPeriod: { due: new Date('2025-10-10') },
    });
    expect(slip.kind).toBe('improved');
    expect(slip.label).toBe('Oct 10');
  });

  test('due later than the prior period (> 1 day) → slipped (red), labeled with the prior date', () => {
    const slip = dateSlip({
      status: 'behind',
      due: new Date('2025-07-24'),
      lastPeriod: { due: new Date('2025-06-19') },
    });
    expect(slip.kind).toBe('slipped');
    expect(slip.label).toBe('Jun 19');
  });

  test('due within a day of the prior period → none', () => {
    const was = new Date('2025-07-24T00:00:00.000Z');
    expect(dateSlip({ status: 'ontrack', due: new Date(was.getTime() + DAY), lastPeriod: { due: was } })).toEqual({
      kind: 'none',
    });
  });

  test('due earlier than the prior period without ahead status → none', () => {
    expect(
      dateSlip({ status: 'ontrack', due: new Date('2025-06-01'), lastPeriod: { due: new Date('2025-07-01') } }),
    ).toEqual({ kind: 'none' });
  });
});
