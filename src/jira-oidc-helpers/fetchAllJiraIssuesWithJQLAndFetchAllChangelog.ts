/**
 * this module is for requesting all jira issues and changelogs.
 */
import { fetchRemainingChangelogsForIssues, searchJiraIssuesWithJQL } from './jira';
import { Config, ProgressData, Issue, OidcJiraIssue } from './types';
import { RequestHelperResponse, SearchJiraResponse } from '../shared/types';
import { uniqueKeys } from '../utils/array/unique';

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

    // Initialize progress tracking
    progress.data =
      progress.data ||
      ({
        issuesRequested: 0,
        issuesReceived: 0,
        changeLogsRequested: 0,
        changeLogsReceived: 0,
      } as ProgressData);

    // Use the new search function with expand support for changelog
    const allIssues: OidcJiraIssue[] = [];
    const MAX_RESULTS = 5000;
    let nextPageToken: string | undefined;
    let isLast = false;

    // Get approximate count for progress tracking (if available)
    const getApproximateCount = async () => {
      if (!params.jql) return { count: 0 };

      try {
        // Use the requestHelper to make the POST request to approximate-count
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

    // Update initial progress
    if (progress.data) {
      Object.assign(progress.data, {
        issuesRequested: estimatedTotal,
      });
      progress(progress.data);
    }

    // Fetch all pages with changelog data
    do {
      const pageSize = Math.min(limit ? limit - allIssues.length : MAX_RESULTS, MAX_RESULTS);

      const response = await searchJiraIssuesWithJQL(config)({
        ...apiParams,
        maxResults: pageSize,
        nextPageToken,
        expand: ['changelog'],
      });

      const searchResponse = response as SearchJiraResponse;
      allIssues.push(...(searchResponse.issues as OidcJiraIssue[]));
      nextPageToken = searchResponse.nextPageToken;
      isLast = searchResponse.isLast;

      // Update progress after each page
      if (progress.data) {
        Object.assign(progress.data, {
          issuesReceived: allIssues.length,
        });
        progress(progress.data);
      }

      // Check if we've reached the limit
      if (limit && allIssues.length >= limit) {
        break;
      }
    } while (!isLast);

    // Fetch remaining changelogs for all issues
    const issuesWithCompleteChangelogs = await fetchRemainingChangelogsForIssues(config)(allIssues, progress);

    return uniqueKeys(issuesWithCompleteChangelogs);
  };
}
