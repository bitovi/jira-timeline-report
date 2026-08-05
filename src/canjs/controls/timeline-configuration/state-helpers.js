import { ObservableObject, value, Reflect } from '../../../can.js';
import { deriveIssue } from '../../../jira/derived/derive.ts';
import { normalizeIssue } from '../../../jira/normalized/normalize.ts';

import { getServerInfo, getRawIssues } from '../../../stateful-data/jira-data-requests.js';
import { getVelocityDefault, getParallelWorkLimitDefault } from '../../../jira/normalized/defaults.ts';

const typesToHierarchyLevel = { Epic: 1, Story: 0, Initiative: 2 };
export function csvToRawIssues(csvIssues) {
  const res = csvIssues.map((issue) => {
    return {
      ...issue,
      fields: {
        ...issue,
        'Parent Link': { data: issue['Parent Link'] },
        'Issue Type': {
          name: issue['Issue Type'],
          hierarchyLevel: typesToHierarchyLevel[issue['Issue Type']],
        },
        Status: { name: issue.Status },
      },
      key: issue['Issue key'],
    };
  });
  return res;
}

export function rawIssuesRequestData(
  { jql, childJQL, isLoggedIn, loadChildren, jiraHelpers, fields },
  { listenTo, resolve },
) {
  const progressData = value.with(null);

  const promise = value.returnedBy(function rawIssuesPromise() {
    progressData.value = null;
    return getRawIssues(
      {
        isLoggedIn: isLoggedIn.value,
        loadChildren: loadChildren.value,
        jiraHelpers,
        jql: jql.value,
        childJQL: childJQL.value,
        fields: fields.value,
      },
      {
        progressUpdate: (receivedProgressData) => {
          progressData.value = { ...receivedProgressData };
        },
        // `getRawIssues` shares one fetch between callers asking the same thing and fans its progress
        // out to all of them, keyed by owner. This closure is rebuilt on every recompute, so it can't
        // be its own key: a config recomputing onto the same request would register a second callback
        // and every tick would write this observable twice. `progressData` is the one thing here that
        // is per-config AND survives a recompute — and it's what the callback writes to anyway.
        owner: progressData,
      },
    );
  });

  listenTo(promise, (value) => {
    resolve({
      progressData,
      issuesPromise: value,
    });
  });

  resolve({
    progressData,
    issuesPromise: promise.value,
  });
}

function resolve(value) {
  if (value instanceof Promise) {
    return value;
  } else {
    return Reflect.getValue(value);
  }
}

export function serverInfoPromise({ jiraHelpers, isLoggedIn }) {
  return getServerInfo({ jiraHelpers, isLoggedIn: resolve(isLoggedIn) });
}

export function configurationPromise({ serverInfoPromise, normalizeObservable }) {
  // we will give pending until we have both promises

  const info = resolve(serverInfoPromise),
    normalizeOptions = resolve(normalizeObservable);

  if (!info || !normalizeOptions) {
    return new Promise(() => {});
  }

  return Promise.all([info]).then(
    /**
     *
     * @param {[Object, TeamConfiguration]} param0
     * @returns
     */
    ([serverInfo]) => {
      const { getVelocity, getParallelWorkLimit, ...otherNormalizeParams } = normalizeOptions ?? {};
      return {
        getUrl({ key }) {
          return serverInfo.baseUrl + '/browse/' + key;
        },
        getVelocity(team, config) {
          const methodsToTry = [getVelocity, getVelocityDefault];
          for (let method of methodsToTry) {
            let value;
            if (method) {
              value = method(team, config);
            }
            if (value != null) {
              return value;
            }
          }
        },
        getParallelWorkLimit(team, config) {
          const methodsToTry = [getParallelWorkLimit, getParallelWorkLimitDefault];
          for (let method of methodsToTry) {
            let value;
            if (method) {
              value = method(team, config);
            }

            if (value != null) {
              return value;
            }
          }
        },
        ...otherNormalizeParams,
      };
    },
  );
}

export function derivedIssuesRequestData(
  { rawIssuesRequestData, configurationPromise, licensingPromise },
  { listenTo, resolve },
) {
  const promise = value.returnedBy(function derivedIssuesPromise() {
    if (rawIssuesRequestData.value.issuesPromise && configurationPromise.value) {
      return Promise.all([
        rawIssuesRequestData.value.issuesPromise,
        configurationPromise.value,
        licensingPromise.value,
      ]).then(([rawIssues, configuration, licensing]) => {
        if (!licensing.active) {
          const error = new Error('no licensing');
          error.type = 'no-licensing';

          throw error;
        }

        return rawIssues.map((issue) => {
          const normalized = normalizeIssue(issue, configuration);
          const derived = deriveIssue(normalized, configuration);
          return derived;
        });
      });
    } else {
      // This promise NEVER settles, so the report sits on its loading screen until some other
      // input changes. That is intended while the page is still waiting for a JQL, but it also
      // silently swallowed a cleared `fieldsToRequest` (spec/015-field-selection) — the freeze was
      // invisible because nothing logged. Say which input is missing.
      if (!rawIssuesRequestData.value.issuesPromise) {
        console.warn(
          [
            'derivedIssuesRequestData (state-helpers):',
            'No raw-issues request — the report will stay on its loading screen.',
            'getRawIssues returns undefined when `fields` or `jql` is missing.',
          ].join('\n'),
        );
      }
      // make a pending promise ...
      const promise = new Promise(() => {});
      promise.__isAlwaysPending = true;
      return promise;
    }
  });
  listenTo(promise, (derivedIssues) => {
    resolve({
      issuesPromise: derivedIssues,
      progressData: rawIssuesRequestData.value.progressData,
    });
  });
  resolve({
    issuesPromise: promise.value,
    progressData: rawIssuesRequestData.value.progressData,
  });
}
