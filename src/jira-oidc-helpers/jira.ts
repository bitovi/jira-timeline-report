/**
 * this module is contains helpers for working with jira.
 */
import chunkArray from '../utils/array/chunk-array';
import mapIdsToNames from '../utils/object/map-ids-to-names';
import { responseToText } from '../utils/fetch/response-to-text';
import { RequestHelperResponse, SearchJiraResponse } from '../shared/types';
import { FetchJiraIssuesParams } from '../jira/shared/types';
import {
  Config,
  Issue,
  ProgressData,
  OidcJiraIssue,
  ChangeLog,
  InterimJiraIssue,
  BulkChangelogRequest,
  BulkChangelogResponse,
  IssueChangelogMap,
  History,
} from './types';
import { fetchFromLocalStorage } from './storage';
import { fetchAllJiraIssuesWithJQLAndFetchAllChangelog } from './fetchAllJiraIssuesWithJQLAndFetchAllChangelog';
import { uniqueKeys } from '../utils/array/unique';

// 🚨 EMERGENCY API MIGRATION FEATURE FLAG
// Set to false for emergency rollback (old API - will fail since API is removed)
// Set to true to use new search API (default - REQUIRED as of [current date])
let USE_ENHANCED_SEARCH = true;

// Emergency function to toggle API version (for debugging/rollback)
export function setUseEnhancedSearch(enabled: boolean) {
  console.warn(`🚨 EMERGENCY: Switching Jira search API to ${enabled ? 'NEW' : 'OLD (DEPRECATED)'} version`);
  USE_ENHANCED_SEARCH = enabled;
}

export function fetchAccessibleResources(config: Config) {
  return () => {
    return config.requestHelper(`https://api.atlassian.com/oauth/token/accessible-resources`);
  };
}
export function fetchJiraSprint(config: Config) {
  return (sprintId: string) => {
    return config.requestHelper(`/agile/1.0/sprint/${sprintId}`);
  };
}
export function fetchJiraIssue(config: Config) {
  return (issueId: string) => {
    return config.requestHelper(`/api/3/issue/${issueId}`);
  };
}
export const fieldsToEditBody = (obj: Record<string, any>, fieldMapping: { nameMap: Record<string, string> }) => {
  const editBody: {
    fields: Record<string, any>;
    update: Record<string, { set: any }[]>;
  } = { fields: {}, update: {} };

  for (let prop in obj) {
    //if(prop === "Story points") {
    // 10016 -> story point estimate
    // 10034 -> story points
    //obj[prop] = ""+obj[prop];
    //mapped["customfield_10016"] = obj[prop];
    //mapped["customfield_10034"] = obj[prop];
    //mapped["Story points"] = obj[prop];
    //mapped["storypoints"] = obj[prop];
    //mapped["Story Points"] = obj[prop];
    // 10016 -> story point estimate
    //} else {
    //mapped[fields.nameMap[prop] || prop] = obj[prop];
    //}
    editBody.update[fieldMapping.nameMap[prop] || prop] = [{ set: obj[prop] }];
  }
  return editBody;
};
export function fetchJiraIssuesWithJQLWithNamedFields(config: Config) {
  return async <TField>(params: FetchJiraIssuesParams) => {
    const fields = await config.fieldsRequest();

    const newParams = {
      ...params,
      fields: params.fields?.map((f: string) => (fields?.nameMap && f in fields.nameMap ? fields.nameMap[f] : f)),
    };
    const response = await fetchJiraIssuesWithJQL(config)(newParams);
    const uniqueIssues = uniqueKeys(response.issues as OidcJiraIssue[]);

    return uniqueIssues.map((issue: OidcJiraIssue) => {
      return {
        ...issue,
        fields: mapIdsToNames(issue.fields, fields) as TField,
      };
    });
  };
}

// 🚀 NEW SEARCH API FUNCTIONS (API v3/search/jql)
export function searchJiraIssuesWithJQL(config: Config) {
  return (
    params: FetchJiraIssuesParams & { nextPageToken?: string; expand?: string[]; fieldsByKeys?: boolean },
  ): Promise<SearchJiraResponse> => {
    const searchParams = new URLSearchParams();
    if (params.jql) searchParams.set('jql', params.jql);
    if (params.maxResults) searchParams.set('maxResults', params.maxResults.toString());
    if (params.nextPageToken) searchParams.set('nextPageToken', params.nextPageToken);
    if (params.fields) searchParams.set('fields', params.fields.join(','));
    if (params.expand) searchParams.set('expand', params.expand.join(','));
    if (params.fieldsByKeys) searchParams.set('fieldsByKeys', params.fieldsByKeys.toString());

    return config.requestHelper(`/api/3/search/jql?${searchParams}`) as unknown as Promise<SearchJiraResponse>;
  };
}

export function searchAllJiraIssuesWithJQL(config: Config) {
  return async (params: FetchJiraIssuesParams, onProgress?: (loaded: number, estimated: number) => void) => {
    const { limit, ...apiParams } = params;

    // Always use maximum page size - API will scale down automatically
    const MAX_RESULTS = 5000;

    // Run count + first page in parallel for better performance
    const countPromise = params.jql
      ? fetch(`${config.env.JIRA_API_URL}/rest/api/3/search/approximate-count`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jql: params.jql }),
        })
          .then((res) => res.json())
          .catch((error) => {
            console.warn('Could not get approximate count:', error);
            return { count: 0 };
          })
      : Promise.resolve({ count: 0 });

    const firstPageSize = Math.min(limit || MAX_RESULTS, MAX_RESULTS);
    const firstPagePromise = searchJiraIssuesWithJQL(config)({
      maxResults: firstPageSize,
      ...apiParams,
    });

    // Wait for count to get estimated total, then start progress tracking
    const countResponse = await countPromise;
    const estimatedTotal = (countResponse as { count: number }).count;

    // Call progress immediately with count estimate
    if (onProgress) {
      onProgress(0, estimatedTotal);
    }

    // Now wait for first page to complete
    const firstPageResponse = await firstPagePromise;
    const allIssues = [...(firstPageResponse as SearchJiraResponse).issues];
    let nextPageToken = (firstPageResponse as SearchJiraResponse).nextPageToken;
    let isLast = (firstPageResponse as SearchJiraResponse).isLast;

    // Update progress after first page
    if (onProgress) {
      onProgress(allIssues.length, estimatedTotal);
    }

    // Continue with sequential pagination (token-based)
    while (!isLast && (limit === undefined || allIssues.length < limit)) {
      const remainingLimit = limit ? limit - allIssues.length : undefined;
      const pageSize = Math.min(remainingLimit || MAX_RESULTS, MAX_RESULTS);

      const response = await searchJiraIssuesWithJQL(config)({
        maxResults: pageSize,
        nextPageToken,
        ...apiParams,
      });

      allIssues.push(...(response as SearchJiraResponse).issues);
      nextPageToken = (response as SearchJiraResponse).nextPageToken;
      isLast = (response as SearchJiraResponse).isLast;

      // Update progress
      if (onProgress) {
        onProgress(allIssues.length, estimatedTotal);
      }

      if (limit && allIssues.length >= limit) {
        break;
      }
    }

    return allIssues;
  };
}

export function fetchJiraIssuesWithJQL(config: Config) {
  return (params: FetchJiraIssuesParams) => {
    if (USE_ENHANCED_SEARCH) {
      return searchJiraIssuesWithJQL(config)(params);
    }

    // Fallback to old API (will fail since API is removed - for emergency rollback only)
    console.warn('Using deprecated Jira search API - this will likely fail');
    return config.requestHelper(`/api/3/search?` + new URLSearchParams(params as Record<string, string>));
  };
}

export function fetchAllJiraIssuesWithJQL(config: Config) {
  return async (params: FetchJiraIssuesParams) => {
    if (USE_ENHANCED_SEARCH) {
      const allIssues = await searchAllJiraIssuesWithJQL(config)(params);
      return allIssues;
    }

    // Old implementation (will fail since API is removed)
    console.warn('Using deprecated Jira pagination API - this will likely fail');
    const { limit, ...apiParams } = params;
    const firstRequest = fetchJiraIssuesWithJQL(config)({
      maxResults: 100,
      ...apiParams,
    });
    const { maxResults, total, startAt } = await firstRequest;
    const requests = [firstRequest];

    const limitOrTotal = Math.min(total, limit ?? Infinity);
    for (let i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
      requests.push(
        fetchJiraIssuesWithJQL(config)({
          maxResults: maxResults,
          startAt: i,
          ...apiParams,
        }),
      );
    }
    return Promise.all(requests).then((responses) => {
      return responses.map((response: any) => response.issues).flat();
    });
  };
}
// TODO ... we probably can remove this.  It's also not working right.
export function JiraIssueParamsToParams(params: FetchJiraIssuesParams): Record<string, string> {
  const formattedParams: Record<string, string> = {};
  if (params.jql) formattedParams.jql = params.jql;
  if (params.startAt) formattedParams.startAt = params.startAt.toString();
  if (params.maxResults) formattedParams.maxResults = params.maxResults.toString();
  if (params.fields) formattedParams.fields = params.fields.join(',');
  return formattedParams;
}
export function fetchIssueTypes(config: Config) {
  return () => {
    // TODO this needs fixed, the type expectations here are all wrong
    const response = config.requestHelper(`/api/3/issuetype`) as unknown;
    return response as Promise<
      Array<{
        avatarId: number;
        description: string;
        hierarchyLevel: number;
        iconUrl: string;
        id: number;
        name: string;
        subtask: boolean;
      }>
    >;
  };
}
export function fetchAllJiraIssuesWithJQLUsingNamedFields(config: Config) {
  return async (params: FetchJiraIssuesParams) => {
    const fields = await config.fieldsRequest();

    const newParams = {
      ...params,
      fields: params.fields?.map((f: string) => fields.nameMap[f] || f),
    };
    const response = await fetchAllJiraIssuesWithJQL(config)(newParams);

    return response.map((issue: any) => {
      return {
        ...issue,
        fields: mapIdsToNames(issue.fields, fields),
      };
    });
  };
}
export function fetchJiraChangelog(config: Config) {
  return (issueIdOrKey: string, params: FetchJiraIssuesParams) => {
    // TODO investigate this - convert params to proper type
    return config.requestHelper(
      `/api/3/issue/${issueIdOrKey}/changelog?` + new URLSearchParams(JiraIssueParamsToParams(params)),
    );
  };
}

/**
 * Fetches changelogs for multiple issues using the bulk changelog endpoint.
 * Reduces API calls by fetching up to 1000 issues per request.
 *
 * ✅ DEFAULT IMPLEMENTATION - This is the standard way to fetch changelogs.
 * Replaces individual per-issue API calls to prevent rate limiting.
 *
 * @param config - Jira configuration
 * @param request - Bulk changelog request parameters
 * @returns Map of issue IDs to changelog histories
 *
 * @example
 * const changelogMap = await fetchBulkChangelogs(config, {
 *   issueIdsOrKeys: ['PROJ-123', 'PROJ-124'],
 *   fieldIds: ['status', 'assignee'], // Optional: max 10 fields
 * });
 */
export async function fetchBulkChangelogs(config: Config, request: BulkChangelogRequest): Promise<IssueChangelogMap> {
  const { issueIdsOrKeys, fieldIds, maxResults = 10000, nextPageToken } = request;

  console.log(
    `[BULK] fetchBulkChangelogs: ${issueIdsOrKeys.length} issues, ${fieldIds?.length || 0} fields, maxResults=${maxResults}`,
  );

  // Validate batch size
  if (issueIdsOrKeys.length > 1000) {
    throw new Error(`Bulk changelog API supports max 1000 issues per request. Received ${issueIdsOrKeys.length}`);
  }

  // Validate field filter count
  if (fieldIds && fieldIds.length > 10) {
    throw new Error(`Bulk changelog API supports max 10 field IDs. Received ${fieldIds.length}`);
  }

  const changelogMap: IssueChangelogMap = new Map();
  let currentPageToken: string | undefined = nextPageToken;
  let pageCount = 0;

  do {
    pageCount++;
    console.log(`[BULK] Page ${pageCount}: Fetching changelogs${currentPageToken ? ' (continuation)' : ''}`);

    // Build request body
    const requestBody: BulkChangelogRequest = {
      issueIdsOrKeys,
      maxResults,
    };

    if (fieldIds && fieldIds.length > 0) {
      requestBody.fieldIds = fieldIds;
    }

    if (currentPageToken) {
      requestBody.nextPageToken = currentPageToken;
    }

    // Make API request
    const response = await config.requestHelper<any, BulkChangelogResponse>(`/api/3/changelog/bulkfetch`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Process response - cast to get proper typing
    const bulkResponse = response as unknown as BulkChangelogResponse;

    // Map issue IDs to changelog histories
    for (const issueChangelog of bulkResponse.issueChangeLogs) {
      const { issueId, changeHistories } = issueChangelog;

      // Normalize the date format - bulk API returns Unix timestamps (numbers)
      // but code expects ISO date strings
      const normalizedHistories = changeHistories.map((history) => {
        // If created is a number (Unix timestamp), convert to ISO string
        if (typeof history.created === 'number') {
          // Jira API returns timestamps in milliseconds
          // If the number is less than a reasonable year 2000 timestamp in milliseconds,
          // it's probably in seconds, so multiply by 1000
          const timestamp = history.created < 10000000000 ? history.created * 1000 : history.created;
          return {
            ...history,
            created: new Date(timestamp).toISOString(),
          };
        }
        return history;
      });

      // Append to existing histories or create new entry
      const existingHistories = changelogMap.get(issueId) || [];
      changelogMap.set(issueId, [...existingHistories, ...normalizedHistories]);
    }

    // Check for next page
    currentPageToken = bulkResponse.nextPageToken;
  } while (currentPageToken);

  console.log(`[BULK] Complete: ${pageCount} page(s), ${changelogMap.size} issue(s) with changelogs`);
  return changelogMap;
}

export function isChangelogComplete(changelog: ChangeLog): boolean {
  return changelog.histories.length === changelog.total;
}

/**
 * Fetches remaining changelog entries for issues that have incomplete changelogs.
 *
 * ✅ DEFAULT IMPLEMENTATION - Uses bulk changelog API (POST /api/3/changelog/bulkfetch)
 * to batch up to 1000 issues per request, dramatically reducing API calls and preventing
 * rate limiting (429 errors).
 *
 * Migration note: Previously made individual GET calls per issue, which caused rate limiting.
 * This has been replaced with bulk fetching as the permanent default.
 *
 * @param config - Jira configuration
 * @returns Function that processes issues and fetches missing changelogs in bulk
 */
export function fetchRemainingChangelogsForIssues(config: Config) {
  return async (
    issues: OidcJiraIssue[],
    progress: {
      data?: ProgressData;
      (data: ProgressData): void;
    } = () => {},
  ) => {
    // Separate issues into complete and incomplete changelogs
    const completeIssues: InterimJiraIssue[] = [];
    const incompleteIssues: OidcJiraIssue[] = [];

    for (const issue of issues) {
      const { key, changelog, ...rest } = issue;
      if (!changelog || isChangelogComplete(changelog)) {
        // Issue has complete changelog, no additional fetch needed
        completeIssues.push({
          key,
          ...rest,
          changelog: changelog?.histories,
        } as InterimJiraIssue);
      } else {
        // Issue needs additional changelog data
        incompleteIssues.push(issue);
      }
    }

    // If no incomplete issues, return early
    if (incompleteIssues.length === 0) {
      console.log(`[BULK] No incomplete changelogs to fetch`);
      return completeIssues;
    }

    console.log(
      `[BULK] fetchRemainingChangelogsForIssues: ${completeIssues.length} complete, ${incompleteIssues.length} incomplete`,
    );

    // Batch incomplete issues into groups of 1000 for bulk fetching
    const batches = chunkArray(incompleteIssues, 1000);
    console.log(`[BULK] Creating ${batches.length} batch(es) for ${incompleteIssues.length} issue(s)`);
    const fetchedChangelogsPromises = batches.map(async (batch) => {
      // Extract issue IDs for the bulk request
      const issueIdsOrKeys = batch.map((issue) => issue.id);

      // Fetch changelogs in bulk for this batch
      const changelogMap = await fetchBulkChangelogs(config, {
        issueIdsOrKeys,
      });

      return changelogMap;
    });

    // Wait for all batches to complete
    const changelogMaps = await Promise.all(fetchedChangelogsPromises);

    // Merge all changelog maps into one
    const mergedChangelogMap: IssueChangelogMap = new Map();
    for (const map of changelogMaps) {
      for (const [issueId, histories] of map) {
        mergedChangelogMap.set(issueId, histories);
      }
    }

    // Map the fetched changelogs back to issues
    const processedIncompleteIssues: InterimJiraIssue[] = incompleteIssues.map((issue) => {
      const { key, changelog, id, ...rest } = issue;

      // Get the fetched changelog histories from the map
      const fetchedHistories = mergedChangelogMap.get(id) || [];

      // The bulk API returns ALL changelog entries, not just the remaining ones
      // So we use the fetched histories directly
      return {
        key,
        ...rest,
        changelog: fetchedHistories,
      } as InterimJiraIssue;
    });

    // Combine complete and processed incomplete issues
    return [...completeIssues, ...processedIncompleteIssues];
  };
}

/**
 * @deprecated LEGACY FUNCTION - Do not use. This function is kept for backward compatibility only.
 *
 * Use `fetchRemainingChangelogsForIssues` (plural) instead, which uses the bulk changelog API.
 * This function makes individual API calls per issue and will cause rate limiting (429 errors)
 * on large datasets.
 *
 * This function makes one API call per issue, which causes rate limiting.
 * The bulk API (`fetchRemainingChangelogsForIssues`) batches up to 1000 issues per call.
 */
export function fetchRemainingChangelogsForIssue(config: Config) {
  return async (issueIdOrKey: string, mostRecentChangeLog: ChangeLog) => {
    const { maxResults, total } = mostRecentChangeLog;

    const requests = [];
    requests.push({ values: mostRecentChangeLog.histories });
    for (let i = 0; i < total - maxResults; i += maxResults) {
      requests.push(
        fetchJiraChangelog(config)(issueIdOrKey, {
          maxResults: Math.min(maxResults, total - maxResults - i),
          startAt: i,
        }).then((response) => {
          // the query above reverses the sort order, we fix that here
          return { ...response, values: response.values.reverse() };
        }),
      );
    }
    // server sends back as "values", we match that
    const responses = await Promise.all(requests);
    const response_2 = responses.map((response_1) => response_1.values).flat();
    return response_2;
  };
}
// this could do each response incrementally, but I'm being lazy
export const fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields =
  (config: Config) =>
  async (params: { fields: string[]; [key: string]: any }, progress: (data: ProgressData) => void = () => {}) => {
    const fields = await config.fieldsRequest();

    const newParams = {
      ...params,
      fields: params.fields.map((f) => fields?.nameMap[f] || f),
    };
    const response = await fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config)(newParams, progress);

    return response.map((issue) => {
      return {
        ...issue,
        fields: mapIdsToNames(issue.fields, fields),
      };
    });
    // change the parms
  };

export function fetchChildrenResponses(config: Config) {
  return (
    params: { fields: string[]; [key: string]: any },
    parentIssues: Issue[],
    progress: (data: ProgressData) => void = () => {},
  ) => {
    const issuesToQuery = chunkArray(parentIssues, 40);
    const batchedResponses = issuesToQuery.map((issues) => {
      const keys = issues.map((issue) => issue.key);
      const jql = `parent in (${keys.join(', ')})`;
      return fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config)(
        {
          ...params,
          jql,
        },
        progress,
      );
    });
    // this needs to be flattened
    return batchedResponses;
  };
}
// Makes child requests in batches of 40
//
// params - base params
// sourceParentIssues - the source of parent issues
export function fetchDeepChildren(config: Config) {
  return (
    params: { fields: string[]; [key: string]: any },
    sourceParentIssues: Issue[],
    progress: (data: ProgressData) => void = () => {},
  ): Promise<Issue[]> => {
    const batchedFirstResponses = fetchChildrenResponses(config)(params, sourceParentIssues, progress);

    const getChildren = (parentIssues: Issue[]) => {
      if (parentIssues.length) {
        return fetchDeepChildren(config)(params, parentIssues, progress).then((deepChildrenIssues) => {
          return parentIssues.concat(deepChildrenIssues);
        });
      } else {
        return parentIssues;
      }
    };

    const batchedIssueRequests = batchedFirstResponses.map((firstBatchPromise) => {
      return firstBatchPromise.then(getChildren);
    });

    return Promise.all(batchedIssueRequests).then((allChildren) => {
      return allChildren.flat();
    });
  };
}

export function editJiraIssueWithNamedFields(config: Config) {
  return async (issueId: string, fields: Record<string, any>) => {
    const fieldMapping = await config.fieldsRequest();

    const editBody = fieldsToEditBody(fields, fieldMapping);

    /**
     * Quick and dirty fix while gwe work on getting a more robust
     * request helper / jira client
     */

    const isPlugin = !!(AP?.history?.getState ?? false);

    interface APResponse {
      body: string;
      xhr: { status: number; statusText: string };
    }

    if (isPlugin) {
      return AP?.request(`/rest/api/3/issue/${issueId}?returnIssue=true` + '' /*new URLSearchParams(params)*/, {
        type: 'PUT',
        contentType: 'application/json',
        data: JSON.stringify(editBody),
      }).then((response) => {
        const casted = response as APResponse;

        return JSON.parse(casted.body) as unknown;
      });
    }

    /**
     * End quick and dirty fix below is the original logic
     */

    const scopeIdForJira = fetchFromLocalStorage('scopeId');
    const accessToken = fetchFromLocalStorage('accessToken');

    return fetch(
      `${config.env.JIRA_API_URL}/${scopeIdForJira}/rest/api/3/issue/${issueId}?returnIssue=true` +
        '' /*new URLSearchParams(params)*/,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editBody),
      },
    ).then(responseToText);
  };
}
