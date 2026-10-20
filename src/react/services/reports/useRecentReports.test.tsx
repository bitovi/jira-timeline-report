import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveRecentReports, useRecentReports } from './useRecentReports';

const report = (id: string) => ({ id, name: `Report ${id}`, queryParams: '' });

describe('useRecentReports', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('keeps every mounted copy in step, so home and the dropdown never disagree', () => {
    const dropdown = renderHook(() => useRecentReports());
    const home = renderHook(() => useRecentReports());

    act(() => dropdown.result.current.addReportToRecents('a'));
    act(() => dropdown.result.current.addReportToRecents('b'));

    expect(home.result.current.recentReports).toEqual(['b', 'a']);
  });

  it('builds each update on the latest list, not a stale copy', () => {
    const savedReportsPage = renderHook(() => useRecentReports());
    const dropdown = renderHook(() => useRecentReports());

    act(() => dropdown.result.current.addReportToRecents('a'));
    act(() => dropdown.result.current.addReportToRecents('b'));
    act(() => savedReportsPage.result.current.removeFromRecentReports('a'));
    act(() => dropdown.result.current.addReportToRecents('c'));

    expect(savedReportsPage.result.current.recentReports).toEqual(['c', 'b']);
  });

  it('keeps the five most recent', () => {
    const { result } = renderHook(() => useRecentReports());

    ['a', 'b', 'c', 'd', 'e', 'f'].forEach((id) => act(() => result.current.addReportToRecents(id)));

    expect(result.current.recentReports).toEqual(['f', 'e', 'd', 'c', 'b']);
  });
});

describe('resolveRecentReports', () => {
  it('keeps recency order and skips deleted reports', () => {
    const reports = { a: report('a'), c: report('c') };

    expect(resolveRecentReports(['c', 'gone', 'a'], reports)).toEqual([report('c'), report('a')]);
  });

  it('tops up with the most recently updated other reports, up to five', () => {
    const updated = (id: string, at?: string) => ({ ...report(id), ...(at ? { updatedAt: at } : {}) });
    const reports = {
      opened: updated('opened', '2026-01-01T00:00:00.000Z'),
      old: updated('old', '2026-02-01T00:00:00.000Z'),
      newest: updated('newest', '2026-05-01T00:00:00.000Z'),
      newer: updated('newer', '2026-04-01T00:00:00.000Z'),
      never: updated('never'),
      newish: updated('newish', '2026-03-01T00:00:00.000Z'),
    };

    expect(resolveRecentReports(['opened'], reports).map(({ id }) => id)).toEqual([
      'opened',
      'newest',
      'newer',
      'newish',
      'old',
    ]);
  });

  it('shows no more than five', () => {
    const reports = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => [id, report(id)]));

    expect(resolveRecentReports(['f', 'e', 'd', 'c', 'b', 'a'], reports)).toHaveLength(5);
  });
});
