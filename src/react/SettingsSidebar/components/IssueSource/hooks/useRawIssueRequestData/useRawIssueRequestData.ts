import type { CanPromise } from "../../../../../hooks/useCanObservable";
import type { JiraIssue } from "../../../../../../jira/shared/types";
import type { OidcJiraIssue } from "../../../../../../jira-oidc-helpers/types";

import { value } from "../../../../../../can";
import routeData from "../../../../../../canjs/routing/route-data";
import { useCanObservable } from "../../../../../hooks/useCanObservable";

export const useRawIssuesRequestData = () => {
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
    isLoading: issuesPromisePending,
    isSuccess: issuesPromiseResolved,
    numberOfIssues: issuesPromiseValueLength,
    receivedChunks: issuesReceived,
    totalChunks: issuesRequested,
  };
};
