/**
 * this module is contains helpers for working with jira.
 */
import chunkArray from '../utils/array/chunk-array';
import mapIdsToNames from '../utils/object/map-ids-to-names';
import { responseToText } from '../utils/fetch/response-to-text';
import { RequestHelperResponse, SearchJiraResponse } from '../shared/types';
import { FetchJiraIssuesParams } from '../jira/shared/types';
import { Config, Issue, ProgressData, OidcJiraIssue, ChangeLog, InterimJiraIssue } from './types';
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
export function isChangelogComplete(changelog: ChangeLog): boolean {
  return changelog.histories.length === changelog.total;
}

export function fetchRemainingChangelogsForIssues(config: Config) {
  return (
    issues: OidcJiraIssue[],
    progress: {
      data?: ProgressData;
      (data: ProgressData): void;
    } = () => {},
  ) => {
    const fetchChangelogs = fetchRemainingChangelogsForIssue(config);

    // check for remainings
    return Promise.all(
      issues.map(({ key, changelog, ...issue }) => {
        if (!changelog || isChangelogComplete(changelog)) {
          return {
            key,
            ...issue,
            changelog: changelog?.histories,
          } as InterimJiraIssue;
        } else {
          return fetchChangelogs(key, changelog).then((histories) => {
            return {
              key,
              ...issue,
              changelog: histories,
            } as InterimJiraIssue;
          });
        }
      }),
    );
  };
}
// weirdly, this starts with the oldest, but we got the most recent
// returns an array of histories objects

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
    const scopeIdForJira = fetchFromLocalStorage('scopeId');
    const accessToken = fetchFromLocalStorage('accessToken');

    const fieldMapping = await config.fieldsRequest();

    const editBody = fieldsToEditBody(fields, fieldMapping);
    //const fieldsWithIds = mapNamesToIds(fields || {}, fieldMapping),
    //	updateWithIds = mapNamesToIds(update || {}, fieldMapping);
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
