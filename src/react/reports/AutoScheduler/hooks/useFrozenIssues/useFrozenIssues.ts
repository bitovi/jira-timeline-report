import { useCallback, useMemo } from 'react';

import { useRouteData } from '../../../../hooks/useRouteData';

export function parseFrozenIssues(raw: unknown): Set<string> {
  return new Set((typeof raw === 'string' ? raw : '').split(',').filter(Boolean));
}

/** Sorted and de-duplicated, so the same set always produces the same URL. */
export function serializeFrozenIssues(keys: Iterable<string>): string {
  return [...new Set(keys)].filter(Boolean).sort().join(',');
}

/**
 * The Auto-Scheduler's frozen items, URL-backed (`frozenIssues`) so they are saved with the report.
 * Keys that aren't in the loaded data stay in the set; the scheduler ignores them.
 */
export const useFrozenIssues = () => {
  const [raw, setRaw] = useRouteData<string>('frozenIssues');

  const frozenIssues = useMemo(() => parseFrozenIssues(raw), [raw]);

  const setFrozenIssues = useCallback((keys: Iterable<string>) => setRaw(serializeFrozenIssues(keys)), [setRaw]);

  return [frozenIssues, setFrozenIssues] as const;
};
