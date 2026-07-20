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
    function fetchChildrenResponses(
      params: Params,
      parentIssues: Issue[],
      progress: Progress,
    ): { promise: Promise<Issue[]>; count: number }[] {
      const issuesThatNeedToBeLoaded = getIssuesThatHaventBeenLoaded(
        parentIssues,
        progress?.data?.keysWhoseChildrenWeAreAlreadyLoading ?? new Set<string>(),
      );
      const issuesToQuery = chunkArray(issuesThatNeedToBeLoaded, 40);

      // `count` is the batch's parent count, so the top-level caller can report per-batch completion.
      return issuesToQuery.map((issues) => {
        const keys = issues.map((issue) => issue.key);
        const jql = `parent in (${keys.join(', ')}) ${params.childJQL || ''}`;

        return { promise: rootMethod({ ...params, jql }, progress), count: issues.length };
      });
    }

    async function fetchDeepChildren(
      params: Params,
      sourceParentIssues: Issue[],
      progress: Progress,
      isTopLevel = false,
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
      const batchedIssueRequests = batchedFirstResponses.map(({ promise, count }) => {
        const loaded = promise.then(getChildren);
        // Only the top-level call reports completion: one increment per top-level parent whose ENTIRE
        // subtree (all descendants) has finished. This spreads across the load (unlike the bursty
        // approximate-count totals) and drives the smoothed "Loading children" projection in React.
        if (isTopLevel) {
          loaded.then(
            () => {
              if (progress.data) {
                progress.data.parentsProcessed = (progress.data.parentsProcessed || 0) + count;
                progress(progress.data);
              }
            },
            () => {}, // the error still propagates through the returned `loaded` below
          );
        }
        return loaded;
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
        phase: 'primary',
        parentsToProcess: 0,
        parentsProcessed: 0,
      };

      // The root-JQL fetch is the "primary work items" phase.
      if (progress.data) progress.data.phase = 'primary';
      const parentIssues = await rootMethod(newParams, progress);

      // Deep-children discovery is where the total grows. Flip to the "children" phase and emit so the
      // React stepper can snapshot the primary totals at this transition (parents are fully loaded now,
      // and no child counts have been added yet). The shared `progress.data` keeps `phase === 'children'`
      // for all the concurrent/recursive child `rootMethod` calls that follow.
      if (progress.data) {
        progress.data.phase = 'children';
        progress.data.parentsToProcess = parentIssues.length;
        progress.data.parentsProcessed = 0;
        progress(progress.data);
      }
      const allChildrenIssues = await fetchDeepChildren(newParams, parentIssues, progress, true);
      const combinedUnique = uniqueKeys(parentIssues.concat(allChildrenIssues));
      const result = combinedUnique.map((issue) => ({
        ...issue,
        fields: mapIdsToNames(issue.fields, fields),
      }));

      return result;
    };
  };
}
