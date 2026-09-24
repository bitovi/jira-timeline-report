/**
 * this module creates the jira oidc helpers object from all the helper functions in the jira-oidc-helpers folder.
 */
import { Config, FieldsRequest, RequestHelper, FieldsData } from './types';
import { RequestHelperResponse, JtrEnv } from '../shared/types';
import { saveInformationToLocalStorage, clearAuthFromLocalStorage, fetchFromLocalStorage } from './storage';
import {
  fetchAuthorizationCode,
  refreshAccessToken,
  fetchAccessTokenWithAuthCode,
  getAccessToken,
  hasAccessToken,
  hasValidAccessToken,
  timeRemainingBeforeAccessTokenExpiresInSeconds,
} from './auth';
import {
  fetchAccessibleResources,
  fetchAllJiraIssuesWithJQL,
  fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields,
  fetchAllJiraIssuesWithJQLUsingNamedFields,
  fetchChildrenResponses,
  fetchDeepChildren,
  fetchJiraChangelog,
  fetchIssueTypes,
  fetchJiraProject,
  fetchProjectIssueTypes,
  createJiraIssue,
  fetchJiraIssue,
  fetchLatestComment,
  fetchRecentComments,
  fetchIssuePickerSuggestions,
  fetchJiraIssuesWithJQL,
  fetchJqlAutocompleteData,
  fetchJqlAutocompleteSuggestions,
  fetchJiraSprint,
  fetchRemainingChangelogsForIssues,
  editJiraIssueWithNamedFields,
  isChangelogComplete,
  fetchRemainingChangelogsForIssue,
  fetchJiraIssuesWithJQLWithNamedFields,
} from './jira';
import { fetchAllJiraIssuesWithJQLAndFetchAllChangelog } from './fetchAllJiraIssuesWithJQLAndFetchAllChangelog';
import { fetchJiraFields, makeFieldsRequest } from './fields';
import { _cachedServerInfoPromise, getServerInfo } from './serverInfo.js';
import { makeDeepChildrenLoaderUsingNamedFields } from './makeDeepChildrenLoaderUsingNamedFields';
import { makeDeepBlockersLoaderUsingNamedFields } from './makeDeepBlockersLoaderUsingNamedFields';

export { nativeFetchJSON } from './fetch';

// TODO move this into main module
declare global {
  interface Window {
    env: JtrEnv;
    localStorage: Storage;
    location: Location;
    jiraHelpers: any;
  }
}

export type Jira = ReturnType<typeof createJiraHelpers>;

export default function createJiraHelpers(
  { JIRA_CLIENT_ID, JIRA_SCOPE, JIRA_CALLBACK_URL, JIRA_API_URL, JIRA_APP_KEY } = window.env,
  requestHelper: RequestHelper,
  host: 'jira' | 'hosted',
) {
  // TODO currently fieldsRequest has to be defined and passed to other functions before it's
  // assigned, feels like there should be a better way to do it than this, but a setter function
  // was quickest solution i could come up with. Should revisit at some point.
  let fieldsRequest: FieldsRequest;
  const setFieldsRequest = (req: FieldsRequest) => {
    fieldsRequest = req;
    fieldsRequest.then((fieldsData: FieldsData) => {
      if (jiraHelpers) {
        jiraHelpers.fields = fieldsData;
      }
    });
  };

  const config: Config = {
    env: { JIRA_CLIENT_ID, JIRA_SCOPE, JIRA_CALLBACK_URL, JIRA_API_URL, JIRA_APP_KEY },
    requestHelper,
    fieldsRequest: () => fieldsRequest,
    host,
  };

  const makeDeep = makeDeepChildrenLoaderUsingNamedFields(config);
  const makeBlockers = makeDeepBlockersLoaderUsingNamedFields(config);

  const jiraHelpers = {
    appKey: JIRA_APP_KEY,
    /**
     * Which build this is — `jira` for the Connect app embedded in Jira, `hosted` for the
     * standalone web app. Already on `config`; surfaced here because the Storage settings panel has
     * to know which of its two cards describes the host the user is actually in.
     */
    host,
    saveInformationToLocalStorage,
    clearAuthFromLocalStorage,
    fetchFromLocalStorage,
    fetchAuthorizationCode: fetchAuthorizationCode(config),
    refreshAccessToken: refreshAccessToken(config),
    fetchAccessTokenWithAuthCode,
    timeRemainingBeforeAccessTokenExpiresInSeconds,
    fetchAccessibleResources: fetchAccessibleResources(config),
    fetchJiraSprint: fetchJiraSprint(config),
    fetchJiraIssue: fetchJiraIssue(config),
    fetchLatestComment: fetchLatestComment(config),
    fetchRecentComments: fetchRecentComments(config),
    fetchIssuePickerSuggestions: fetchIssuePickerSuggestions(config),
    fetchJqlAutocompleteData: fetchJqlAutocompleteData(config),
    fetchJqlAutocompleteSuggestions: fetchJqlAutocompleteSuggestions(config),
    editJiraIssueWithNamedFields: editJiraIssueWithNamedFields(config),
    fetchJiraIssuesWithJQL: fetchJiraIssuesWithJQL(config),
    fetchJiraIssuesWithJQLWithNamedFields: fetchJiraIssuesWithJQLWithNamedFields(config),
    fetchAllJiraIssuesWithJQL: fetchAllJiraIssuesWithJQL(config),
    fetchAllJiraIssuesWithJQLUsingNamedFields: fetchAllJiraIssuesWithJQLUsingNamedFields(config),
    fetchJiraChangelog: fetchJiraChangelog(config),
    isChangelogComplete,
    fetchRemainingChangelogsForIssues: fetchRemainingChangelogsForIssues(config),
    /** @deprecated Use fetchRemainingChangelogsForIssues (plural) instead - this causes rate limiting */
    fetchRemainingChangelogsForIssue: fetchRemainingChangelogsForIssue(config),
    fetchAllJiraIssuesWithJQLAndFetchAllChangelog: fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config),
    fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields:
      fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(config),
    fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: makeDeep(
      fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config),
    ),
    fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields: makeDeep(fetchAllJiraIssuesWithJQL(config)),
    // The two blocker compositions of spec/036 §2. Blockers-only wraps the FLAT named-fields loader;
    // blockers-and-children wraps the deep-children one, which is what gives the full closure
    // (children of blockers, blockers of children) with no bespoke alternating loop.
    fetchAllJiraIssuesAndDeepBlockersWithJQLAndFetchAllChangelogUsingNamedFields: makeBlockers(
      fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(config),
    ),
    fetchAllJiraIssuesAndDeepChildrenAndBlockersWithJQLAndFetchAllChangelogUsingNamedFields: makeBlockers(
      makeDeep(fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config)),
    ),
    fetchChildrenResponses: fetchChildrenResponses(config),
    fetchDeepChildren: fetchDeepChildren(config),
    fetchJiraFields: fetchJiraFields(config),
    fetchIssueTypes: fetchIssueTypes(config),
    fetchJiraProject: fetchJiraProject(config),
    fetchProjectIssueTypes: fetchProjectIssueTypes(config),
    createJiraIssue: createJiraIssue(config),
    getAccessToken: getAccessToken(config),
    hasAccessToken,
    hasValidAccessToken,
    _cachedServerInfoPromise,
    getServerInfo: getServerInfo(config),
    requester: requestHelper,
    fields: undefined as unknown as FieldsData | undefined, // This will be set later
  };

  makeFieldsRequest(config, setFieldsRequest);

  jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields = makeDeep(
    jiraHelpers.fetchAllJiraIssuesWithJQL.bind(jiraHelpers),
  );

  jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields = makeDeep(
    jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelog.bind(jiraHelpers),
  );

  jiraHelpers.fetchAllJiraIssuesAndDeepBlockersWithJQLAndFetchAllChangelogUsingNamedFields = makeBlockers(
    jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields.bind(jiraHelpers),
  );

  jiraHelpers.fetchAllJiraIssuesAndDeepChildrenAndBlockersWithJQLAndFetchAllChangelogUsingNamedFields = makeBlockers(
    makeDeep(jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelog.bind(jiraHelpers)),
  );

  return jiraHelpers;
}
