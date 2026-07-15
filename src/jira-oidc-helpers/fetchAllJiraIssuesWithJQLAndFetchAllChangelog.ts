/**
 * this module is for requesting all jira issues and changelogs.
 */
import { fetchBulkChangelogs, fetchRemainingChangelogsForIssues, searchJiraIssuesWithJQL } from './jira';
import { Config, ProgressData, Issue, OidcJiraIssue, InterimJiraIssue } from './types';
import { SearchJiraResponse } from '../shared/types';
import { uniqueKeys } from '../utils/array/unique';
import chunkArray from '../utils/array/chunk-array';

// When true: search omits expand:['changelog'], then fetches all changelogs via a
// single bulk call. Allows up to 5000 issues per search page instead of ~100.
// When false: search uses expand:['changelog'] inline, then bulk-fetches only
// issues whose inline changelog was incomplete (original behaviour).
const USE_DIRECT_BULK_CHANGELOG = true;

export function fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config: Config) {
  return async (
    params: {
      limit?: number;
      maxResults?: number;
      startAt?: number;
      expand?: string[];
      [key: string]: any;
    },
    progress: {
      data?: ProgressData;
      (data: ProgressData): void;
    } = () => {},
  ): Promise<Issue[]> => {
    const { limit, ...apiParams } = params;

    progress.data =
      progress.data ||
      ({
        issuesRequested: 0,
        issuesReceived: 0,
        changeLogsRequested: 0,
        changeLogsReceived: 0,
      } as ProgressData);

    const allIssues: OidcJiraIssue[] = [];
    const MAX_RESULTS = 5000;
    let nextPageToken: string | undefined;
    let isLast = false;

    const getApproximateCount = async () => {
      if (!params.jql) return { count: 0 };
      try {
        const response = await config.requestHelper('api/3/search/approximate-count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jql: params.jql }),
        });
        return response as unknown as { count: number };
      } catch (error) {
        console.warn('Could not get approximate count:', error);
        return { count: 0 };
      }
    };

    const countResponse = await getApproximateCount();
    const estimatedTotal = (countResponse as { count: number }).count;

    // `progress.data` is a single object shared across every concurrent/recursive call to
    // this function (one call per batch of parent issues, at every child-loading depth).
    // Accumulate into the running totals here rather than overwriting them with this
    // batch's own numbers, otherwise later batches reset the totals reported by earlier ones.
    if (progress.data) {
      progress.data.issuesRequested = (progress.data.issuesRequested || 0) + estimatedTotal;
      progress(progress.data);
    }

    const searchExpand = USE_DIRECT_BULK_CHANGELOG ? [] : ['changelog'];

    let previouslyReportedReceived = 0;

    do {
      const pageSize = Math.min(limit ? limit - allIssues.length : MAX_RESULTS, MAX_RESULTS);

      const response = await searchJiraIssuesWithJQL(config)({
        ...apiParams,
        maxResults: pageSize,
        nextPageToken,
        ...(searchExpand.length > 0 && { expand: searchExpand }),
      });

      const searchResponse = response as SearchJiraResponse;
      const pageIssues = searchResponse.issues as OidcJiraIssue[];
      allIssues.push(...pageIssues);
      nextPageToken = searchResponse.nextPageToken;
      isLast = searchResponse.isLast;

      if (progress.data) {
        const receivedDelta = allIssues.length - previouslyReportedReceived;
        previouslyReportedReceived = allIssues.length;
        progress.data.issuesReceived = (progress.data.issuesReceived || 0) + receivedDelta;
        progress(progress.data);
      }

      if (limit && allIssues.length >= limit) break;
    } while (!isLast);

    let issuesWithCompleteChangelogs: InterimJiraIssue[];

    if (USE_DIRECT_BULK_CHANGELOG) {
      // No inline changelog data from search — fetch everything via bulk in batches of 1000.
      const batches = chunkArray(allIssues, 1000);
      const changelogMaps = await Promise.all(
        batches.map((batch) => fetchBulkChangelogs(config, { issueIdsOrKeys: batch.map((i) => i.id) })),
      );
      const changelogMap = new Map(changelogMaps.flatMap((m) => [...m]));
      issuesWithCompleteChangelogs = allIssues.map(({ id, key, fields }) => ({
        id,
        key,
        fields,
        changelog: changelogMap.get(id) ?? [],
      }));
    } else {
      // Inline changelog came back with the search; bulk-fetch only incomplete ones.
      issuesWithCompleteChangelogs = await fetchRemainingChangelogsForIssues(config)(allIssues, progress);
    }

    return uniqueKeys(issuesWithCompleteChangelogs);
  };
}
