/**
 * This module makes requests, either to sample data, or to data from Jira
 */

import { bitoviTrainingIssueData } from "../examples/bitovi-training";
import bitoviTrainingData from "../examples/bitovi-training";
import { nativeFetchJSON } from "../jira-oidc-helpers";

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
    return nativeFetchJSON("./examples/bitovi-training-server-info.json");
  }
});

export const getSimplifiedIssueHierarchy = makeCacheable(({ jiraHelpers, isLoggedIn }) => {
  if (jiraHelpers.hasValidAccessToken()) {
    return jiraHelpers.fetchIssueTypes().then(simplifyIssueHierarchy);
  } else {
    return bitoviTrainingIssueData().then(simplifyIssueHierarchy);
  }
});

function simplifyIssueHierarchy(types) {
  const levelsToTypes = [];
  for (let type of types) {
    // ignore subtasks
    if (type.hierarchyLevel >= 0) {
      if (!levelsToTypes[type.hierarchyLevel]) {
        levelsToTypes[type.hierarchyLevel] = [];
      }
      levelsToTypes[type.hierarchyLevel].push(type);
    }
  }

  console.log({ types, levelsToTypes });

  return levelsToTypes
    .map((types, i) => {
      const story = types.find(({ name }) => name === "Story");

      if (story) {
        return story;
      }

      return types[0];
    })
    .filter((i) => i)
    .reverse();
}

const CORE_FIELDS = [
  "summary",
  "Rank",
  "Issue Type",
  "Fix versions",
  "Labels",
  "Status",
  "Sprint",
  "Created",
  "Parent",
  "Team",
];

export function getRawIssues({ isLoggedIn, loadChildren, jiraHelpers, jql, fields, childJQL }, { progressUpdate }) {
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
      childJQL: childJQL ? " and " + childJQL : "",
      fields: fieldsToLoad,
      expand: ["changelog"],
    },
    progressUpdate
  );
}
