/**
 * this module contains the types needed by the jira oidc helpers.
 */
import { JiraIssue } from '../jira/shared/types';
import { RequestHelperResponse } from '../shared/types';

export type History = {
  id: string;
  created: string | number; // ISO string from individual API, Unix timestamp from bulk API
  author?: any;
  items?: any[];
  [key: string]: any; // Allow other fields
};
export type ChangeLog = {
  histories: History[];
  maxResults: number;
  total: number;
  startAt: number;
};
export type OidcJiraIssue = {
  id: string;
  key: string;
  fields: Record<string, any>;
  changelog?: ChangeLog;
};
export type InterimJiraIssue = {
  id: string;
  key: string;
  fields: Record<string, any>;
  changelog?: History[];
};
export type FieldsData = {
  list: RequestHelperResponse;
  nameMap: Record<string, any>;
  idMap: Record<string, any>;
};
export type FieldsRequest = Promise<FieldsData>;
export type Issue = {
  key: string;
  fields: Record<string, any>; // Adjust based on the actual structure of fields
};

export type Params = {
  [key: string]: any; // Adjust based on the actual structure of params
  fields?: string[];
};

export type ProgressData = {
  issuesRequested: number;
  issuesReceived: number;
  changeLogsRequested: number;
  changeLogsReceived: number;
  keysWhoseChildrenWeAreAlreadyLoading: Set<string>;
};

export type Progress = {
  data?: ProgressData;
  (data: ProgressData): void;
};
export interface ResponseForFieldRequest extends RequestHelperResponse {
  idMap: { [key: string]: string };
  nameMap: { [key: string]: string };
}

export type RequestHelper = <TValues = any[], TIssues = OidcJiraIssue[] | JiraIssue[]>(
  urlFragment: string,
  options?: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  },
) => Promise<RequestHelperResponse<TValues, TIssues>>;

export type Config = {
  env: {
    JIRA_CLIENT_ID: string;
    JIRA_SCOPE: string;
    JIRA_CALLBACK_URL: string;
    JIRA_API_URL: string;
    JIRA_APP_KEY: string;
  };
  requestHelper: RequestHelper;
  fieldsRequest: () => FieldsRequest;
  host: 'jira' | 'hosted';
};

/**
 * Bulk changelog API types
 */
export type BulkChangelogRequest = {
  issueIdsOrKeys: string[];
  fieldIds?: string[];
  maxResults?: number;
  nextPageToken?: string;
};

export type BulkChangelogResponse = {
  issueChangeLogs: {
    issueId: string;
    changeHistories: History[];
  }[];
  nextPageToken?: string;
};

export type IssueChangelogMap = Map<string, History[]>;
