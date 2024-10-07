import {
  JtrEnv,
  Config,
  RequestHelperResponse,
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
} from "./jira";
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
  { JIRA_CLIENT_ID, JIRA_SCOPE, JIRA_CALLBACK_URL, JIRA_API_URL } = window.env,
  requestHelper: (urlFragment: string) => Promise<RequestHelperResponse>,
  host: "jira" | "hosted",
) {
  const config: Config = {
    env: { JIRA_CLIENT_ID, JIRA_SCOPE, JIRA_CALLBACK_URL, JIRA_API_URL },
    requestHelper,
    host,
  };

  const jiraHelpersBasic = {
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
    fetchAllJiraIssuesWithJQLUsingNamedFields:
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
    requester: requestHelper
  };

  if (config.host === "jira" || hasValidAccessToken()) {

    const fieldsRequest = makeFieldsRequest(config);

    const jiraHelpers = {
      ...jiraHelpersBasic,
      editJiraIssueWithNamedFields: editJiraIssueWithNamedFields(config, fieldsRequest),
      fetchJiraIssuesWithJQLWithNamedFields:
        fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(config, fieldsRequest),
      fetchAllJiraIssuesWithJQLUsingNamedFields:
        fetchAllJiraIssuesWithJQLUsingNamedFields(config, fieldsRequest),
      fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields:
        fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(config, fieldsRequest),
      fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields:
        makeDeepChildrenLoaderUsingNamedFields(fieldsRequest)(
          fetchAllJiraIssuesWithJQL(config)),
      fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields:
        makeDeepChildrenLoaderUsingNamedFields(fieldsRequest)(
          fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config)),
    };

    jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields =
      makeDeepChildrenLoaderUsingNamedFields(fieldsRequest)(
        jiraHelpers.fetchAllJiraIssuesWithJQL
          .bind(jiraHelpers)
      );

    jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields =
      makeDeepChildrenLoaderUsingNamedFields(fieldsRequest)(
        jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelog
          .bind(jiraHelpers)
      );

    return jiraHelpers
  }
  
  return jiraHelpersBasic
};
