/**
 * this module is for requesting all jira issues and changelogs.
 */
import { fetchRemainingChangelogsForIssues, fetchJiraIssuesWithJQL } from "./jira";
import { Config, ProgressData, Issue, OidcJiraIssue } from "./types";
import { RequestHelperResponse } from "../shared/types";
import { uniqueKeys } from "../shared/unique";

export function fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config: Config) {
  return (
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
    } = () => {}
  ): Promise<Issue[]> => {
    const { limit, ...apiParams } = params;

    // a weak map would be better
    progress.data =
      progress.data ||
      ({
        issuesRequested: 0,
        issuesReceived: 0,
        changeLogsRequested: 0,
        changeLogsReceived: 0,
      } as ProgressData);
    function getRemainingChangeLogsForIssues({ issues }: RequestHelperResponse) {
      if (progress.data) {
        Object.assign(progress.data, {
          issuesReceived: progress.data.issuesReceived + issues.length,
        });
        progress(progress.data);
      }
      return fetchRemainingChangelogsForIssues(config)(issues as OidcJiraIssue[], progress);
    }

    const firstRequest = fetchJiraIssuesWithJQL(config)({
      maxResults: 100,
      expand: ["changelog"],
      ...apiParams,
    });

    return firstRequest.then(({ maxResults, total, startAt }) => {
      if (progress.data) {
        Object.assign(progress.data, {
          issuesRequested: progress.data.issuesRequested + total,
          changeLogsRequested: 0,
          changeLogsReceived: 0,
        });
        progress(progress.data);
      }

      const requests = [firstRequest.then(getRemainingChangeLogsForIssues)];
      const limitOrTotal = Math.min(total, limit ?? Infinity);

      for (let i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
        requests.push(
          fetchJiraIssuesWithJQL(config)({
            maxResults: maxResults,
            startAt: i,
            ...apiParams,
          }).then(getRemainingChangeLogsForIssues)
        );
      }
      return Promise.all(requests).then((responses) => {
        return uniqueKeys(responses.flat());
      });
    });
  };
}
