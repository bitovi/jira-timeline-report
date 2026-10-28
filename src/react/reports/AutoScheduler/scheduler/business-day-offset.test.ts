import { describe, it, expect } from 'vitest';

import { businessDayOffsetToDate, jiraDayOffsets, jiraDueDayOffset, jiraStartDayOffset } from './business-day-offset';

// Monday. Plan starts are UTC midnights; Jira dates are parsed into local midnights.
const PLAN_START = new Date(Date.UTC(2026, 0, 5));
const local = (month: number, day: number, year = 2026) => new Date(year, month, day);

describe('business-day offsets', () => {
  it('counts business days from the plan start to a Jira start', () => {
    expect(jiraStartDayOffset(PLAN_START, local(0, 5))).toBe(0);
    expect(jiraStartDayOffset(PLAN_START, local(0, 12))).toBe(5);
  });

  it('treats a weekend start as the following Monday', () => {
    expect(jiraStartDayOffset(PLAN_START, local(0, 10))).toBe(5);
  });

  it('goes negative before the plan start', () => {
    expect(jiraStartDayOffset(PLAN_START, local(0, 2))).toBe(-1);
    expect(jiraStartDayOffset(PLAN_START, local(11, 29, 2025))).toBe(-5);
  });

  it('makes a due date exclusive, matching getBusinessDatesCount spans', () => {
    // Mon 5 – Fri 9 is 5 business days.
    expect(jiraDueDayOffset(PLAN_START, local(0, 9))).toBe(5);
    expect(jiraDueDayOffset(PLAN_START, local(0, 2))).toBe(0);
  });

  it('returns null for a missing date', () => {
    expect(jiraDayOffsets(PLAN_START, { due: local(0, 9) })).toEqual({ startDay: null, dueDay: 5 });
    expect(jiraDayOffsets(PLAN_START, { start: local(0, 12) })).toEqual({ startDay: 5, dueDay: null });
  });

  it('maps offsets, including negative ones, back to dates', () => {
    expect(businessDayOffsetToDate(PLAN_START, 5).toISOString().slice(0, 10)).toBe('2026-01-12');
    expect(businessDayOffsetToDate(PLAN_START, -1).toISOString().slice(0, 10)).toBe('2026-01-02');
    expect(businessDayOffsetToDate(PLAN_START, -6).toISOString().slice(0, 10)).toBe('2025-12-26');
  });
});
