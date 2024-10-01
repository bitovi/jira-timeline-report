import { JiraIssue } from "../jira/shared/types"

type JsonResponse <T>= {
  accessToken: string
  data: T
  expiryTimestamp: string
  refreshToken: string
  scopeId: string
}

type JtrEnv = {
  JIRA_CLIENT_ID: string
  JIRA_SCOPE: string
  JIRA_CALLBACK_URL: string
  JIRA_API_URL: string
}

interface RequestHelperResponse<T> extends JsonResponse<T> {
	issues: JiraIssue[],
	maxResults: number,
	total: number,
	startAt: number,
	values: any
}

export {
  JsonResponse,
  JtrEnv,
  RequestHelperResponse
};