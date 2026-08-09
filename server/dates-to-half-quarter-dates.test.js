import { describe, test, expect } from 'vitest';
import datesToHalfQuarterDates from './dates-to-half-quarter-dates.js';

/** Minimal stand-in for an Express response, so the handler needs no HTTP server. */
function fakeResponse() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

const respondTo = (body) => {
  const res = fakeResponse();
  datesToHalfQuarterDates({ body }, res);
  return res;
};

describe('POST /dates-to-half-quarter-dates — rounding', () => {
  // Recorded from the auto-scheduler host this endpoint is moving off of, so a
  // re-pointed Automation rule keeps getting the same dates.
  test.each([
    ['2025-04-03', '2025-06-20', '2025-04-01', '2025-06-30'],
    ['2025-01-20', undefined, '2025-01-01', null],
    [undefined, '2025-02-10', null, '2025-02-14'],
    [undefined, '2025-11-14', null, '2025-11-14'],
    [undefined, '2025-12-28', null, '2025-12-31'],
    ['2025-02-06', '2025-02-08', '2025-02-15', '2025-03-31'],
    ['2025-04-03T14:30:00Z', undefined, '2025-04-01', null],
  ])('%s / %s → %s / %s', (startDate, dueDate, expectedStart, expectedDue) => {
    const res = respondTo({ startDate, dueDate });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      roundedStartDate: expectedStart,
      roundedDueDate: expectedDue,
    });
  });

  test('rolls a late-December start into the next year', () => {
    const res = respondTo({ startDate: '2025-12-20', dueDate: '2025-12-28' });

    // The due date rounds behind the start, so it is stretched to the start's own end.
    expect(res.body).toEqual({
      roundedStartDate: '2026-01-01',
      roundedDueDate: '2026-02-14',
    });
  });

  test('stretches a due date that rounds behind the start date', () => {
    const res = respondTo({ startDate: '2025-06-20', dueDate: '2025-01-05' });

    expect(res.body).toEqual({
      roundedStartDate: '2025-07-01',
      roundedDueDate: '2025-08-14',
    });
  });

  // Upstream had no candidate boundary at or after a date in the back half of November,
  // so it returned null and an Automation rule would clear the field.
  test('rounds a late-November due date to the end of the year', () => {
    const res = respondTo({ dueDate: '2025-11-20' });

    expect(res.body.roundedDueDate).toBe('2025-12-31');
  });

  test('is independent of the server timezone', () => {
    // A date-only string is UTC midnight per spec, and every boundary is built with
    // Date.UTC, so this assertion holds wherever the server runs.
    const res = respondTo({ startDate: '2025-04-03' });

    expect(res.body.roundedStartDate).toBe('2025-04-01');
  });
});

describe('POST /dates-to-half-quarter-dates — absent and invalid input', () => {
  test.each([[{}], [{ startDate: null, dueDate: null }], [{ startDate: '', dueDate: '' }]])(
    'treats %j as supplying neither date',
    (body) => {
      const res = respondTo(body);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ roundedStartDate: null, roundedDueDate: null });
    },
  );

  test('handles a request with no body at all', () => {
    const res = fakeResponse();
    datesToHalfQuarterDates({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ roundedStartDate: null, roundedDueDate: null });
  });

  test('rejects an unparseable startDate', () => {
    const res = respondTo({ startDate: 'nonsense' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid startDate format. Use "YYYY-MM-DD".' });
  });

  test('rejects an unparseable dueDate', () => {
    const res = respondTo({ dueDate: 'nonsense' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid dueDate format. Use "YYYY-MM-DD".' });
  });
});
