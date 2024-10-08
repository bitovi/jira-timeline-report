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
  JIRA_APP_KEY: string;
};

interface RequestHelperResponse extends JsonResponse {
  issues: any;
  maxResults: any;
  total: any;
  startAt: any;
  values: any;
}

export { JsonResponse, JtrEnv, RequestHelperResponse };
