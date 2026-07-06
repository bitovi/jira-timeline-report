import { describe, test, expect } from 'vitest';
import { cellState } from './cellState';

describe('cellState', () => {
  test('missing rollup → na', () => {
    expect(cellState(undefined)).toBe('na');
    expect(cellState(null)).toBe('na');
  });

  test('empty issueKeys → na', () => {
    expect(cellState({ status: 'unknown', issueKeys: [], due: null })).toBe('na');
  });

  test('work but no due date → nodate', () => {
    expect(cellState({ status: 'unknown', issueKeys: ['A-1'], due: null })).toBe('nodate');
  });

  test('work with a due date → the status', () => {
    expect(cellState({ status: 'behind', issueKeys: ['A-1'], due: new Date('2025-03-01') })).toBe('behind');
  });

  test('dated work missing a status falls back to unknown', () => {
    expect(cellState({ issueKeys: ['A-1'], due: new Date('2025-03-01') })).toBe('unknown');
  });
});
