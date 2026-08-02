# Option C — No reactive library at all

**Shape:** delete the observable concept rather than reimplement it. URL state becomes
`useSyncExternalStore` over the [`urlStore`](./routing.md); async state becomes React Query (already
a dependency, already used); derived state becomes pure functions called from `useMemo`. Reports take
plain props instead of a bag of `*Obs` observables.

**This is the best end state and the largest diff.** It touches ~100 files and changes every report's
signature. It is also where Options A and B eventually lead — see §7.

## 1. Where each of `routeData`'s 88 properties goes

| Bucket                                                                                                                                                                   | Count | Destination                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | --------------------------------------------------------------------------- |
| URL-backed params (`jql`, `roundTo`, `tableColumns`, …)                                                                                                                  | ~60   | `useUrlParam(key)` over `urlStore` + the param registry                     |
| Async fetches (`jiraFieldsPromise`, `allTeamDataPromise`, `simplifiedIssueHierarchy`, `serverInfoPromise`, `fullyInheritedTeamConfigPromise`, `normalizeOptionsPromise`) | ~8    | React Query — these are _queries_ that have been hand-rolled as observables |
| Pure derivations (`primaryIssueType`, `issueHierarchy`, `allStatusesSorted`, `effectiveFilterRows`, `tableColumnFields`, `issueTimingCalculations`)                      | ~10   | plain exported functions + `useMemo`                                        |
| The issue pipeline (`rawIssuesRequestData` → `derivedIssuesRequestData` → `derivedIssues`)                                                                               | 3     | React Query, with a progress side-channel (§4)                              |
| Self-healing (`selectedIssueType`, `toIssueType`)                                                                                                                        | 2     | a hook that validates and writes back (§5)                                  |
| Injected singletons (`jiraHelpers`, `storage`, `licensingPromise`, `isLoggedInObservable`)                                                                               | 4     | React context, set once at mount                                            |

Note the second row: **eight of these are already promises being wrapped in observables so a
non-React framework could consume them.** React Query does that job better and is already in the
tree (`src/react/services/query/queryClient.ts`, and `useJiraIssueFields` already uses
`useSuspenseQuery`). This bucket is a straight simplification with no reactive semantics lost.

## 2. URL params — and the `useSyncExternalStore` trap

```ts
// src/routing/useUrlParam.ts
import { useSyncExternalStore, useCallback } from 'react';
import { urlStore } from './url-store';
import { PARAMS, type ParamKey } from './params';
import { useSavedReport } from '../react/services/reports/SavedReportContext';

const subscribe = (cb: () => void) => {
  urlStore.on(cb);
  return () => urlStore.off(cb);
};

/**
 * `getSnapshot` MUST return a referentially stable value for an unchanged URL — React
 * calls it on every render and loops forever if it returns a new array/object each time.
 * So parsed values are memoized per (key, raw); `parse` runs only when the raw string
 * actually changed.
 */
const cache = new Map<string, { raw: string | null; parsed: unknown }>();

function snapshot<K extends ParamKey>(key: K, reportParams?: string) {
  const spec = PARAMS[key];
  const raw =
    new URLSearchParams(urlStore.value).get(key) ??
    (reportParams ? new URLSearchParams(reportParams).get(key) : null) ??
    spec.defaultRaw;

  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.parsed;
  const parsed = spec.parse(raw);
  cache.set(key, { raw, parsed });
  return parsed;
}

export function useUrlParam<K extends ParamKey>(key: K) {
  const { queryParams } = useSavedReport(); // the URL → saved-report → default precedence
  const value = useSyncExternalStore(
    subscribe,
    useCallback(() => snapshot(key, queryParams), [key, queryParams]),
    () => PARAMS[key].parse(PARAMS[key].defaultRaw),
  );
  const set = useCallback(
    (next: ParamValue<K>) => urlStore.setParam(key, PARAMS[key].stringify(next), PARAMS[key].defaultRaw),
    [key],
  );
  return [value, set] as const;
}
```

Two things this fixes that are worked around today:

- **Fine-grained re-renders.** `TimelineReport.tsx:139-152` explains that it uses a CanJS observation
  rather than `useQueryParams` because "subscribing the root to every URL change would re-render the
  whole tree on things like a compare-slider drag". With a cached per-param snapshot, a `compareTo`
  drag re-renders only `compareTo`'s readers. The workaround comment goes away.
- **The subscribe/read race.** `useCanObservable.ts:26-40` documents a real bug — a suspended report
  misses the value that lands while it is unsubscribed, rendering headers over an empty body.
  `useSyncExternalStore` exists specifically to make that unrepresentable.

## 3. Async state — React Query

```ts
// src/react/services/jira/useSimplifiedIssueHierarchy.ts
export const useSimplifiedIssueHierarchy = () => {
  const { jiraHelpers, isLoggedIn } = useJira();
  return useSuspenseQuery({
    queryKey: jiraKeys.hierarchy(isLoggedIn),
    queryFn: () => getSimplifiedIssueHierarchy({ jiraHelpers, isLoggedIn }),
    staleTime: Infinity,
  });
};
```

`route-data.js:307-365`'s four-promise chain
(`fullyInheritedTeamConfigPromise` → `baseNormalizeOptionsAndFieldsToRequestPromise` →
`baseNormalizeOptions` → `normalizeOptionsPromise`) becomes three `useQuery` calls with dependent
`enabled` flags, and React Query supplies the caching, deduplication and error states that chain
hand-rolls.

## 4. The issue pipeline — the one genuinely awkward part

`rawIssuesRequestData` (`state-helpers.js:29-70`) is not a plain fetch. It:

- rebuilds a promise whenever any of six inputs change,
- streams `{issuesRequested, issuesReceived, phase, changeLogs*, parents*}` progress into a
  `value.with` observable that `useReportLoadingState` reads through a four-segment key path,
- and relies on `getRawIssues` collapsing identical concurrent requests, keyed by an `owner` that is
  _the progress observable itself_ (see the comment at `state-helpers.js:44-52`) — which is what
  makes report-of-reports' request dedupe work.

React Query handles the fetch and the dedupe natively (the query key replaces the `owner` trick), but
it has no first-class channel for **progress within a single in-flight query**. The workable shape:

```ts
// Progress stays an external store — it is high-frequency, non-cacheable, and nobody
// needs it to survive a remount. React Query owns the RESULT; this owns the TICKS.
const progressStore = createExternalStore<Progress>({});

export const useDerivedIssues = () => {
  const params = useIssueRequestParams();
  return useQuery({
    queryKey: issueKeys.derived(params),
    queryFn: ({ queryKey }) => getRawIssues(params, { progressUpdate: (p) => progressStore.set(queryKey, p) }),
  });
};

export const useReportLoadingState = () => {
  const params = useIssueRequestParams();
  const { status, error } = useDerivedIssues();
  const progress = useSyncExternalStore(progressStore.subscribe, () => progressStore.get(issueKeys.derived(params)));
  return { status, ...progress, rejectReason: error };
};
```

That is a genuine redesign of the loading-progress path, not a port. `LoadingProgress.tsx`,
`useReportLoadingState.ts` and their tests all change. **Scope this piece separately** — it is the
highest-risk part of Option C and the least related to "remove CanJS".

## 5. Self-healing params

`selectedIssueType` (`route-data.js:612-786`) waits for `derivedIssues`, validates the stored value
against the _returned_ hierarchy, defaults to the top level and writes itself back to the URL.
As a hook:

```ts
export function useSelectedIssueType() {
  const [stored, setStored] = useUrlParam('selectedIssueType');
  const { data: issues } = useDerivedIssues();
  const hierarchy = useMemo(() => issueHierarchyFromNormalizedIssues(issues ?? []), [issues]);

  // Pure: what the value SHOULD be, and whether that needs persisting.
  const { value, shouldPersist } = useMemo(
    () => resolveSelectedIssueType(stored, hierarchy), // extracted, unit-testable
    [stored, hierarchy],
  );

  // The write-back. An effect that sets URL state is exactly the pattern React docs warn
  // about — but it IS the behaviour: the selection has to survive reload and sharing.
  // Keep it one line, keep the decision in the pure function above.
  useEffect(() => {
    if (shouldPersist) setStored(value);
  }, [shouldPersist, value]);

  return [value, setStored] as const;
}
```

The win is that `resolveSelectedIssueType` becomes a pure function with a table-driven test, instead
of 90 lines of imperative resolver whose behaviour is only observable through the URL.

## 6. Reports lose the `*Obs` bag

```diff
-export function GanttReport({
-  primaryIssuesOrReleasesObs, allIssuesOrReleasesObs, roundToObs, groupByObs, breakdownObs,
-}: Props) {
-  const issues = useCanObservable(primaryIssuesOrReleasesObs);
-  const roundTo = useCanObservable(roundToObs);
-  const groupBy = useCanObservable(groupByObs);
-  const breakdown = useCanObservable(breakdownObs);
+export function GanttReport({ issues, allIssues, roundTo, groupBy, breakdown }: GanttProps) {
```

`src/react/reports/reportProps.ts` (both bags) is deleted; `propsFor`/`secondaryPropsFor` become
`useReportProps()`, reading from `ReportConfigContext`. That context is what finally makes the
shell/child split honest: the shell provides a URL-backed implementation, `ChildReport` provides a
`queryParams`-backed one, and **`ChildReportConfig.js` disappears entirely** rather than being ported.

```tsx
<ReportConfigProvider source={{ kind: 'url' }}>            {/* shell */}
<ReportConfigProvider source={{ kind: 'params', queryParams, onParamChange }}>  {/* child */}
```

Every report also becomes trivially storybook-able and testable with plain props — no observable
fakes. The 9 `extends ObservableObject` test fakes are deleted rather than ported.

## 7. Cost, risk, and the strategic point

**Cost.** ~100 consumer files, every report signature, the whole `reportProps` contract, the
loading-progress redesign in §4, and `ChildReportConfig`'s replacement — in one effort, because a
half-migrated tree needs both systems live at once.

**Risks specific to C:**

- **The `getSnapshot` caching pitfall (§2) is easy to get wrong** and fails as an infinite render
  loop, not a subtle bug. Needs a shared, tested helper — not open-coded per hook.
- **Losing the equality gates.** `allFieldsToRequest` (`route-data.js:422-448`) exists to _not_ emit
  when the canonical field set is unchanged, because emitting triggers a full issue refetch. In React
  Query terms that becomes query-key construction, and getting it wrong means a refetch on every
  column toggle. Same for `fieldsToRequest`, `timingCalculations`, and the `diff.list` guards.
- **Ordering.** CanJS's lazy graph means `selectedIssueType` cannot resolve before `derivedIssues`
  exists. In React that becomes render-order and `enabled:` flags, which are easier to read and
  easier to get subtly wrong.
- **No incremental landing.** A/B can ship prop-by-prop behind an unchanged interface. C cannot.

**The strategic point:** C is not an alternative to A/B so much as their destination.
[Option A §7 step 6](./option-a-signals-adapter.md#7-sequencing) is exactly this migration, done one
file at a time, after CanJS is already gone and with no deadline attached. Choosing A or B does not
cost you Option C — it costs you the _big-bang version_ of Option C, which is the part that is hard
to review and hard to revert.

Choosing C directly is defensible if the team would rather absorb one large, well-understood change
than maintain an adapter of indefinite lifespan. It should not be chosen on the assumption that it is
the only way to reach the modern end state.
