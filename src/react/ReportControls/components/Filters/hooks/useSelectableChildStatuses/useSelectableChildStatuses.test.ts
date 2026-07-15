import { describe, expect, it } from 'vitest';
import type { CanObservable } from '../../../../../hooks/useCanObservable/useCanObservable';
import { useSelectableChildStatuses } from './useSelectableChildStatuses';
import type { MinimalChildStatusIssue } from './useSelectableChildStatuses';
import { renderHook } from '@testing-library/react';

const obs = <T>(value: T): CanObservable<T> =>
  ({
    value,
    getData: () => value,
    get: () => value,
    set: () => undefined,
    on: () => undefined,
    off: () => undefined,
  }) as unknown as CanObservable<T>;

describe('useSelectableChildStatuses', () => {
  it('derives the child type name and distinct status values from children present across cards', () => {
    const allIssues: MinimalChildStatusIssue[] = [
      { key: 'C-1', type: 'Initiative', reportingHierarchy: { childKeys: ['S-1', 'S-2'] } },
      { key: 'C-2', type: 'Initiative', reportingHierarchy: { childKeys: ['S-3'] } },
      { key: 'S-1', type: 'Story', status: 'Done' },
      { key: 'S-2', type: 'Story', status: 'In Progress' },
      { key: 'S-3', type: 'Story', status: 'Done' },
    ];
    const primaryIssues = allIssues.filter((issue) => issue.type === 'Initiative');

    const { result } = renderHook(() => useSelectableChildStatuses(obs(primaryIssues), obs(allIssues)));

    expect(result.current.childType).toBe('Story');
    expect(result.current.statusOptions).toEqual([
      { label: 'Done', value: 'Done' },
      { label: 'In Progress', value: 'In Progress' },
    ]);
  });

  it('returns empty results when no observables are supplied', () => {
    const { result } = renderHook(() => useSelectableChildStatuses());
    expect(result.current.childType).toBe('');
    expect(result.current.statusOptions).toEqual([]);
  });
});
