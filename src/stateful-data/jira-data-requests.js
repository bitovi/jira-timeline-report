/**
 * This module makes requests, either to sample data, or to data from Jira
 */

import { bitoviTrainingIssueData } from '../examples/bitovi-training';
import bitoviTrainingData from '../examples/bitovi-training';
import { nativeFetchJSON } from '../jira-oidc-helpers';

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

const CORE_FIELDS = [
  'summary',
  'Rank',
  'Issue Type',
  'Fix versions',
  'Labels',
  'Status',
  'Sprint',
  'Created',
  'Parent',
  'Team',
  'Linked Issues',
];

export function getRawIssues({ isLoggedIn, loadChildren, jiraHelpers, jql, fields, childJQL }, { progressUpdate }) {
  // console.log("REQUESTING", { isLoggedIn, loadChildren, jiraHelpers, jql, fields, childJQL })
  // progressData.value = null; THIS NEEDS TO HAPPEN OUTSIDE
  if (isLoggedIn === false) {
    // mock data is already field-translated
    return bitoviTrainingData(new Date());
  }

  if (!fields) {
    return undefined;
  }

  let fieldsToLoad = [...new Set([...fields, ...CORE_FIELDS])];

  if (!jql) {
    return undefined;
  }

  const loadIssues = loadChildren
    ? jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields.bind(jiraHelpers)
    : jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields.bind(jiraHelpers);

  return loadIssues(
    {
      jql: jql,
      childJQL: childJQL ? ' and ' + childJQL : '',
      fields: fieldsToLoad,
      expand: ['changelog'],
    },
    progressUpdate,
  );
}
