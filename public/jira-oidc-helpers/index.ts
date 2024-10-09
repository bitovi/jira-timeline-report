/**
 * this module creates the jira oidc helpers object from all the helper functions in the jira-oidc-helpers folder.
 */
import {
  Config,
  FieldsRequest,
} from "./types";
import { RequestHelperResponse, JtrEnv } from "../shared/types";
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
  editJiraIssueWithNamedFields,
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
  // TODO currently fieldsRequest has to be defined and passed to other functions before it's
  // assigned, feels like there should be a better way to do it than this, but a setter function
  // was quickest solution i could come up with. Should revisit at some point.
  let fieldsRequest: FieldsRequest
  const setFieldsRequest = (req: FieldsRequest) => fieldsRequest = req

  const config: Config = {
    env: { JIRA_CLIENT_ID, JIRA_SCOPE, JIRA_CALLBACK_URL, JIRA_API_URL, JIRA_APP_KEY },
    requestHelper,
    fieldsRequest: () => fieldsRequest,
    host,
  };

  const makeDeep = makeDeepChildrenLoaderUsingNamedFields(config);

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
    editJiraIssueWithNamedFields: editJiraIssueWithNamedFields(config),
    fetchJiraIssuesWithJQL: fetchJiraIssuesWithJQL(config),
    fetchJiraIssuesWithJQLWithNamedFields:
      fetchJiraIssuesWithJQLWithNamedFields(config),
    fetchAllJiraIssuesWithJQL: fetchAllJiraIssuesWithJQL(config),
    fetchAllJiraIssuesWithJQLUsingNamedFields:
      fetchAllJiraIssuesWithJQLUsingNamedFields(config),
    fetchJiraChangelog: fetchJiraChangelog(config),
    isChangelogComplete,
    fetchRemainingChangelogsForIssues:
      fetchRemainingChangelogsForIssues(config),
    fetchRemainingChangelogsForIssue:
      fetchRemainingChangelogsForIssue(config),
    fetchAllJiraIssuesWithJQLAndFetchAllChangelog:
      fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config),
    fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields:
      fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(config),
    fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields:
      makeDeep(fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config)),
    fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields:
      makeDeep(fetchAllJiraIssuesWithJQL(config)),
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
  };

  makeFieldsRequest(config, setFieldsRequest)

  jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields =
    makeDeep(jiraHelpers.fetchAllJiraIssuesWithJQL.bind(jiraHelpers));

  jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields =
    makeDeep(jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelog.bind(jiraHelpers));

  return jiraHelpers
};
