/**
 * this module contains the types needed by the jira oidc helpers.
 */
import { JiraIssue } from '../jira/shared/types';
import { RequestHelperResponse } from '../shared/types';

export type History = {
  id: string;
  created: string | number; // ISO string from individual API, Unix timestamp from bulk API
  author?: any;
  items?: any[];
  [key: string]: any; // Allow other fields
};
export type ChangeLog = {
  histories: History[];
  maxResults: number;
  total: number;
  startAt: number;
};
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
export type FieldsData = {
  list: RequestHelperResponse;
  nameMap: Record<string, any>;
  idMap: Record<string, any>;
  // ids of fields whose display name is shared by more than one field; see spec/015-field-selection.
  ambiguousFieldIds: Set<string>;
};
export type FieldsRequest = Promise<FieldsData>;
export type Issue = {
  key: string;
  fields: Record<string, any>; // Adjust based on the actual structure of fields
};

export type Params = {
  [key: string]: any; // Adjust based on the actual structure of params
  fields?: string[];
  /** Set by the deep-children loader on child batches to skip their opening approximate-count request. */
  skipApproximateCount?: boolean;
};

/**
 * Which part of the load a shared `progress.data` is currently in. `'history'` is intentionally NOT
 * a value — the history/changelog phase is derived from the `changeLogs*` counts, which run
 * concurrently with the others. Stays `undefined` on the no-children path.
 */
export type LoadProgressPhase = 'primary' | 'children';

export type ProgressData = {
  issuesRequested: number;
  issuesReceived: number;
  changeLogsRequested: number;
  changeLogsReceived: number;
  keysWhoseChildrenWeAreAlreadyLoading: Set<string>;
  phase?: LoadProgressPhase;
  /** Top-level parents whose children are being loaded (set when the children phase starts). */
  parentsToProcess?: number;
  /** Top-level parents whose entire subtree has finished loading. Grows as batches complete. */
  parentsProcessed?: number;
};

export type Progress = {
  data?: ProgressData;
  (data: ProgressData): void;
};
export interface ResponseForFieldRequest extends RequestHelperResponse {
  idMap: { [key: string]: string };
  nameMap: { [key: string]: string };
}

export type RequestHelper = <TValues = any[], TIssues = OidcJiraIssue[] | JiraIssue[]>(
  urlFragment: string,
  options?: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  },
) => Promise<RequestHelperResponse<TValues, TIssues>>;

/**
 * Which build the app is running as.
 *
 * - `jira` — the Connect app embedded in Jira, talking to the REST API over the `AP` bridge.
 * - `hosted` — the standalone OAuth website, talking to `api.atlassian.com` with a bearer token.
 * - `forge` — the Forge Custom UI app, talking to Jira through `@forge/bridge`'s `requestJira`.
 *
 * `hosted` is the one that carries a user-held access token; the other two are authenticated by
 * the iframe container. Most host branches in the app are really asking that question, so they
 * read `host !== 'hosted'` rather than enumerating the embedded hosts.
 */
export type Host = 'jira' | 'hosted' | 'forge';

export type Config = {
  env: {
    JIRA_CLIENT_ID: string;
    JIRA_SCOPE: string;
    JIRA_CALLBACK_URL: string;
    JIRA_API_URL: string;
    JIRA_APP_KEY: string;
  };
  requestHelper: RequestHelper;
  fieldsRequest: () => FieldsRequest;
  host: Host;
};

/**
 * Bulk changelog API types
 */
export type BulkChangelogRequest = {
  issueIdsOrKeys: string[];
  fieldIds?: string[];
  maxResults?: number;
  nextPageToken?: string;
};

export type BulkChangelogResponse = {
  issueChangeLogs: {
    issueId: string;
    changeHistories: History[];
  }[];
  nextPageToken?: string;
};

export type IssueChangelogMap = Map<string, History[]>;
