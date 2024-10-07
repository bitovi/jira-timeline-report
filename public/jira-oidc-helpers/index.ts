import {
  JtrEnv,
  Config,
  RequestHelperResponse
} from "../shared/types";
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
  fetchAllJiraIssuesWithJQLAndFetchAllChangelog,
  fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields,
  fetchAllJiraIssuesWithJQLUsingNamedFields,
  fetchChildrenResponses,
  fetchDeepChildren,
  fetchJiraChangelog,
  fetchJiraFields,
  fetchIssueTypes,
  fetchJiraIssue,
  fetchJiraIssuesWithJQL,
  fetchJiraSprint,
  fetchRemainingChangelogsForIssues,
  fieldsRequest,
  fieldsToEditBody,
  editJiraIssueWithNamedFields,
  JiraIssueParamsToParams,
  isChangelogComplete,
  fetchRemainingChangelogsForIssue,
  fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields
} from "./jira";
import { _cachedServerInfoPromise, getServerInfo } from "./serverInfo.js";

// TODO move this into main module
declare global {
  interface Window {
    env: JtrEnv;
    localStorage: Storage;
    location: Location;
    jiraHelpers: any;
  }
}

const createJiraHelpers = (
  { JIRA_CLIENT_ID, JIRA_SCOPE, JIRA_CALLBACK_URL, JIRA_API_URL } = window.env,
  requestHelper: (urlFragment: string) => Promise<RequestHelperResponse>,
  host: "jira" | "hosted",
) => {
  const config: Config = {
    env: { JIRA_CLIENT_ID, JIRA_SCOPE, JIRA_CALLBACK_URL, JIRA_API_URL },
    requestHelper,
    host,
  };
  return {
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
    editJiraIssueWithNamedFields: editJiraIssueWithNamedFields(config),
    fetchJiraIssuesWithJQL: fetchJiraIssuesWithJQL(config),
    fieldsRequest: fieldsRequest(config),
    fetchJiraIssuesWithJQLWithNamedFields:
      fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(config),
    fetchAllJiraIssuesWithJQL: fetchAllJiraIssuesWithJQL(config),
    fetchAllJiraIssuesWithJQLUsingNamedFields:
      fetchAllJiraIssuesWithJQLUsingNamedFields(config),
    JiraIssueParamsToParams,
    fetchJiraChangelog: fetchJiraChangelog(config),
    isChangelogComplete,
    fetchRemainingChangelogsForIssues:
      fetchRemainingChangelogsForIssues(config),
    fetchRemainingChangelogsForIssue,
    fetchAllJiraIssuesWithJQLAndFetchAllChangelog:
      fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config),
    fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields:
      fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(config),
    fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields,
    fetchChildrenResponses: fetchChildrenResponses(config),
    fetchDeepChildren: fetchDeepChildren(config),
    fetchJiraFields: fetchJiraFields(config),
    fetchIssueTypes: fetchIssueTypes(config),
    getAccessToken: getAccessToken(config),
    hasAccessToken,
    hasValidAccessToken,
    _cachedServerInfoPromise,
    getServerInfo: getServerInfo(config),
    requester: requestHelper
  };
};

export default createJiraHelpers;
