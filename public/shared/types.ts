import { JiraIssue } from "../jira/shared/types";

export type JtrEnv = {
  JIRA_CLIENT_ID: string;
  JIRA_SCOPE: string;
  JIRA_CALLBACK_URL: string;
  JIRA_API_URL: string;
};

export type JsonResponse = {
  accessToken: string
  data: any
  expiryTimestamp: string
  refreshToken: string
  scopeId: string
}

export interface RequestHelperResponse extends JsonResponse {
  issues: JiraIssue[],
  maxResults: number,
  total: number,
  startAt: number,
  values: any[]
}
export type RequestHelper = (urlFragment: string) => Promise<RequestHelperResponse>;

export interface ResponseForFieldRequest extends RequestHelperResponse {
  idMap: { [key: string]: string; };
  nameMap: { [key: string]: string; };
}

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

export type Config = {
  env: {
    JIRA_CLIENT_ID: string;
    JIRA_SCOPE: string;
    JIRA_CALLBACK_URL: string;
    JIRA_API_URL: string;
  };
  requestHelper: RequestHelper;
  host: "jira" | "hosted";
};
