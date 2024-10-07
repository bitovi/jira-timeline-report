import { JiraIssue } from "../jira/shared/types";
import { JsonResponse } from "../shared/types";

export type History = {
    id: string;
    change: string;
};
export type ChangeLog = {
    histories: History[];
    maxResults: number;
    total: number;
    startAt: number;
}
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
export type FieldsRequest = Promise<{
    list: RequestHelperResponse;
    nameMap: Record<string, any>;
    idMap: Record<string, any>;
}>;
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
};

export type Progress = {
  data?: ProgressData;
  (data: ProgressData): void;
};
export interface ResponseForFieldRequest extends RequestHelperResponse {
  idMap: { [key: string]: string; };
  nameMap: { [key: string]: string; };
}

export interface RequestHelperResponse extends JsonResponse {
  issues: OidcJiraIssue[] | JiraIssue[],
  maxResults: number,
  total: number,
  startAt: number,
  values: any[]
}

export type RequestHelper = (urlFragment: string) => Promise<RequestHelperResponse>;

export type Config = {
  env: {
    JIRA_CLIENT_ID: string;
    JIRA_SCOPE: string;
    JIRA_CALLBACK_URL: string;
    JIRA_API_URL: string;
    JIRA_APP_KEY: string;
  };
  requestHelper: RequestHelper;
  host: "jira" | "hosted";
};

