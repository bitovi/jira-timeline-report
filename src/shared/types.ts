import { OidcJiraIssue } from '../jira-oidc-helpers/types';
import { JiraIssue } from '../jira/shared/types';

export type JsonResponse<TData = object> = {
  accessToken: string;
  data: TData;
  expiryTimestamp: string;
  refreshToken: string;
  scopeId: string;
};

export type JtrEnv = {
  JIRA_CLIENT_ID: string;
  JIRA_SCOPE: string;
  JIRA_CALLBACK_URL: string;
  JIRA_API_URL: string;
  JIRA_APP_KEY: string;
};

export interface RequestHelperResponse<TValues = any[], TIssues = OidcJiraIssue[] | JiraIssue[]> {
  issues: TIssues;
  maxResults: number;
  total: number;
  startAt: number;
  values: TValues;
}

// New search API response type with pagination tokens
export interface SearchJiraResponse<TIssues = OidcJiraIssue[] | JiraIssue[]> {
  issues: TIssues;
  maxResults: number;
  total: number;
  startAt: number;
  nextPageToken?: string;
  isLast: boolean;
}
