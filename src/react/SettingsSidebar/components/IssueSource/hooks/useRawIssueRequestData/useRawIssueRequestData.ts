import type { CanPromise } from '../../../../../hooks/useCanObservable';
import { useRouteData } from '../../../../../hooks/useRouteData';
import type { JiraIssue } from '../../../../../../jira/shared/types';
import type { OidcJiraIssue } from '../../../../../../jira-oidc-helpers/types';

export const useRawIssuesRequestData = (): {
  issuesPromise: CanPromise<JiraIssue[] | OidcJiraIssue[]>;
  isLoading: boolean;
  isSuccess: boolean;
  numberOfIssues: number;
  receivedChunks: number;
  totalChunks: number;
} => {
  const [issuesPromise] = useRouteData<CanPromise<JiraIssue[] | OidcJiraIssue[]>>('rawIssuesRequestData.issuesPromise');

  const [issuesPromisePending] = useRouteData<boolean>('rawIssuesRequestData.issuesPromise.isPending');
  const [issuesPromiseResolved] = useRouteData<boolean>('rawIssuesRequestData.issuesPromise.isResolved');
  const [issuesPromiseValueLength] = useRouteData<number>('rawIssuesRequestData.issuesPromise.value.length');
  const [issuesReceived] = useRouteData<number>('rawIssuesRequestData.progressData.issuesReceived');
  const [issuesRequested] = useRouteData<number>('rawIssuesRequestData.progressData.issuesRequested');

  return {
    issuesPromise,
    isLoading: issuesPromisePending,
    isSuccess: issuesPromiseResolved,
    numberOfIssues: issuesPromiseValueLength,
    receivedChunks: issuesReceived,
    totalChunks: issuesRequested,
  };
};
