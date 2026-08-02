import { describe, it, expect, vi } from 'vitest';
import { makeDeepChildrenLoaderUsingNamedFields } from './makeDeepChildrenLoaderUsingNamedFields';
import { fetchAllJiraIssuesWithJQLAndFetchAllChangelog } from './fetchAllJiraIssuesWithJQLAndFetchAllChangelog';
import { Config, ProgressData } from './types';

// The deep-children walk drives its recursion with `fetchAllJiraIssuesWithJQLAndFetchAllChangelog`.
// This fixture answers approximate-count, search, and bulk changelog off the JQL of each call, so we
// can assert the *shape* of the requests the loader makes — specifically that only the root call pays
// for an approximate-count and every child batch skips it.
function makeConfig(issuesByJql: Record<string, { id: string; key: string }[]>): Config {
  const requestHelper = vi.fn(async (urlFragment: string, options?: { method?: string; body?: string }) => {
    if (urlFragment.includes('approximate-count')) {
      const { jql } = JSON.parse(options!.body!);
      return { count: issuesByJql[jql]?.length ?? 0 };
    }
    if (urlFragment.includes('/api/3/search/jql')) {
      const params = new URLSearchParams(urlFragment.split('?')[1]);
      const jql = params.get('jql') || '';
      const issues = issuesByJql[jql] ?? [];
      return {
        issues: issues.map((issue) => ({ ...issue, fields: {} })),
        isLast: true,
        nextPageToken: undefined,
      };
    }
    if (urlFragment.includes('/api/3/changelog/bulkfetch')) {
      return { issueChangeLogs: [], nextPageToken: undefined };
    }
    throw new Error(`Unexpected requestHelper call: ${urlFragment}`);
  }) as unknown as Config['requestHelper'];

  return {
    env: {} as Config['env'],
    requestHelper,
    fieldsRequest: async () => ({ list: {} as any, nameMap: {}, idMap: {}, ambiguousFieldIds: new Set() }),
    host: 'hosted',
  } as Config;
}

const ROOT_JQL = 'type = Epic';
// One root JQL matching 2 parents, each with 2 children, children with none.
const fixture = {
  [ROOT_JQL]: [
    { id: '1', key: 'P-1' },
    { id: '2', key: 'P-2' },
  ],
  // The children batch queries all parents at once (trailing space comes from `childJQL || ''`).
  'parent in (P-1, P-2) ': [
    { id: '3', key: 'C-1' },
    { id: '4', key: 'C-2' },
    { id: '5', key: 'C-3' },
    { id: '6', key: 'C-4' },
  ],
  // Terminal probe: the children have no children of their own.
  'parent in (C-1, C-2, C-3, C-4) ': [],
};

const callsMatching = (config: Config, fragment: string) =>
  (config.requestHelper as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([url]: [string]) =>
    url.includes(fragment),
  );

describe('makeDeepChildrenLoaderUsingNamedFields', () => {
  it('counts only on the root call — every child batch skips the approximate-count', async () => {
    const config = makeConfig(fixture);
    const loadDeep = makeDeepChildrenLoaderUsingNamedFields(config)(
      fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config),
    );

    await loadDeep({ jql: ROOT_JQL, fields: [] });

    const countCalls = callsMatching(config, 'approximate-count');
    expect(countCalls).toHaveLength(1);
    // ...and it counts the root JQL, not a `parent in (…)` child batch.
    expect(JSON.parse((countCalls[0][1] as { body: string }).body).jql).toBe(ROOT_JQL);
  });

  it('makes the number of requests the math predicts (6, not 8)', async () => {
    const config = makeConfig(fixture);
    const loadDeep = makeDeepChildrenLoaderUsingNamedFields(config)(
      fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config),
    );

    await loadDeep({ jql: ROOT_JQL, fields: [] });

    // root: count + search + changelog = 3
    // L1 batch (2 parents → 4 children): search + changelog = 2 (count skipped)
    // terminal batch (4 children → 0): search only = 1 (count skipped, no changelog for 0 issues)
    expect(callsMatching(config, 'approximate-count')).toHaveLength(1);
    expect(callsMatching(config, '/api/3/search/jql')).toHaveLength(3);
    expect(callsMatching(config, '/api/3/changelog/bulkfetch')).toHaveLength(2);
    expect((config.requestHelper as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(6);
  });

  it('still returns the whole tree and ends with the expected progress state', async () => {
    const config = makeConfig(fixture);
    const loadDeep = makeDeepChildrenLoaderUsingNamedFields(config)(
      fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config),
    );

    const progress = (() => {}) as { (data: ProgressData): void; data?: ProgressData };
    const result = await loadDeep({ jql: ROOT_JQL, fields: [] }, progress);

    expect(result.map((i) => i.key).sort()).toEqual(['C-1', 'C-2', 'C-3', 'C-4', 'P-1', 'P-2']);

    expect(progress.data!.phase).toBe('children');
    expect(progress.data!.parentsToProcess).toBe(2);
    expect(progress.data!.parentsProcessed).toBe(2);
    // Dedupe set tracks every key whose children we queried (2 parents + 4 children).
    expect(progress.data!.keysWhoseChildrenWeAreAlreadyLoading.size).toBe(6);
  });
});
