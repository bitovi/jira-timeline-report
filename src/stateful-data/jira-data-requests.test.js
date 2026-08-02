/**
 * `getRawIssues` request-dedupe — spec/016-report-of-reports/005-optimize/001-request-dedupe,
 * Phases 2 and 3.
 *
 * A call-counting fake `jiraHelpers`, per the pattern in `ChildReportConfig.test.js` and
 * `state-helpers.test.js`. What's under test is how many times the underlying loader runs, which is
 * the whole point: production is returning Jira 429s because a document runs one complete fetch
 * cascade per embedded report.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getRawIssues } from './jira-data-requests.js';
import { __clearRawIssuesCache } from './raw-issues-cache.ts';

const deferred = () => {
  let settle;
  let fail;
  const promise = new Promise((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  return { promise, settle, fail };
};

/** Records every call to both loaders, and lets the test decide when each one settles. */
const makeHelpers = () => {
  const flat = [];
  const deep = [];

  const helpers = {
    fields: undefined,
    fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(request, progress) {
      const pending = deferred();
      flat.push({ request, progress, ...pending });
      return pending.promise;
    },
    fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields(request, progress) {
      const pending = deferred();
      deep.push({ request, progress, ...pending });
      return pending.promise;
    },
  };

  return { helpers, flat, deep };
};

const baseRequest = { isLoggedIn: true, loadChildren: false, jql: 'project = ORDER', childJQL: '', fields: [] };

describe('getRawIssues', () => {
  let helpers;
  let flat;
  let deep;

  beforeEach(() => {
    ({ helpers, flat, deep } = makeHelpers());
    __clearRawIssuesCache();
  });

  const request = (overrides = {}, handlers = {}) =>
    getRawIssues({ ...baseRequest, jiraHelpers: helpers, ...overrides }, handlers);

  describe('singleflight', () => {
    it('runs one load for two identical requests, and hands both the same array', async () => {
      const first = request();
      const second = request();

      expect(flat).toHaveLength(1);

      const issues = [{ key: 'ORDER-1' }];
      flat[0].settle(issues);

      // The SAME array, not an equal one: sharing the identity is what lets a follow-up cache the
      // derived array off it.
      expect(await first).toBe(await second);
      expect(await first).toBe(issues);
    });

    // The insertion-order trap: `allFieldsToRequest` is a Set union whose tail is ordered by the
    // report's column order, so two Tables showing the same columns in a different order would
    // otherwise miss each other entirely.
    it('runs one load for field lists differing only in order', () => {
      request({ fields: ['customfield_1', 'customfield_2'] });
      request({ fields: ['customfield_2', 'customfield_1'] });

      expect(flat).toHaveLength(1);
    });

    it('folds CORE_FIELDS in, so a core-only column list matches an empty one', () => {
      request({ fields: ['Status'] });
      request({ fields: [] });

      expect(flat).toHaveLength(1);
    });

    it.each([
      ['jql', { jql: 'project = BILLING' }],
      ['childJQL', { childJQL: 'type = Bug' }],
      ['a non-core field', { fields: ['customfield_1'] }],
    ])('runs a second load when %s differs', (_label, overrides) => {
      request();
      request(overrides);

      expect(flat).toHaveLength(2);
    });

    it('picks the deep loader for loadChildren, once', () => {
      request({ loadChildren: true });
      request({ loadChildren: true });

      expect(deep).toHaveLength(1);
      expect(flat).toHaveLength(0);
    });

    it('keeps the deep and flat loads apart', () => {
      request({ loadChildren: true });
      request({ loadChildren: false });

      expect(deep).toHaveLength(1);
      expect(flat).toHaveLength(1);
    });

    it('does not share between two different Jira sites', () => {
      const other = makeHelpers();

      request();
      getRawIssues({ ...baseRequest, jiraHelpers: other.helpers }, {});

      expect(flat).toHaveLength(1);
      expect(other.flat).toHaveLength(1);
    });
  });

  describe('the existing guards are untouched', () => {
    it.each([
      ['fields is missing', { fields: undefined }],
      ['jql is empty', { jql: '' }],
    ])('returns undefined when %s', (_label, overrides) => {
      expect(request(overrides)).toBeUndefined();
    });

    /**
     * A WeakMap lookup on a non-object throws, so the cache is skipped without `jiraHelpers` — and a
     * missing one must still throw where it always did, i.e. AFTER the guards above have had their
     * chance to return `undefined`.
     */
    it('throws for a missing jiraHelpers, but only once past the guards', () => {
      expect(() => getRawIssues({ ...baseRequest, jiraHelpers: undefined }, {})).toThrow();
      expect(getRawIssues({ ...baseRequest, jiraHelpers: undefined, fields: undefined }, {})).toBeUndefined();
      expect(getRawIssues({ ...baseRequest, jiraHelpers: undefined, jql: '' }, {})).toBeUndefined();
    });
  });

  describe('progress fan-out', () => {
    it('feeds every subscriber on each tick, each with its own snapshot to copy', async () => {
      const first = [];
      const second = [];

      request({}, { progressUpdate: (data) => first.push(data), owner: 'a' });
      request({}, { progressUpdate: (data) => second.push(data), owner: 'b' });

      const { progress } = flat[0];
      progress.data = { issuesRequested: 10, issuesReceived: 0 };
      progress(progress.data);

      expect(first).toHaveLength(1);
      expect(second).toHaveLength(1);
      expect(first[0]).toEqual({ issuesRequested: 10, issuesReceived: 0 });
    });

    /**
     * `rawIssuesPromise` builds a NEW closure on every recompute, and a config can legitimately
     * recompute onto the same request. Keying by a stable owner means the second closure replaces the
     * first instead of doubling it — otherwise every tick would write one observable twice.
     */
    it('replaces a subscriber that re-registers under the same owner', () => {
      const ticks = [];
      const owner = {};

      request({}, { progressUpdate: () => ticks.push('first'), owner });
      request({}, { progressUpdate: () => ticks.push('second'), owner });

      const { progress } = flat[0];
      progress.data = { issuesRequested: 1 };
      progress(progress.data);

      expect(ticks).toEqual(['second']);
    });

    /**
     * Under `loadChildren`, ticks can be seconds apart — a report joining mid-flight must not sit at
     * an empty bar until the next one. Delivery is on a microtask, not synchronously: the caller is
     * inside a `value.returnedBy` recompute that has just nulled its own observable.
     */
    it('catches a late subscriber up on the next microtask', async () => {
      request({}, { progressUpdate: () => {}, owner: 'a' });

      const { progress } = flat[0];
      progress.data = { issuesRequested: 10, issuesReceived: 4 };
      progress(progress.data);

      const late = [];
      request({}, { progressUpdate: (data) => late.push(data), owner: 'b' });

      expect(late).toHaveLength(0);
      await Promise.resolve();

      expect(late).toEqual([{ issuesRequested: 10, issuesReceived: 4 }]);
      // Catching up must not fabricate a tick for anyone else.
      expect(flat).toHaveLength(1);
    });

    it('gives a subscriber joining before any tick no phantom snapshot', async () => {
      const joined = [];

      request({}, { progressUpdate: () => {}, owner: 'a' });
      request({}, { progressUpdate: (data) => joined.push(data), owner: 'b' });

      await Promise.resolve();

      expect(joined).toEqual([]);
    });

    it('stops feeding subscribers once the load settles', async () => {
      const ticks = [];

      const promise = request({}, { progressUpdate: (data) => ticks.push(data), owner: 'a' });
      const { progress } = flat[0];

      flat[0].settle([]);
      await promise;

      progress.data = { issuesRequested: 1 };
      progress(progress.data);

      expect(ticks).toEqual([]);
    });
  });

  describe('failure', () => {
    it('rejects every joined caller with the same reason', async () => {
      const first = request();
      const second = request();
      const reason = new Error('429');

      flat[0].fail(reason);

      await expect(first).rejects.toBe(reason);
      await expect(second).rejects.toBe(reason);
    });

    // A failure is never cached: the next mount retries rather than replaying the error.
    it('refetches after a failure', async () => {
      const first = request();
      flat[0].fail(new Error('429'));
      await expect(first).rejects.toThrow();

      request();

      expect(flat).toHaveLength(2);
    });

    it('does not report an unhandled rejection when a caller binds late', async () => {
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);

      const promise = request();
      flat[0].fail(new Error('429'));

      // Two macrotask turns: long enough for Node to have flagged an unhandled rejection.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await expect(promise).rejects.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 0));

      process.off('unhandledRejection', unhandled);
      expect(unhandled).not.toHaveBeenCalled();
    });
  });

  describe('TTL on the resolved value', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    // Wrapped: `return promise` from an async function would hand back the resolved array, and the
    // identity of the promise itself is what one of these tests is about.
    const settled = async () => {
      const promise = request();
      flat[0].settle([{ key: 'ORDER-1' }]);
      await promise;

      return { promise };
    };

    it('serves a caller arriving shortly after settle', async () => {
      const { promise: first } = await settled();

      vi.advanceTimersByTime(5_000);

      // The same promise, so the same array identity survives a cache hit.
      expect(request()).toBe(first);
      expect(flat).toHaveLength(1);
    });

    it('refetches once the entry has aged out', async () => {
      await settled();

      vi.advanceTimersByTime(31_000);
      request();

      expect(flat).toHaveLength(2);
    });

    /**
     * The clock starts at SETTLE, not at call — `makeCacheable` times from call, which is why it
     * can't be reused here: a 40 s deep-children load would expire while still in flight.
     */
    it('does not expire a load that is still running', async () => {
      const first = request();

      vi.advanceTimersByTime(39_000);
      expect(request()).toBe(first);
      expect(flat).toHaveLength(1);

      flat[0].settle([]);
      await first;

      // Settled at t=39s, so it lives to t=69s.
      vi.advanceTimersByTime(20_000);
      request();
      expect(flat).toHaveLength(1);
    });

    it('never caches a rejection, however recent', async () => {
      const first = request();
      flat[0].fail(new Error('429'));
      await expect(first).rejects.toThrow();

      vi.advanceTimersByTime(1_000);
      request();

      expect(flat).toHaveLength(2);
    });

    // The hook a Refresh button must call — nothing in production forces a reload today.
    it('refetches after __clearRawIssuesCache', async () => {
      await settled();

      __clearRawIssuesCache();
      request();

      expect(flat).toHaveLength(2);
    });
  });
});
