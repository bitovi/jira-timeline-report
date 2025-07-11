/**
 * this module recursively fetches jira issues.
 */
import chunkArray from '../utils/array/chunk-array';
import mapIdsToNames from '../utils/object/map-ids-to-names';
import { uniqueKeys } from '../utils/array/unique';
import { Config, Issue, Params, Progress } from './types';

type RootMethod = (params: Params, progress: Progress) => Promise<Issue[]>;

function getIssuesThatHaventBeenLoaded(parentIssues: Issue[], set: Set<string>) {
  return parentIssues.filter((issue) => {
    if (!set.has(issue.key)) {
      set.add(issue.key);
      return true;
    }
  });
}
export function makeDeepChildrenLoaderUsingNamedFields(config: Config) {
  return (rootMethod: RootMethod) => {
    // Makes child requests in batches of 40
    //
    // params - base params
    // sourceParentIssues - the source of parent issues
    function fetchChildrenResponses(params: Params, parentIssues: Issue[], progress: Progress): Promise<Issue[]>[] {
      const issuesThatNeedToBeLoaded = getIssuesThatHaventBeenLoaded(
        parentIssues,
        progress?.data?.keysWhoseChildrenWeAreAlreadyLoading ?? new Set<string>(),
      );
      const issuesToQuery = chunkArray(issuesThatNeedToBeLoaded, 40);

      const batchedResponses = issuesToQuery.map((issues) => {
        const keys = issues.map((issue) => issue.key);
        const jql = `parent in (${keys.join(', ')}) ${params.childJQL || ''}`;

        return rootMethod(
          {
            ...params,
            jql,
          },
          progress,
        );
      });
      // this needs to be flattened
      return batchedResponses;
    }

    async function fetchDeepChildren(
      params: Params,
      sourceParentIssues: Issue[],
      progress: Progress,
    ): Promise<Issue[]> {
      const batchedFirstResponses = fetchChildrenResponses(params, sourceParentIssues, progress);

      const getChildren = (parentIssues: Issue[]) => {
        if (parentIssues.length) {
          return fetchDeepChildren(params, parentIssues, progress).then((deepChildrenIssues) => {
            return parentIssues.concat(deepChildrenIssues);
          });
        } else {
          return parentIssues;
        }
      };
      const batchedIssueRequests = batchedFirstResponses.map((firstBatchPromise) => {
        return firstBatchPromise.then(getChildren);
      });
      const allChildren = await Promise.all(batchedIssueRequests);
      return allChildren.flat();
    }

    return async function fetchAllDeepChildren(params: Params, progress: Progress = (() => {}) as any) {
      const fields = await config.fieldsRequest();

      const newParams = {
        ...params,
        fields: params.fields?.map((f) => fields.nameMap[f] || f),
      };

      progress.data = progress.data || {
        issuesRequested: 0,
        issuesReceived: 0,
        changeLogsRequested: 0,
        changeLogsReceived: 0,
        keysWhoseChildrenWeAreAlreadyLoading: new Set<string>(),
      };
      const parentIssues = await rootMethod(newParams, progress);

      // go get the children
      const allChildrenIssues = await fetchDeepChildren(newParams, parentIssues, progress);
      const combinedUnique = uniqueKeys(parentIssues.concat(allChildrenIssues));
      const result = combinedUnique.map((issue) => ({
        ...issue,
        fields: mapIdsToNames(issue.fields, fields),
      }));

      return result;
    };
  };
}
