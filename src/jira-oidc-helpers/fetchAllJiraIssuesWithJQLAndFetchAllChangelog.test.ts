import { describe, it, expect, vi } from 'vitest';
import { fetchAllJiraIssuesWithJQLAndFetchAllChangelog } from './fetchAllJiraIssuesWithJQLAndFetchAllChangelog';
import { Config, ProgressData } from './types';

// Builds a fake config whose requestHelper answers approximate-count, search, and bulk
// changelog requests based on the URL fragment, returning `issuesPerJql` issues for the
// JQL used in this call (so different calls/batches can simulate different-sized batches).
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
    fieldsRequest: async () => ({ list: {} as any, nameMap: {}, idMap: {} }),
    host: 'hosted',
  } as Config;
}

describe('fetchAllJiraIssuesWithJQLAndFetchAllChangelog', () => {
  it('accumulates issuesRequested/issuesReceived across multiple calls sharing one progress.data object, instead of resetting them', async () => {
    const issuesByJql = {
      'parent in (A)': [
        { id: '1', key: 'A-1' },
        { id: '2', key: 'A-2' },
      ],
      'parent in (B)': [
        { id: '3', key: 'B-1' },
        { id: '4', key: 'B-2' },
        { id: '5', key: 'B-3' },
      ],
    };
    const config = makeConfig(issuesByJql);
    const fetchAll = fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config);

    // Simulates the real-world scenario: makeDeepChildrenLoaderUsingNamedFields passes the
    // SAME `progress` object (with the SAME `.data`) into concurrent/sequential calls for
    // different batches of children. Here we intentionally run them sequentially and inspect
    // progress.data after each call to confirm the totals only ever grow.
    const progress = (() => {}) as { (data: ProgressData): void; data?: ProgressData };

    await fetchAll({ jql: 'parent in (A)', fields: [] }, progress);
    const afterFirst = { ...progress.data! };

    await fetchAll({ jql: 'parent in (B)', fields: [] }, progress);
    const afterSecond = { ...progress.data! };

    // Totals must accumulate (2 + 3 issues requested/received), never reset to the second
    // batch's own smaller/larger numbers.
    expect(afterFirst.issuesRequested).toBe(2);
    expect(afterFirst.issuesReceived).toBe(2);

    expect(afterSecond.issuesRequested).toBe(5);
    expect(afterSecond.issuesReceived).toBe(5);
  });
});
