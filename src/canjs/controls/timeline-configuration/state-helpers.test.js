// @vitest-environment jsdom

import { ObservableObject, value } from '../../../can.js';
import { rawIssuesRequestData, derivedIssuesRequestData } from './state-helpers.js';

const ResolverObservable = (function () {
  class T extends ObservableObject {
    static props = {
      value: {
        value({ listenTo, resolve }) {},
      },
    };
  }

  let t = new T();
  t.listenTo('value', function () {});
  // resolver, context, initialValue, {resetUnboundValueInGet}
  return t._computed.value.compute.constructor;
})();

function completeCallback(fn) {
  let done;
  const donePromise = new Promise((resolve) => {
    done = resolve;
  });
  return function (assert) {
    fn(assert, done);
    return donePromise;
  };
}

import { beforeEach, describe, expect, test } from 'vitest';
import { __clearRawIssuesCache } from '../../../stateful-data/raw-issues-cache.ts';

test('rawIssuesRequestData', function (assert) {
  const jql = value.with(''),
    childJQL = value.with(''),
    isLoggedIn = value.with(true),
    serverInfo = value.with({
      baseUrl: 'https://mistech.atlassian.net',
    }),
    teamData = value.with([{ name: 'JBM', velocity: 13, tracks: 2, sprintLength: 15 }]),
    loadChildren = value.with(true),
    jiraHelpers = {
      fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: function () {
        return Promise.resolve([{ key: 'TEST-123' }]);
      },
      fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: function () {
        return Promise.resolve([{ key: 'TEST-321' }]);
      },
    },
    fields = value.with([]);

  const requestData = new ResolverObservable(function (hooks) {
    return rawIssuesRequestData(
      {
        jql,
        childJQL,
        isLoggedIn,
        serverInfo,
        teamData,
        loadChildren,
        jiraHelpers,
        fields,
      },
      hooks,
    );
  });

  expect(requestData.value.issuesPromise).toBe(undefined);

  jql.value = 'Something';

  expect(typeof requestData.value.issuesPromise).toBe('object');
});

test('derivedIssuesRequestData', async function (assert) {
  const rawIssuesRequestData = value.with({
    issuesPromise: Promise.resolve([
      {
        key: 'TEST-123',
        fields: {
          'Issue Type': { hierarchyLevel: 7 },
          CONFIDENCE: 20,
        },
      },
    ]),
    progressData: {},
  });
  const configurationPromise = value.with(null);

  const derivedIssuesData = new ResolverObservable(function (hooks) {
    return derivedIssuesRequestData(
      {
        rawIssuesRequestData,
        configurationPromise,
        licensingPromise: value.with({ active: true }),
      },
      hooks,
    );
  });

  expect(derivedIssuesData.value.issuesPromise.__isAlwaysPending).toBe(true);

  configurationPromise.value = {
    getConfidence({ fields }) {
      return fields.CONFIDENCE;
    },
  };
  expect(derivedIssuesData.value.issuesPromise.__isAlwaysPending).toBe(undefined);

  /** @type {Array<import("../jira/derived/work-timing/work-timing.js").DerivedWorkIssue>} */
  const issues = await derivedIssuesData.value.issuesPromise;
  expect(issues[0].confidence).toBe(20);
});

/**
 * Two configs asking Jira the same thing share one fetch — see
 * spec/016-report-of-reports/005-optimize/001-request-dedupe Phase 2.
 *
 * The risk isn't the sharing, it's the progress bar: each config owns its own `progressData`
 * observable, and a naive shared promise would only ever move the first caller's while the rest sat
 * at `null` until the whole load finished.
 */
describe('two rawIssuesRequestData over identical inputs', () => {
  beforeEach(() => {
    __clearRawIssuesCache();
  });

  const makeHelpers = () => {
    const calls = [];

    return {
      calls,
      helpers: {
        fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(request, progress) {
          calls.push({ request, progress });
          return new Promise(() => {});
        },
        fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields(request, progress) {
          calls.push({ request, progress });
          return new Promise(() => {});
        },
      },
    };
  };

  /** One config's worth of plumbing, bound so its resolver actually runs. */
  const makeConfig = (jiraHelpers, overrides = {}) => {
    const observable = new ResolverObservable(function (hooks) {
      return rawIssuesRequestData(
        {
          jql: value.with('project = ORDER'),
          childJQL: value.with(''),
          isLoggedIn: value.with(true),
          loadChildren: value.with(false),
          jiraHelpers,
          fields: value.with([]),
          ...overrides,
        },
        hooks,
      );
    });

    // Reading the value is what kicks the CanJS pipeline off.
    return observable.value;
  };

  test('share one underlying call', () => {
    const { helpers, calls } = makeHelpers();

    makeConfig(helpers);
    makeConfig(helpers);

    expect(calls).toHaveLength(1);
  });

  test('both advance their own progressData on every tick', () => {
    const { helpers, calls } = makeHelpers();

    const first = makeConfig(helpers);
    const second = makeConfig(helpers);

    const { progress } = calls[0];
    progress.data = { issuesRequested: 10, issuesReceived: 3, phase: 'primary' };
    progress(progress.data);

    expect(first.progressData.value).toEqual({ issuesRequested: 10, issuesReceived: 3, phase: 'primary' });
    expect(second.progressData.value).toEqual({ issuesRequested: 10, issuesReceived: 3, phase: 'primary' });
    // Each callback shallow-copies before writing, so no two configs share a snapshot object — one
    // report's re-render must not depend on another's.
    expect(first.progressData.value).not.toBe(second.progressData.value);
  });

  test('a deep-children load runs its walk once, not twice', () => {
    const { helpers, calls } = makeHelpers();
    const deep = { loadChildren: value.with(true) };

    makeConfig(helpers, deep);
    makeConfig(helpers, deep);

    expect(calls).toHaveLength(1);
  });

  /**
   * The shared array must not be written to by anything downstream. `derivedIssuesRequestData` maps
   * it, and the rollup pipeline sees the raw issue *objects* — so freeze both and run the real
   * derive pass over them.
   *
   * This isn't a new class of risk: `rollupAndRollback` already re-runs whenever `when` changes, so
   * an in-place mutation would corrupt a single report today. It's cheap insurance against someone
   * adding an in-place sort later.
   */
  test('survive a frozen array shared between two configs', async () => {
    const rawIssues = Object.freeze([
      Object.freeze({
        key: 'ORDER-1',
        fields: Object.freeze({ 'Issue Type': { hierarchyLevel: 1 }, CONFIDENCE: 20 }),
      }),
    ]);

    const shared = value.with({ issuesPromise: Promise.resolve(rawIssues), progressData: {} });
    const configuration = value.with({ getConfidence: ({ fields }) => fields.CONFIDENCE });

    const derivedFor = () =>
      new ResolverObservable(function (hooks) {
        return derivedIssuesRequestData(
          {
            rawIssuesRequestData: shared,
            configurationPromise: configuration,
            licensingPromise: value.with({ active: true }),
          },
          hooks,
        );
      });

    const [first, second] = await Promise.all([derivedFor().value.issuesPromise, derivedFor().value.issuesPromise]);

    expect(first[0].confidence).toBe(20);
    expect(second[0].confidence).toBe(20);
    // The derived objects keep the raw issue by reference; neither pass wrote through it.
    expect(first[0].issue).toBe(rawIssues[0]);
  });
});
