// @vitest-environment jsdom

import { ObservableObject, value } from "../../../can.js";
import { rawIssuesRequestData, derivedIssuesRequestData } from "./state-helpers.js";

const ResolverObservable = (function () {
  class T extends ObservableObject {
    static props = {
      value: {
        value({ listenTo, resolve }) {},
      },
    };
  }

  let t = new T();
  t.listenTo("value", function () {});
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

import { expect, test } from "vitest";

test("rawIssuesRequestData", function (assert) {
  const jql = value.with(""),
    childJQL = value.with(""),
    isLoggedIn = value.with(true),
    serverInfo = value.with({
      baseUrl: "https://mistech.atlassian.net",
    }),
    teamData = value.with([{ name: "JBM", velocity: 13, tracks: 2, sprintLength: 15 }]),
    loadChildren = value.with(true),
    jiraHelpers = {
      fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: function () {
        return Promise.resolve([{ key: "TEST-123" }]);
      },
      fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: function () {
        return Promise.resolve([{ key: "TEST-321" }]);
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
      hooks
    );
  });

  expect(requestData.value.issuesPromise).toBe(undefined);

  jql.value = "Something";

  expect(typeof requestData.value.issuesPromise).toBe("object");
});

test("derivedIssuesRequestData", async function (assert) {
  const rawIssuesRequestData = value.with({
    issuesPromise: Promise.resolve([
      {
        key: "TEST-123",
        fields: {
          "Issue Type": { hierarchyLevel: 7 },
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
      hooks
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
