import { describe, test, expect } from 'vitest';
import { getStatusColorClass, getStatusLabel, STATUS_LEGEND_ORDER } from './statusClass';

describe('getStatusColorClass', () => {
  test('known statuses map to their color class', () => {
    expect(getStatusColorClass('complete')).toBe('color-text-and-bg-complete');
    expect(getStatusColorClass('ontrack')).toBe('color-text-and-bg-ontrack');
    expect(getStatusColorClass('ahead')).toBe('color-text-and-bg-ahead');
    expect(getStatusColorClass('new')).toBe('color-text-and-bg-new');
    expect(getStatusColorClass('notstarted')).toBe('color-text-and-bg-notstarted');
  });

  test('unknown status falls back to unknown', () => {
    expect(getStatusColorClass('not-a-real-status')).toBe('color-text-and-bg-unknown');
  });
});

describe('getStatusLabel', () => {
  test('known statuses have human labels', () => {
    expect(getStatusLabel('ontrack')).toBe('On track');
    expect(getStatusLabel('notstarted')).toBe('Not started');
    expect(getStatusLabel('unknown')).toBe('No dates');
  });

  test('unknown status falls back to the raw value', () => {
    expect(getStatusLabel('custom')).toBe('custom');
  });
});

describe('STATUS_LEGEND_ORDER', () => {
  test('includes new and leads with complete', () => {
    expect(STATUS_LEGEND_ORDER[0]).toBe('complete');
    expect(STATUS_LEGEND_ORDER).toContain('new');
  });
});
