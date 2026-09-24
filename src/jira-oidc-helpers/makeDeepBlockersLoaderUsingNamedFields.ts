/**
 * Recursively fetches the work items *upstream* of a JQL result: everything the result "is blocked
 * by", transitively. See `spec/036-load-blockers-recursiveley/plan.md`.
 *
 * Two things make this different from its deep-children counterpart:
 *
 * 1. **There is no discovery query.** `CORE_FIELDS` already requests `'Linked Issues'`, so every
 *    issue we fetch arrives carrying its links. A round is: read blocker keys off the issues we
 *    have → fetch those keys → repeat.
 * 2. **The graph is genuinely cyclic.** A parent tree cannot loop; Jira happily lets you record `A`
 *    is blocked by `B` is blocked by `A`. Termination rests entirely on the seen-set below.
 *
 * This is a decorator of the same shape as `makeDeepChildrenLoaderUsingNamedFields`, which is what
 * makes the "load children AND blockers" case fall out of composition:
 * `makeDeepBlockers(makeDeepChildren(flat))`. Every blocker batch is fetched *through* the children
 * loader (so blockers' children load), and blocker extraction runs over everything that comes back,
 * children included (so children's blockers load). The fixpoint is the nesting.
 *
 * The inner loader is always a `…UsingNamedFields` variant, so issues arrive keyed by display name
 * and this module reads `fields['Linked Issues']` directly — no `fieldsRequest`, no `mapIdsToNames`.
 */
import chunkArray from '../utils/array/chunk-array';
import { uniqueKeys } from '../utils/array/unique';
import { getBlockedByKeys } from '../jira/linked-issue/blocks-links';
import { Config, Issue, Params, Progress, ProgressData } from './types';

type RootMethod = (params: Params, progress: Progress) => Promise<Issue[]>;

/** Jira caps `key in (...)` generously; 40 matches the child loader's batch size. */
const BATCH_SIZE = 40;

/**
 * Keys of the issues this one **is blocked by**. On issue `X`, a `Blocks` link carrying
 * `inwardIssue: Y` reads "X is blocked by Y" — exactly the entries `getBlocksKeys` discards.
 *
 * `issuelinks` is the raw system-field id; `'Linked Issues'` is its display name. Named-fields
 * loaders produce the latter, but read both so this is correct whichever way it is composed.
 */
export function blockerKeysOf(issue: Issue): string[] {
  return getBlockedByKeys(issue.fields?.['Linked Issues'] ?? issue.fields?.issuelinks);
}

function emptyProgressData(): ProgressData {
  return {
    issuesRequested: 0,
    issuesReceived: 0,
    changeLogsRequested: 0,
    changeLogsReceived: 0,
    keysWhoseChildrenWeAreAlreadyLoading: new Set<string>(),
    keysAlreadyRequestedAsBlockers: new Set<string>(),
    phase: 'primary',
    parentsToProcess: 0,
    parentsProcessed: 0,
  };
}

export function makeDeepBlockersLoaderUsingNamedFields(_config: Config) {
  return (rootMethod: RootMethod) => {
    /**
     * One `key in (...)` batch.
     *
     * **No error handling, deliberately** — a rejection propagates, exactly as it does in the
     * deep-children loader, which has no `try`/`catch` either and lets a failing batch reject its
     * `Promise.all`. The load then surfaces through `ReportArea`'s rejected state with Jira's own
     * `errorMessages`, rather than resolving to a quietly incomplete graph.
     *
     * This is a sharp edge worth knowing about: unlike `parent in (...)`, JQL `key in (...)` errors
     * on a key that does not resolve, so one stale link fails the whole load. An earlier draft
     * bisected the batch to isolate such a key, but that `catch` could not tell an unresolved key
     * from a malformed `blockerJQL`, a 429, or an auth failure — it swallowed all of them, and on a
     * rate-limit error it turned one failed batch into ~79 retries. Silent partial data was the
     * worse failure. If stale links prove common in practice, the fix is a predicate narrow enough
     * to name that one Jira error, not a blanket catch.
     */
    function fetchBlockerBatch(keys: string[], params: Params, progress: Progress): Promise<Issue[]> {
      const jql = `key in (${keys.join(', ')}) ${params.blockerJQL || ''}`;

      // Same `skipApproximateCount` rationale as the child batches: the count's only product is a
      // denominator the smoothed projection doesn't read.
      return rootMethod({ ...params, jql, skipApproximateCount: true }, progress);
    }

    return async function fetchAllDeepBlockers(params: Params, progress: Progress = (() => {}) as any) {
      // The flat root method creates `progress.data` with only the counters on it, so seed the full
      // shape here — the seen-set has to exist before the first round reads it.
      progress.data = progress.data || emptyProgressData();
      progress.data.expandsBlockers = true;

      const rootIssues = await rootMethod(params, progress);

      // Blocker discovery is an expansion, and expansion is the `'children'` phase (see
      // LoadProgressPhase). In the composed case the inner children loader already flipped it.
      if (progress.data) {
        progress.data.phase = 'children';
        progress(progress.data);
      }

      // The invariant: "every key we already have, or have already asked for."
      //
      // Rule 1 — seed with the root issues' keys, so a cycle's entry point is never re-fetched. In
      // the composed case the root call returned the whole child cascade too, so those seed as well.
      const seen = progress.data?.keysAlreadyRequestedAsBlockers ?? new Set<string>();
      for (const issue of rootIssues) seen.add(issue.key);

      const all: Issue[] = [...rootIssues];
      let frontier: Issue[] = rootIssues;

      while (frontier.length) {
        const candidates = [...new Set(frontier.flatMap(blockerKeysOf))].filter((key) => !seen.has(key));

        // Rule 2 — record candidates BEFORE the fetch goes out, not after it resolves. A key filtered
        // out by `blockerJQL`, deleted, or invisible to this user comes back as no issue at all. If we
        // only recorded what came back, that key would be re-requested every round, forever. This is
        // the rule that makes the loop terminate in the presence of unresolvable links.
        for (const key of candidates) seen.add(key);

        if (!candidates.length) break;

        if (progress.data) {
          progress.data.parentsToProcess = (progress.data.parentsToProcess || 0) + candidates.length;
          progress(progress.data);
        }

        const batches = chunkArray(candidates, BATCH_SIZE);
        const fetched = (
          await Promise.all(
            batches.map((batch) =>
              fetchBlockerBatch(batch, params, progress).then((issues) => {
                if (progress.data) {
                  progress.data.parentsProcessed = (progress.data.parentsProcessed || 0) + batch.length;
                  progress(progress.data);
                }
                return issues;
              }),
            ),
          )
        ).flat();

        // Rule 3 — record every returned key, not just the ones we asked for. Each round's fetch goes
        // through the inner loader, which also returns each blocker's descendants. Those were never
        // "requested" as blockers, so without this a child that later turns up as somebody's blocker
        // is fetched a second time. Not an infinite loop, but a wasted round-trip.
        for (const issue of fetched) seen.add(issue.key);

        all.push(...fetched);
        frontier = fetched;
      }

      // `seen` grows monotonically over a finite universe of keys and every candidate enters it
      // before any request goes out, so the loop stops the first round `candidates` is empty.
      //
      // `uniqueKeys` keeps the FIRST occurrence, so an issue reachable both as a child and as a
      // blocker keeps whichever copy arrived first. Harmless — both fetches request the same fields.
      return uniqueKeys(all);
    };
  };
}
