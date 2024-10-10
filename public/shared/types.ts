import { OidcJiraIssue } from "../jira-oidc-helpers/types";
import { JiraIssue } from "../jira/shared/types";

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

export interface RequestHelperResponse {
  issues: OidcJiraIssue[] | JiraIssue[];
  maxResults: number;
  total: number;
  startAt: number;
  values: any[];
}

