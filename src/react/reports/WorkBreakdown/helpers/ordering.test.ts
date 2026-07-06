import { describe, test, expect } from 'vitest';
import { orderByAttention } from './ordering';

describe('orderByAttention', () => {
  test('sorts blocked → behind → … → complete → notstarted', () => {
    const rows = [
      { name: 'a', status: 'complete' },
      { name: 'b', status: 'blocked' },
      { name: 'c', status: 'ontrack' },
      { name: 'd', status: 'behind' },
    ];
    expect(orderByAttention(rows, (r) => r.status).map((r) => r.name)).toEqual(['b', 'd', 'c', 'a']);
  });

  test('is stable for equal statuses (preserves source order)', () => {
    const rows = [
      { name: 'a', status: 'ontrack' },
      { name: 'b', status: 'ontrack' },
      { name: 'c', status: 'ontrack' },
    ];
    expect(orderByAttention(rows, (r) => r.status).map((r) => r.name)).toEqual(['a', 'b', 'c']);
  });

  test('unknown statuses sort last', () => {
    const rows = [
      { name: 'a', status: 'mystery' },
      { name: 'b', status: 'behind' },
    ];
    expect(orderByAttention(rows, (r) => r.status).map((r) => r.name)).toEqual(['b', 'a']);
  });
});
