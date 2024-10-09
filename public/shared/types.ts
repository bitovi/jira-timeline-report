import { OidcJiraIssue } from "../jira-oidc-helpers/types";
import { JiraIssue } from "../jira/shared/types";

export type JsonResponse = {
  accessToken: string;
  data: any; // TODO - what is the shape of this?
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

export interface RequestHelperResponse extends JsonResponse {
  issues: OidcJiraIssue[] | JiraIssue[];
  maxResults: number;
  total: number;
  startAt: number;
  values: any[];
}

