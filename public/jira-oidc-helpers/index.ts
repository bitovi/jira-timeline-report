import {
  Config,
  FieldsRequest,
  RequestHelperResponse,
} from "./types";
import { JtrEnv } from "../shared/types";
import {
  saveInformationToLocalStorage,
  clearAuthFromLocalStorage,
  fetchFromLocalStorage
} from "./storage";
import {
  fetchAuthorizationCode,
  refreshAccessToken,
  fetchAccessTokenWithAuthCode,
  getAccessToken,
  hasAccessToken,
  hasValidAccessToken
} from "./auth";
import {
  fetchAccessibleResources,
  fetchAllJiraIssuesWithJQL,
  fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields,
  fetchAllJiraIssuesWithJQLUsingNamedFields,
  fetchChildrenResponses,
  fetchDeepChildren,
  fetchJiraChangelog,
  fetchIssueTypes,
  fetchJiraIssue,
  fetchJiraIssuesWithJQL,
  fetchJiraSprint,
  fetchRemainingChangelogsForIssues,
  fieldsToEditBody,
  editJiraIssueWithNamedFields,
  JiraIssueParamsToParams,
  isChangelogComplete,
  fetchRemainingChangelogsForIssue,
  fetchJiraIssuesWithJQLWithNamedFields,
} from "./jira";
import { fetchAllJiraIssuesWithJQLAndFetchAllChangelog } from "./fetchAllJiraIssuesWithJQLAndFetchAllChangelog";
import { fetchJiraFields, makeFieldsRequest } from "./makeFieldsRequest";
import { _cachedServerInfoPromise, getServerInfo } from "./serverInfo.js";
import { makeDeepChildrenLoaderUsingNamedFields } from "./makeDeepChildrenLoaderUsingNamedFields";

export { nativeFetchJSON } from './fetch'

// TODO move this into main module
declare global {
  interface Window {
    env: JtrEnv;
    localStorage: Storage;
    location: Location;
    jiraHelpers: any;
  }
}

export default function createJiraHelpers(
  { JIRA_CLIENT_ID, JIRA_SCOPE, JIRA_CALLBACK_URL, JIRA_API_URL, JIRA_APP_KEY } = window.env,
  requestHelper: (urlFragment: string) => Promise<RequestHelperResponse>,
  host: "jira" | "hosted",
) {
  let fieldsRequest: FieldsRequest
  const setFieldsRequest = (req: FieldsRequest) => fieldsRequest = req

  const config: Config = {
    env: { JIRA_CLIENT_ID, JIRA_SCOPE, JIRA_CALLBACK_URL, JIRA_API_URL, JIRA_APP_KEY },
    requestHelper,
    fieldsRequest: () => fieldsRequest,
    host,
  };

  const jiraHelpers = {
    appKey: JIRA_APP_KEY,
    saveInformationToLocalStorage,
    clearAuthFromLocalStorage,
    fetchFromLocalStorage,
    fetchAuthorizationCode: fetchAuthorizationCode(config),
    refreshAccessToken: refreshAccessToken(config),
    fetchAccessTokenWithAuthCode,
    fetchAccessibleResources: fetchAccessibleResources(config),
    fetchJiraSprint: fetchJiraSprint(config),
    fetchJiraIssue: fetchJiraIssue(config),
    fieldsToEditBody,
    fetchJiraIssuesWithJQL: fetchJiraIssuesWithJQL(config),
    fetchAllJiraIssuesWithJQL: fetchAllJiraIssuesWithJQL(config),
    JiraIssueParamsToParams,
    fetchJiraChangelog: fetchJiraChangelog(config),
    isChangelogComplete,
    fetchRemainingChangelogsForIssues:
      fetchRemainingChangelogsForIssues(config),
    fetchRemainingChangelogsForIssue,
    fetchAllJiraIssuesWithJQLAndFetchAllChangelog:
      fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config),
    fetchChildrenResponses: fetchChildrenResponses(config),
    fetchDeepChildren: fetchDeepChildren(config),
    fetchJiraFields: fetchJiraFields(config),
    fetchIssueTypes: fetchIssueTypes(config),
    getAccessToken: getAccessToken(config),
    hasAccessToken,
    hasValidAccessToken,
    _cachedServerInfoPromise,
    getServerInfo: getServerInfo(config),
    requester: requestHelper,

    editJiraIssueWithNamedFields: editJiraIssueWithNamedFields(config),
    fetchJiraIssuesWithJQLWithNamedFields:
      fetchJiraIssuesWithJQLWithNamedFields(config),
    fetchAllJiraIssuesWithJQLUsingNamedFields:
      fetchAllJiraIssuesWithJQLUsingNamedFields(config),
    fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields:
      fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(config),
    fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields:
      makeDeepChildrenLoaderUsingNamedFields(config)(
        fetchAllJiraIssuesWithJQL(config)),
    fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields:
      makeDeepChildrenLoaderUsingNamedFields(config)(
        fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config)),
  };

  makeFieldsRequest(config,setFieldsRequest)

  jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields =
    makeDeepChildrenLoaderUsingNamedFields(config)(
      jiraHelpers.fetchAllJiraIssuesWithJQL
        .bind(jiraHelpers)
    );

  jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields =
    makeDeepChildrenLoaderUsingNamedFields(config)(
      jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelog
        .bind(jiraHelpers)
    );

  return jiraHelpers
};
