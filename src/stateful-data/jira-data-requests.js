/**
 * This module makes requests, either to sample data, or to data from Jira
 */

import { bitoviTrainingIssueData } from '../examples/bitovi-training';
import bitoviTrainingData from '../examples/bitovi-training';
import { nativeFetchJSON } from '../jira-oidc-helpers';
import { CORE_FIELDS } from './core-fields.ts';
import { rawIssuesCacheKey } from './raw-issues-cache-key.ts';
import { withSharedRawIssues } from './raw-issues-cache.ts';

//import { getFormData } from "../react/Configure/components/Teams/services/team-configuration";
//import { createNormalizeConfiguration } from "../react/Configure/components/Teams/shared/normalize";

function makeCacheable(fn, time = 1000) {
  let cachePromise = null;
  let timeout = null;
  return function makeRequest(...args) {
    if (!timeout && cachePromise) {
      return cachePromise;
    } else {
      cachePromise = fn(...args);
      setTimeout(() => {
        cachePromise = timeout = null;
      }, time);
      return cachePromise;
    }
  };
}

/*
export function getTeamData({jiraHelpers, storage, isLoggedIn}) {
    if(isLoggedIn) {
        return getFormData(jiraHelpers, storage).then(createNormalizeConfiguration);
     } else {
         return Promise.resolve({});
     }
}*/

export const getServerInfo = makeCacheable(({ jiraHelpers, isLoggedIn }) => {
  if (isLoggedIn) {
    return jiraHelpers.getServerInfo();
  } else {
    return nativeFetchJSON('./examples/bitovi-training-server-info.json');
  }
});

export const getSimplifiedIssueHierarchy = makeCacheable(({ jiraHelpers, isLoggedIn }) => {
  if (isLoggedIn) {
    return jiraHelpers.fetchIssueTypes().then(simplifyIssueHierarchy);
  } else {
    return bitoviTrainingIssueData().then(simplifyIssueHierarchy);
  }
});

function simplifyIssueHierarchy(types) {
  if (!types || types.length === 0) {
    return [];
  }

  const levelsToTypes = {};
  // ignore any level with scope
  for (let type of types.filter((type) => !type.scope)) {
    if (!levelsToTypes[type.hierarchyLevel]) {
      levelsToTypes[type.hierarchyLevel] = [];
    }
    levelsToTypes[type.hierarchyLevel].push(type);
  }

  const hierarchy = Object.entries(levelsToTypes).map(([level, types]) => {
    const popularHierarchyNames = ['Story', 'Epic', 'Sub-Task'];

    for (const popularName of popularHierarchyNames) {
      const match = types.find(({ name }) => name === popularName);
      if (match) {
        return match;
      }
    }
    return types[0];
  });
  return hierarchy.sort((a, b) => b.hierarchyLevel - a.hierarchyLevel);
}

// Always-loaded fields, re-exported so route-data can treat them as "already requested" when deciding
// whether a Table column change actually alters the requested field set (avoids spurious refetches
// when adding/removing a column whose field is core). See requested-fields.ts / allFieldsToRequest.
// The list itself lives in core-fields.ts so raw-issues-cache-key.ts can read it without a cycle.
export { CORE_FIELDS };

/**
 * @param {object} request
 * @param {object} handlers
 * @param {(data: unknown) => void} [handlers.progressUpdate] fed every progress tick
 * @param {unknown} [handlers.owner] a stable per-caller token, so one caller recomputing onto the
 *   same request replaces its own progress subscription instead of registering a second one. Falls
 *   back to `progressUpdate`'s identity, which preserves today's behaviour for a caller that doesn't
 *   know about the cache.
 */
export function getRawIssues(
  { isLoggedIn, loadChildren, jiraHelpers, jql, fields, childJQL },
  { progressUpdate, owner },
) {
  // console.log("REQUESTING", { isLoggedIn, loadChildren, jiraHelpers, jql, fields, childJQL })
  // progressData.value = null; THIS NEEDS TO HAPPEN OUTSIDE
  if (isLoggedIn === false) {
    // mock data is already field-translated, and is module-cached in bitovi-training.js
    return bitoviTrainingData(new Date());
  }

  if (!fields) {
    return undefined;
  }

  let fieldsToLoad = [...new Set([...fields, ...CORE_FIELDS])];

  if (!jql) {
    return undefined;
  }

  const request = {
    jql: jql,
    childJQL: childJQL ? ' and ' + childJQL : '',
    fields: fieldsToLoad,
    expand: ['changelog'],
  };

  const startLoad = (progress) => {
    const loadIssues = loadChildren
      ? jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields.bind(jiraHelpers)
      : jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields.bind(jiraHelpers);

    return loadIssues(request, progress);
  };

  // A WeakMap lookup on a non-object throws, and today a missing `jiraHelpers` throws one line down
  // — i.e. AFTER the `!fields` / `!jql` guards above have had their chance to return `undefined`.
  // Skipping the cache here keeps that throw exactly where it was.
  if (!jiraHelpers) {
    return startLoad(progressUpdate);
  }

  // Dedupe on what will actually be SENT, resolved by the same rule the senders use: the maps come
  // off `jiraHelpers.fields` (undefined until the field request resolves, which can only miss a
  // dedupe, never create a false one). See raw-issues-cache-key.ts.
  const key = rawIssuesCacheKey({ isLoggedIn, loadChildren, jql, childJQL, fields }, jiraHelpers.fields);

  return withSharedRawIssues({ jiraHelpers, key, owner, progressUpdate }, startLoad);
}
