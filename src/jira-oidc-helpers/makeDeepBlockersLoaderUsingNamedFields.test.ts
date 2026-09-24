import { describe, it, expect, vi } from 'vitest';

import { makeDeepBlockersLoaderUsingNamedFields } from './makeDeepBlockersLoaderUsingNamedFields';
import { makeDeepChildrenLoaderUsingNamedFields } from './makeDeepChildrenLoaderUsingNamedFields';
import { fetchAllJiraIssuesWithJQLAndFetchAllChangelog } from './fetchAllJiraIssuesWithJQLAndFetchAllChangelog';
import { Config, Issue, Params, ProgressData, Progress } from './types';

/**
 * Cycle coverage is the heart of this suite. A blocker graph is genuinely cyclic where a parent tree
 * is not, so every case asserts BOTH that the loop terminates and that each key was requested
 * **exactly once** — which is why the assertions are on the recorded JQL strings rather than only on
 * the returned set. A duplicate fetch that happens to produce the right answer still fails.
 */

const BLOCKS_TYPE = { id: '10000', name: 'Blocks', inward: 'is blocked by', outward: 'blocks' };

/** On issue X, an entry carrying `inwardIssue: Y` reads "X is blocked by Y". */
const blockedByLink = (key: string) => ({
  id: `link-${key}`,
  type: BLOCKS_TYPE,
  inwardIssue: { id: key, key, fields: { summary: key } },
});

/** The other direction, which the loader must ignore. */
const blocksLink = (key: string) => ({
  id: `link-out-${key}`,
  type: BLOCKS_TYPE,
  outwardIssue: { id: key, key, fields: { summary: key } },
});

/** `key -> the keys it is blocked by`. Anything not a key of this map does not exist in Jira. */
type Graph = Record<string, string[]>;

const issueOf = (graph: Graph, key: string): Issue => ({
  key,
  fields: { 'Linked Issues': (graph[key] ?? []).map(blockedByLink) },
});

interface FakeRootOptions {
  /** Keys the `blockerJQL` filter excludes — they resolve to nothing, exactly like a deleted issue. */
  excludedByFilter?: string[];
  /** Extra issues a batch returns unasked, standing in for the inner children loader's descendants. */
  alsoReturns?: Record<string, string[]>;
  /** A batch containing any of these rejects, like JQL `key in (...)` hitting an unresolvable key. */
  poison?: string[];
}

/**
 * A fake inner loader: it answers the root JQL with the seed issues and any `key in (...)` batch with
 * whichever of those keys exist. It records every JQL it was handed, which is what the "exactly once"
 * assertions read.
 */
function makeFakeRoot(graph: Graph, rootKeys: string[], options: FakeRootOptions = {}) {
  const { excludedByFilter = [], alsoReturns = {}, poison = [] } = options;
  const calls: Params[] = [];

  const root = async (params: Params): Promise<Issue[]> => {
    calls.push(params);

    const match = /^key in \(([^)]*)\)\s*(.*)$/.exec(params.jql ?? '');
    if (!match) return rootKeys.map((key) => issueOf(graph, key));

    const keys = match[1].split(', ');
    const filtered = match[2].trim();

    if (keys.some((key) => poison.includes(key))) {
      throw new Error(`JQL error: unresolvable key in (${keys.join(', ')})`);
    }

    const resolved = keys.filter((key) => key in graph && !(filtered && excludedByFilter.includes(key)));
    const extras = resolved.flatMap((key) => alsoReturns[key] ?? []);

    return [...resolved, ...extras].map((key) => issueOf(graph, key));
  };

  const batchedKeys = () =>
    calls
      .map((params) => /^key in \(([^)]*)\)/.exec(params.jql ?? ''))
      .filter((match): match is RegExpExecArray => !!match)
      .map((match) => match[1].split(', '));

  /** Every key ever asked for, in request order — duplicates preserved, so they can be asserted away. */
  const requestedKeys = () => batchedKeys().flat();

  return { root, calls, batchedKeys, requestedKeys };
}

const loadBlockers = (root: (params: Params) => Promise<Issue[]>) =>
  makeDeepBlockersLoaderUsingNamedFields({} as Config)(root as any);

const keysOf = (issues: Issue[]) => issues.map((issue) => issue.key).sort();

const newProgress = () => {
  const progress = ((data: ProgressData) => void data) as Progress;
  return progress;
};

describe('makeDeepBlockersLoaderUsingNamedFields', () => {
  describe('cycles terminate, and nothing is fetched twice', () => {
    it('walks a 3-cycle A → B → C → A and stops when it closes', async () => {
      const graph: Graph = { A: ['B'], B: ['C'], C: ['A'] };
      const fake = makeFakeRoot(graph, ['A']);

      const result = await loadBlockers(fake.root)({ jql: 'key = A' });

      expect(keysOf(result)).toEqual(['A', 'B', 'C']);
      // A is the seed, so it is never requested; B and C once each.
      expect(fake.requestedKeys()).toEqual(['B', 'C']);
    });

    it('stops immediately on a self-link A → A', async () => {
      const graph: Graph = { A: ['A'] };
      const fake = makeFakeRoot(graph, ['A']);

      const result = await loadBlockers(fake.root)({ jql: 'key = A' });

      expect(keysOf(result)).toEqual(['A']);
      expect(fake.requestedKeys()).toEqual([]);
    });

    it('closes a 2-cycle A ⇄ B after one round', async () => {
      const graph: Graph = { A: ['B'], B: ['A'] };
      const fake = makeFakeRoot(graph, ['A']);

      const result = await loadBlockers(fake.root)({ jql: 'key = A' });

      expect(keysOf(result)).toEqual(['A', 'B']);
      expect(fake.requestedKeys()).toEqual(['B']);
    });

    it('dedupes a diamond A → {B, C} → D within the round', async () => {
      const graph: Graph = { A: ['B', 'C'], B: ['D'], C: ['D'], D: [] };
      const fake = makeFakeRoot(graph, ['A']);

      const result = await loadBlockers(fake.root)({ jql: 'key = A' });

      expect(keysOf(result)).toEqual(['A', 'B', 'C', 'D']);
      // D is reachable two ways but arrives in one round, so it is asked for once.
      expect(fake.requestedKeys()).toEqual(['B', 'C', 'D']);
    });

    // Rule 3. `E` comes back as a descendant of the `D` batch without ever having been requested as a
    // blocker. When `B` later names it as its blocker, it must already count as seen.
    it('does not re-fetch a key that arrived as a descendant', async () => {
      const graph: Graph = { A: ['D', 'B'], D: [], B: ['E'], E: [] };
      const fake = makeFakeRoot(graph, ['A'], { alsoReturns: { D: ['E'] } });

      const result = await loadBlockers(fake.root)({ jql: 'key = A' });

      expect(keysOf(result)).toEqual(['A', 'B', 'D', 'E']);
      expect(fake.requestedKeys()).toEqual(['D', 'B']);
    });

    // Rule 2. The candidate enters the seen-set BEFORE the request goes out, so a key that resolves to
    // nothing is not re-proposed on every subsequent round — which is what would loop forever.
    it('does not re-request a blocker key that resolves to nothing', async () => {
      // `GONE` is not in the graph at all (deleted, or invisible to this user). `B` names it too.
      const graph: Graph = { A: ['GONE', 'B'], B: ['GONE'] };
      const fake = makeFakeRoot(graph, ['A']);

      const result = await loadBlockers(fake.root)({ jql: 'key = A' });

      expect(keysOf(result)).toEqual(['A', 'B']);
      expect(fake.requestedKeys()).toEqual(['GONE', 'B']);
    });

    // Rule 1. The seed keys are in the set before the first round, so a root issue that is also
    // somebody's blocker is never fetched a second time.
    it('seeds the root keys, so a root that is also a blocker is not re-fetched', async () => {
      const graph: Graph = { A: ['B'], B: ['A'], C: ['A'] };
      const fake = makeFakeRoot(graph, ['A', 'C']);

      const result = await loadBlockers(fake.root)({ jql: 'project = ORDER' });

      expect(keysOf(result)).toEqual(['A', 'B', 'C']);
      expect(fake.requestedKeys()).toEqual(['B']);
    });
  });

  describe('the requests it makes', () => {
    it('ignores the outward direction — "blocks" is not "is blocked by"', async () => {
      const fake = makeFakeRoot({ A: [] }, ['A']);
      const root = async (params: Params) => {
        const issues = await fake.root(params);
        // `A` blocks `Z`. Nothing upstream, so nothing to fetch.
        return issues.map((issue) => ({ ...issue, fields: { 'Linked Issues': [blocksLink('Z')] } }));
      };

      const result = await loadBlockers(root)({ jql: 'key = A' });

      expect(keysOf(result)).toEqual(['A']);
      expect(fake.requestedKeys()).toEqual([]);
    });

    it('batches candidates 40 at a time', async () => {
      const blockerKeys = Array.from({ length: 95 }, (_, index) => `B-${index}`);
      const graph: Graph = { A: blockerKeys };
      for (const key of blockerKeys) graph[key] = [];

      const fake = makeFakeRoot(graph, ['A']);

      await loadBlockers(fake.root)({ jql: 'key = A' });

      expect(fake.batchedKeys().map((batch) => batch.length)).toEqual([40, 40, 15]);
    });

    it('appends blockerJQL at every level and skips the approximate count', async () => {
      const graph: Graph = { A: ['B'], B: ['C'], C: [] };
      const fake = makeFakeRoot(graph, ['A']);

      await loadBlockers(fake.root)({ jql: 'key = A', blockerJQL: ' and type != Sub-task' });

      const batches = fake.calls.filter((params) => (params.jql ?? '').startsWith('key in ('));
      expect(batches.map((params) => params.jql)).toEqual([
        'key in (B)  and type != Sub-task',
        'key in (C)  and type != Sub-task',
      ]);
      expect(batches.every((params) => params.skipApproximateCount === true)).toBe(true);
      // The root call is the caller's own query and keeps its count.
      expect(fake.calls[0].skipApproximateCount).toBeUndefined();
    });

    it('excludes filtered blockers and still terminates', async () => {
      const graph: Graph = { A: ['B', 'C'], B: [], C: ['A'] };
      const fake = makeFakeRoot(graph, ['A'], { excludedByFilter: ['C'] });

      const result = await loadBlockers(fake.root)({ jql: 'key = A', blockerJQL: ' and type != Bug' });

      expect(keysOf(result)).toEqual(['A', 'B']);
      expect(fake.requestedKeys()).toEqual(['B', 'C']);
    });
  });

  // Matches the deep-children loader, which has no error handling at all: a failing batch rejects the
  // whole load and `ReportArea` renders Jira's `errorMessages`. Resolving to a partial blocker graph
  // would look like success, and a blanket catch here could not tell an unresolved key from a
  // malformed `blockerJQL`, a 429, or an auth failure.
  describe('a batch that errors', () => {
    it('propagates the failure instead of resolving to a partial graph', async () => {
      const graph: Graph = { A: ['B', 'C', 'BAD', 'D'], B: [], C: [], D: [] };
      const fake = makeFakeRoot(graph, ['A'], { poison: ['BAD'] });

      await expect(loadBlockers(fake.root)({ jql: 'key = A' })).rejects.toThrow(/unresolvable key/);
    });

    it('does not retry the failing batch', async () => {
      const graph: Graph = { A: ['BAD'], BAD: [] };
      const fake = makeFakeRoot(graph, ['A'], { poison: ['BAD'] });

      await expect(loadBlockers(fake.root)({ jql: 'key = A' })).rejects.toThrow();

      expect(fake.batchedKeys()).toEqual([['BAD']]);
    });
  });

  describe('progress', () => {
    it('reports the expansion phase and accumulates its counters', async () => {
      const graph: Graph = { A: ['B'], B: ['C'], C: [] };
      const fake = makeFakeRoot(graph, ['A']);
      const progress = newProgress();

      await loadBlockers(fake.root)({ jql: 'key = A' }, progress);

      expect(progress.data!.phase).toBe('children');
      expect(progress.data!.expandsBlockers).toBe(true);
      expect(progress.data!.parentsToProcess).toBe(2);
      expect(progress.data!.parentsProcessed).toBe(2);
      // Seeds + every candidate: A, B, C.
      expect([...progress.data!.keysAlreadyRequestedAsBlockers].sort()).toEqual(['A', 'B', 'C']);
    });
  });
});

/**
 * The composed case — `makeDeepBlockers(makeDeepChildren(flat))`, the last row of the loader table.
 * Driven through a fake `requestHelper` so the REAL children loader runs underneath, which is the
 * only way to show the closure actually closes: children of blockers and blockers of children both
 * arrive, with no bespoke alternating loop.
 */
describe('composed with the deep-children loader', () => {
  type Row = { id: string; key: string; blockedBy?: string[] };

  function makeConfig(issuesByJql: Record<string, Row[]>) {
    const requestHelper = vi.fn(async (urlFragment: string, options?: { method?: string; body?: string }) => {
      if (urlFragment.includes('approximate-count')) {
        const { jql } = JSON.parse(options!.body!);
        return { count: issuesByJql[jql]?.length ?? 0 };
      }
      if (urlFragment.includes('/api/3/search/jql')) {
        const jql = new URLSearchParams(urlFragment.split('?')[1]).get('jql') || '';
        if (!(jql in issuesByJql)) throw new Error(`Unexpected JQL: ${jql}`);
        return {
          issues: (issuesByJql[jql] ?? []).map(({ id, key, blockedBy }) => ({
            id,
            key,
            // The raw system-field id — the named-fields loader renames it via `idMap` below, which
            // is exactly the translation the blocker loader depends on.
            fields: { issuelinks: (blockedBy ?? []).map(blockedByLink) },
          })),
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
      fieldsRequest: async () => ({
        list: {} as any,
        nameMap: {},
        idMap: { issuelinks: 'Linked Issues' },
        ambiguousFieldIds: new Set<string>(),
      }),
      host: 'hosted',
    } as Config;
  }

  const ROOT_JQL = 'key = P-1';

  it('loads children of blockers and blockers of children, to a fixpoint', async () => {
    const config = makeConfig({
      // The root work item, blocked by B-1.
      [ROOT_JQL]: [{ id: '1', key: 'P-1', blockedBy: ['B-1'] }],
      // Its child, which is itself blocked by something outside the root JQL.
      'parent in (P-1) ': [{ id: '2', key: 'P-1-C', blockedBy: ['B-2'] }],
      'parent in (P-1-C) ': [],

      // ONE blocker round covers both. The root call returns the whole child cascade, so blocker
      // extraction runs over P-1 *and* P-1-C together — B-2, the child's blocker, is found in the
      // same pass as B-1 and batched with it.
      'key in (B-1, B-2) ': [
        { id: '3', key: 'B-1' },
        { id: '4', key: 'B-2' },
      ],
      // ...and because that batch goes THROUGH the children loader, the blockers' own children
      // arrive with them, with no second blocker round needed.
      'parent in (B-1, B-2) ': [{ id: '5', key: 'B-1-C' }],
      'parent in (B-1-C) ': [],
    });

    const load = makeDeepBlockersLoaderUsingNamedFields(config)(
      makeDeepChildrenLoaderUsingNamedFields(config)(fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config)),
    );

    const progress = newProgress();
    const result = await load({ jql: ROOT_JQL, fields: [] }, progress);

    expect(keysOf(result)).toEqual(['B-1', 'B-1-C', 'B-2', 'P-1', 'P-1-C']);
    expect(progress.data!.expandsChildren).toBe(true);
    expect(progress.data!.expandsBlockers).toBe(true);
  });

  // The children loader resets the phase and zeroes its counters on entry, and under full closure it
  // is entered once per blocker round. Only the first pass may reset, or the stepper's primary step
  // reverts to "active" mid-load and the parent count is thrown away.
  it('keeps the primary phase complete across the blocker rounds', async () => {
    const config = makeConfig({
      [ROOT_JQL]: [{ id: '1', key: 'P-1', blockedBy: ['B-1'] }],
      'parent in (P-1) ': [],
      'key in (B-1) ': [{ id: '2', key: 'B-1' }],
      'parent in (B-1) ': [],
    });

    const load = makeDeepBlockersLoaderUsingNamedFields(config)(
      makeDeepChildrenLoaderUsingNamedFields(config)(fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config)),
    );

    const phases: (string | undefined)[] = [];
    const progress = ((data: ProgressData) => phases.push(data.phase)) as Progress;

    await load({ jql: ROOT_JQL, fields: [] }, progress);

    // The first pass legitimately reports 'primary' while the root JQL is in flight. What must never
    // happen is a revert: once the expansion phase is reached, no later tick may go back.
    const firstExpansion = phases.indexOf('children');
    expect(firstExpansion).toBeGreaterThanOrEqual(0);
    expect(phases.slice(firstExpansion)).toEqual(phases.slice(firstExpansion).map(() => 'children'));
    expect(progress.data!.phase).toBe('children');
    // Accumulated rather than overwritten: the children loader counts P-1 on its first pass and B-1
    // on its second, and the blocker loader counts the B-1 candidate. `parentsProcessed` is fed from
    // the same three places, so the ratio the projection reads stays honest.
    expect(progress.data!.parentsToProcess).toBe(3);
    expect(progress.data!.parentsProcessed).toBe(3);
  });
});
