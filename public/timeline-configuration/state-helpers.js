import { ObservableObject, value, Reflect } from "../can.js";
import { deriveIssue } from "../jira/derived/derive.js";
import { normalizeIssue } from "../jira/normalized/normalize.ts";

import { getServerInfo, getRawIssues } from "../stateful-data/jira-data-requests.js";

/*
class IssueData extends ObservableObject {
    static props = {
        jql: saveJSONToUrl("jql", "", String, {parse: x => ""+x, stringify: x => ""+x}),
        isLoggedIn: Boolean,
    }
}*/
const typesToHierarchyLevel = { Epic: 1, Story: 0, Initiative: 2 };
export function csvToRawIssues(csvIssues) {
  const res = csvIssues.map((issue) => {
    return {
      ...issue,
      fields: {
        ...issue,
        "Parent Link": { data: issue["Parent Link"] },
        "Issue Type": { name: issue["Issue Type"], hierarchyLevel: typesToHierarchyLevel[issue["Issue Type"]] },
        Status: { name: issue.Status },
      },
      key: issue["Issue key"],
    };
  });
  return res;
}

export function rawIssuesRequestData({ jql, childJQL, isLoggedIn, loadChildren, jiraHelpers }, { listenTo, resolve }) {
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
        // fields ... we will have to do this
      },
      {
        progressUpdate: (receivedProgressData) => {
          progressData.value = { ...receivedProgressData };
        },
      }
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

export function configurationPromise({ serverInfoPromise, teamConfigurationPromise, normalizeOptionsObservable }) {
  // we will give pending until we have both promises

  const info = resolve(serverInfoPromise),
    team = resolve(teamConfigurationPromise),
    normalizeOptions = resolve(normalizeOptionsObservable);
  if (!info || !team || !normalizeOptions) {
    return new Promise(() => {});
  }

  return Promise.all([info, team]).then(
    /**
     *
     * @param {[Object, TeamConfiguration]} param0
     * @returns
     */
    ([serverInfo, teamData]) => {
      return {
        getUrl({ key }) {
          return serverInfo.baseUrl + "/browse/" + key;
        },
        getVelocity(team) {
          return teamData.getVelocityForTeam(team);
        },
        getDaysPerSprint(team) {
          return teamData.getDaysPerSprintForTeam(team);
        },
        getParallelWorkLimit(team) {
          return teamData.getTracksForTeam(team);
        },
        ...(normalizeOptions ?? {}),
      };
    }
  );
}

export function derivedIssuesRequestData({ rawIssuesRequestData, configurationPromise }, { listenTo, resolve }) {
  const promise = value.returnedBy(function derivedIssuesPromise() {
    if (rawIssuesRequestData.value.issuesPromise && configurationPromise.value) {
      return Promise.all([rawIssuesRequestData.value.issuesPromise, configurationPromise.value]).then(
        ([rawIssues, configuration]) => {
          console.log({ rawIssues });
          return rawIssues.map((issue) => {
            const normalized = normalizeIssue(issue, configuration);
            const derived = deriveIssue(normalized, configuration);
            return derived;
          });
        }
      );
    } else {
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
