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
  /** Optional JQL appended to each `key in (...)` blocker batch, mirroring `childJQL`. */
  blockerJQL?: string;
};

/**
 * Which part of the load a shared `progress.data` is currently in. `'history'` is intentionally NOT
 * a value — the history/changelog phase is derived from the `changeLogs*` counts, which run
 * concurrently with the others. Stays `undefined` when nothing expands the root result set.
 *
 * `'children'` is the generic **expansion** phase: blocker loading reuses it rather than adding a
 * third value. A sequential third phase would make the primary step un-complete mid-load, and the
 * union is hardcoded in three files rather than imported. Which expansions are running is reported
 * by the `expandsChildren` / `expandsBlockers` booleans instead — they only pick the step's label.
 */
export type LoadProgressPhase = 'primary' | 'children';

export type ProgressData = {
  issuesRequested: number;
  issuesReceived: number;
  changeLogsRequested: number;
  changeLogsReceived: number;
  keysWhoseChildrenWeAreAlreadyLoading: Set<string>;
  /**
   * Every key the blocker loader already has or has already asked for. Deliberately separate from
   * `keysWhoseChildrenWeAreAlreadyLoading`: "already expanded for children" and "already requested as
   * a blocker" are different questions, and conflating them would suppress legitimate fetches.
   * See spec/036-load-blockers-recursiveley §3.
   */
  keysAlreadyRequestedAsBlockers: Set<string>;
  phase?: LoadProgressPhase;
  /** Top-level parents whose children are being loaded (set when the children phase starts). */
  parentsToProcess?: number;
  /** Top-level parents whose entire subtree has finished loading. Grows as batches complete. */
  parentsProcessed?: number;
  /** The deep-children loader is in the composition. Labels the expansion step. */
  expandsChildren?: boolean;
  /** The deep-blockers loader is in the composition. Labels the expansion step. */
  expandsBlockers?: boolean;
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
  host: 'jira' | 'hosted';
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
