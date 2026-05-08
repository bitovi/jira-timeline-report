/**
 * this module is for requesting all jira issues and changelogs.
 */
import { isChangelogComplete, fetchRemainingChangelogsForIssue, searchJiraIssuesWithJQL } from './jira';
import { Config, ProgressData, Issue, OidcJiraIssue, InterimJiraIssue } from './types';
import { SearchJiraResponse } from '../shared/types';
import { uniqueKeys } from '../utils/array/unique';

const CHANGELOG_CONCURRENCY = 20;

// Semaphore that limits concurrent async operations to `limit` at a time.
// Returns a release function; caller must invoke it when the operation finishes.
function makeSemaphore(limit: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return (): Promise<() => void> => {
    const release = () => {
      active--;
      queue.shift()?.();
    };
    if (active < limit) {
      active++;
      return Promise.resolve(release);
    }
    return new Promise((resolve) =>
      queue.push(() => {
        active++;
        resolve(release);
      }),
    );
  };
}

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

    // Get approximate count for progress tracking (if available)
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

    if (progress.data) {
      Object.assign(progress.data, { issuesRequested: estimatedTotal });
      progress(progress.data);
    }

    const acquire = makeSemaphore(CHANGELOG_CONCURRENCY);
    const fetchChangelogs = fetchRemainingChangelogsForIssue(config);

    // Changelog fetches start immediately per page — they run concurrently
    // with subsequent page fetches rather than waiting for all pages to load.
    const changelogPromises: Promise<InterimJiraIssue>[] = [];

    const enqueueIssue = ({ key, changelog, ...issue }: OidcJiraIssue): void => {
      if (!changelog || isChangelogComplete(changelog)) {
        changelogPromises.push(Promise.resolve({ key, ...issue, changelog: changelog?.histories } as InterimJiraIssue));
        return;
      }
      changelogPromises.push(
        acquire().then(async (release) => {
          try {
            const histories = await fetchChangelogs(key, changelog);
            return { key, ...issue, changelog: histories } as InterimJiraIssue;
          } finally {
            release();
          }
        }),
      );
    };

    do {
      const pageSize = Math.min(limit ? limit - allIssues.length : MAX_RESULTS, MAX_RESULTS);

      const response = await searchJiraIssuesWithJQL(config)({
        ...apiParams,
        maxResults: pageSize,
        nextPageToken,
        expand: ['changelog'],
      });

      const searchResponse = response as SearchJiraResponse;
      const pageIssues = searchResponse.issues as OidcJiraIssue[];
      allIssues.push(...pageIssues);
      nextPageToken = searchResponse.nextPageToken;
      isLast = searchResponse.isLast;

      // Start changelog fetches for this page immediately.
      for (const issue of pageIssues) {
        enqueueIssue(issue);
      }

      if (progress.data) {
        Object.assign(progress.data, { issuesReceived: allIssues.length });
        progress(progress.data);
      }

      if (limit && allIssues.length >= limit) break;
    } while (!isLast);

    const issuesWithCompleteChangelogs = await Promise.all(changelogPromises);

    return uniqueKeys(issuesWithCompleteChangelogs);
  };
}
