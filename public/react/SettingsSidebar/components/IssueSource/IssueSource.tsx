import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@atlaskit/button/new";

import {
  CanObservable,
  useCanObservable,
  CanPromise,
} from "../../../hooks/useCanObservable/useCanObservable.js";
import type { Jira } from "../../../../jira-oidc-helpers/index.js";
import type { JiraIssue } from "../../../../jira/shared/types.js";
import type { OidcJiraIssue } from "../../../../jira-oidc-helpers/types.js";
import { allStatusesSorted } from "../../../../jira/normalized/normalize.js";

import { value, Observation, SimpleObservable } from "../../../../can.js";
import routeData from "../../../../canjs/routing/route-data";

interface IssueSourceProps {
  isLoggedIn: boolean;
  jiraHelpers: Jira;
}

const useRawIssuesRequestData = () => {
  const issuesPromise = useCanObservable<CanPromise<JiraIssue[] | OidcJiraIssue[]>>(
    value.from(routeData, "rawIssuesRequestData.issuesPromise")
  );
  const issuesPromisePending = useCanObservable<boolean>(
    value.from(routeData, "rawIssuesRequestData.issuesPromise.isPending")
  );
  const issuesPromiseResolved = useCanObservable<boolean>(
    value.from(routeData, "rawIssuesRequestData.issuesPromise.isResolved")
  );
  const issuesPromiseValueLength = useCanObservable<number>(
    value.from(routeData, "rawIssuesRequestData.issuesPromise.value.length")
  );
  const issuesReceived = useCanObservable<number>(
    value.from(routeData, "rawIssuesRequestData.progressData.issuesReceived")
  );
  const issuesRequested = useCanObservable<number>(
    value.from(routeData, "rawIssuesRequestData.progressData.issuesRequested")
  );

  return {
    issuesPromise,
    issuesPromisePending,
    issuesPromiseResolved,
    issuesPromiseValueLength,
    issuesReceived,
    issuesRequested,
  };
};

const IssueSource: React.FC<IssueSourceProps> = ({ isLoggedIn, jiraHelpers }) => {
  const {
    issuesPromise,
    issuesPromisePending,
    issuesPromiseResolved,
    issuesPromiseValueLength,
    issuesReceived,
    issuesRequested,
  } = useRawIssuesRequestData();

  const loadChildren = useCanObservable(value.from<boolean>(routeData, "loadChildren"));

  const jqlFromRouteData = useCanObservable(value.from<string>(routeData, "jql"));
  const childJQLFromRouteData = useCanObservable(value.from<string>(routeData, "childJQL"));

  const statusesToExcludeFromRouteData = useCanObservable(
    value.from<string[]>(routeData, "statusesToExclude")
  );

  const derivedIssuesObservable: CanObservable<{ status: string; team: { name: string } }[]> =
    value.from(routeData, "derivedIssues");

  const processStatuses = () => {
    if (derivedIssuesObservable.get()) {
      return allStatusesSorted(derivedIssuesObservable.get());
    } else {
      return [];
    }
  };

  const numberOfStatuses = useCanObservable(
    new Observation(() => processStatuses()?.length) as unknown as CanObservable<number>
  );

  const [jqlValid, setJqlValid] = useState(true);
  const [jql, setJql] = useState(jqlFromRouteData);
  const [childJQL, setChildJQL] = useState(childJQLFromRouteData);
  const [childJQLValid, setChildJQLValid] = useState(true);
  const [jqlValidationPending, setJqlValidationPending] = useState(true);

  const selectedStatusFiltersObserve = useMemo(() => {
    return new SimpleObservable(statusesToExcludeFromRouteData);
  }, []);

  const selectedStatusFilters = useCanObservable<string[]>(selectedStatusFiltersObserve);

  const processStatusesObserve = new Observation(processStatuses) as unknown as CanObservable<
    JiraIssue[] | OidcJiraIssue[]
  >;

  const applyJql = useCallback(() => {
    routeData.assign({
      jql,
      childJQL,
      statusesToExclude: selectedStatusFilters,
    });
  }, [jql, childJQL, selectedStatusFilters]);

  const enableApply = useMemo(() => {
    return (
      !jqlValidationPending &&
      jqlValid &&
      (!loadChildren || childJQLValid) &&
      (jql !== jqlFromRouteData ||
        childJQL !== childJQLFromRouteData ||
        (selectedStatusFilters || []).some(
          (filter) => !statusesToExcludeFromRouteData.includes(filter)
        ) ||
        statusesToExcludeFromRouteData.some(
          (filter) => !(selectedStatusFilters || []).includes(filter)
        ))
    );
  }, [
    jqlValid,
    loadChildren,
    childJQLValid,
    jql,
    jqlFromRouteData,
    childJQL,
    childJQLFromRouteData,
    selectedStatusFilters,
    statusesToExcludeFromRouteData,
  ]);

  const statusFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (statusFilterRef.current) {
      // @ts-expect-error TS and Can doesn't get along
      const statusFilterEl = new StatusFilter()
        .bindings({
          statuses: value.from(processStatusesObserve),
          selectedStatuses: selectedStatusFiltersObserve,
        })
        .initialize({
          inputPlaceholder: "Search for statuses",
          param: "statusesToExclude",
          style: "max-width: 400px;",
        });
      statusFilterRef.current?.appendChild(statusFilterEl);
    }
  }, [numberOfStatuses]);

  useEffect(() => {
    (async () => {
      setJqlValidationPending(true);
      const response = await jiraHelpers.validateJQL(jql, loadChildren ? childJQL : "");
      setJqlValid(!response.queries[0].errors);
      setChildJQLValid(!response.queries[1].errors);
      setJqlValidationPending(false);
    })();
  }, [jql, childJQL, loadChildren]);

  return (
    <>
      <h3 className="h3">Issue Source</h3>
      <p>
        Specify a JQL that loads all issues you want to report on and help determine the timeline of
        your report.
      </p>
      <p>
        {isLoggedIn ? (
          <textarea
            className={`w-full-border-box mt-2 form-border p-1 ${jqlValid ? "" : "bg-red-200"}`}
            value={jql}
            onChange={(ev) => setJql(ev.target.value)}
          ></textarea>
        ) : (
          <input
            className="w-full-border-box mt-2 form-border p-1 text-yellow-300"
            value="Sample data. Connect to Jira to specify."
            disabled
          />
        )}
      </p>
      {issuesPromise?.isRejected && (
        <div className="border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked p-1">
          <p>There was an error loading from Jira!</p>
          <p>Error message: {issuesPromise.reason.errorMessages[0]}</p>
          <p>Please check your JQL is correct!</p>
        </div>
      )}
      <div className="flex flex-col justify-between mt-1">
        <p className="text-xs flex flex-col">
          <span>
            <input
              type="checkbox"
              name="loadChildren"
              className="self-start align-middle h-6 mr-0.5"
              checked={routeData.loadChildren}
              onChange={(ev) => (routeData.loadChildren = ev.target.checked)}
            />{" "}
            <label
              htmlFor="loadChildren"
              className="align-middle h-6"
              style={{ lineHeight: "26px" }}
            >
              Load children.{" "}
            </label>
          </span>
          <span className="align-middle h-6">
            {loadChildren && (
              <>
                Optional children JQL filters:{" "}
                <input
                  type="text"
                  className={`form-border p-1 h-5 ${childJQLValid ? "" : "bg-red-200"}`}
                  value={childJQL}
                  onChange={(ev) => setChildJQL(ev.target.value)}
                />
              </>
            )}
          </span>
        </p>
        <p className="text-xs" style={{ lineHeight: "26px" }}>
          {issuesPromisePending &&
            (issuesRequested ? (
              <>
                Loaded {issuesReceived} of {issuesRequested} issues
              </>
            ) : (
              <>Loading issues ...</>
            ))}
          {issuesPromiseResolved && <>Loaded {issuesPromiseValueLength} issues</>}
        </p>
      </div>
      {!!numberOfStatuses && (
        <>
          <h4 className="py-2 text-sm text-slate-300 font-bold">
            Statuses to exclude from all issue types
          </h4>
          <div className="status-filter-container" ref={statusFilterRef} />
        </>
      )}
      <div className="flex flex-row justify-end mt-2">
        <Button appearance="primary" isDisabled={!enableApply} onClick={applyJql}>
          <span className="text-sm">Apply</span>
        </Button>
      </div>
    </>
  );
};

export default IssueSource;
