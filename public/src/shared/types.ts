type JsonResponse = {
  accessToken: string;
  data: any; // TODO - what is the shape of this?
  expiryTimestamp: string;
  refreshToken: string;
  scopeId: string;
};

type JtrEnv = {
  JIRA_CLIENT_ID: string;
  JIRA_SCOPE: string;
  JIRA_CALLBACK_URL: string;
  JIRA_API_URL: string;
};

interface RequestHelperResponse extends JsonResponse {
  issues: any;
  maxResults: any;
  total: any;
  startAt: any;
  values: any;
}

type RequestHelper = (urlFragment: string) => Promise<RequestHelperResponse>;

type FetchJiraIssuesParams = {
  accessToken?: string;
  jql?: string;
  fields?: string[];
  startAt?: number;
  maxResults?: number;
  limit?: number;
};

type JiraIssue = {
  id: string;
  key: string;
  fields: Record<string, any>;
  changelog?: any;
};

interface ResponseForFieldRequest extends RequestHelperResponse {
  idMap: { [key: string]: string };
  nameMap: { [key: string]: string };
}

type Issue = {
  key: string;
  fields: Record<string, any>; // Adjust based on the actual structure of fields
};

type Params = {
  [key: string]: any; // Adjust based on the actual structure of params
  fields?: string[];
};

type ProgressData = {
  issuesRequested: number;
  issuesReceived: number;
  changeLogsRequested: number;
  changeLogsReceived: number;
};

type Progress = {
  data?: ProgressData;
  (data: ProgressData): void;
};

export {
  JsonResponse,
  JtrEnv,
  RequestHelperResponse,
  RequestHelper,
  FetchJiraIssuesParams,
  JiraIssue,
  ResponseForFieldRequest,
  Issue,
  Params,
  ProgressData,
  Progress,
};
