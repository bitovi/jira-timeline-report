# Surface area — everything CanJS does in this app

Verified against the tree at `9093c94d`. This is the contract any replacement must satisfy. Every
claim below has a file:line reference; check them before trusting a summary.

## 1. What is imported from `can.js`

Only these, across the whole `src/` tree (grep excluding `src/can.js` itself):

| Import                                                | Where                                     | Count               |
| ----------------------------------------------------- | ----------------------------------------- | ------------------- |
| `ObservableObject`                                    | 4 production classes + 9 test fakes       | 48 mentions         |
| `value` (`.from` / `.bind` / `.with` / `.returnedBy`) | everywhere                                | ~59 / ~32 / ~25 / 5 |
| `route`, `RoutePushstate`                             | `state-storage.js:1`, `main-helper.js:16` | 2 files             |
| `diff.list` / `diff.map`                              | route-data, state-storage                 | 6 / 2               |
| `type.Any`                                            | route-data, login, ChildReportConfig      | 6                   |
| `queues.batch`                                        | `TimelineReport.tsx:132,135`              | 1 site              |
| `Reflect.getValue`                                    | `state-helpers.js:71`                     | 1                   |
| `domEvents`, `domMutateDomEvents`                     | `main-helper.js:16,25`                    | 1 site              |

`domEvents.addEvent(domMutateDomEvents.inserted)` at `main-helper.js:25` registers the DOM-mutation
`inserted` event that StacheElements needed. **No StacheElements remain** (grep for `StacheElement`
returns only historical comments). This line is dead — verify and delete.

## 2. The observable interface consumers actually use

Declared in `src/react/hooks/useCanObservable/useCanObservable.ts:3-10`:

```ts
export interface CanObservable<TData> {
  value: TData;
  getData(): TData; // 1 call site
  on(handler: () => void): void;
  off(handler: () => void): void;
  set(value: TData): void;
  get(): TData;
}
```

Reached by ~57 files via `useCanObservable`, ~43 via `useRouteData`, and by every report through the
`*Obs` prop bag built in `src/react/reports/reportProps.ts`. **This interface is the compatibility
boundary.** Preserve it and the consumer tree does not change.

Two behaviours of it are load-bearing and easy to lose:

- **Laziness.** A CanJS observable holds nothing until something binds. `useCanObservable.ts:26-40`
  documents the bug this caused: a suspended report unsubscribes, misses the value that lands during
  the fetch, and renders headers over an empty body. The hook re-reads immediately after `on()` to
  compensate. Any replacement must either keep laziness _and_ that re-read, or be eager.
- **`value.from(obj, 'a.b.c')` deep key paths.** `useReportLoadingState.ts:59` observes
  `'derivedIssuesRequestData.progressData.value.issuesRequested'` — four segments alternating
  between reactive and plain objects.

## 3. The four production `ObservableObject` classes

| Class                     | File                                                           | Size        | Role                                                                                                                            |
| ------------------------- | -------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `RouteData`               | `src/canjs/routing/route-data/route-data.js`                   | 1,099 lines | The singleton. **88 declared properties** — 19 computed getters, the rest URL params, imperative resolvers and injected values. |
| `ChildReportConfig`       | `src/react/reports/ReportOfReports/model/ChildReportConfig.js` | ~500 lines  | Per-child mirror of the same schema, sourced from a saved `queryParams` string instead of the URL.                              |
| `TimelineReportViewModel` | `src/react/TimelineReport/timeline-report-view-model.js`       | 216 lines   | Derived-data pipeline (rollup/rollback/filter) every report consumes. Pure computed getters.                                    |
| `Login`                   | `src/stateful-data/login.js`                                   | ~90 lines   | Auth store. Four plain observable booleans + a `resolved` promise. Trivially portable to anything.                              |

Note `ChildReportConfig` already factors its param schema into a **declarative data table**
(`CHILD_PARAMS`, `{ parse, stringify, defaultRaw }` per key, `ChildReportConfig.js:~120-245`).
`route-data.js` expresses the identical schema as imperative prop descriptors. A drift test keeps
them aligned. **Every option below should collapse these two into one registry** — that is the
single biggest simplification available, independent of which reactive core wins.

## 4. The prop-definition protocol (`static props = {...}`)

This is the part with no off-the-shelf equivalent. Five forms are in use:

```js
// 1. plain default
isLoggedIn: false,
jiraHelpers: { enumerable: false, default: null },
reports: { get default() { return REPORTS; }, enumerable: false },

// 2. computed getter — re-runs when anything it reads changes
get reportData() { return this.reportsData?.[this.report]; },

// 3. async — resolve from a promise
simplifiedIssueHierarchy: { async(resolve) { return this.simplifiedIssueHierarchyPromise; } },

// 4. imperative resolver — the workhorse; lazily started, may resolve many times
fieldsToRequest: {
  value({ resolve, listenTo, lastSet }) { /* ... */ },
},

// 5. typed/tagged
compareTo: { type: Number, enumerable: true, serialize(v) { ... } },
```

### `listenTo` has exactly three forms

Confirmed by grepping all 45 `listenTo(` call sites outside `can.js`:

| Form                       | Handler signature         | Example                                        |
| -------------------------- | ------------------------- | ---------------------------------------------- |
| `listenTo('propName', fn)` | `fn({ value })` or `fn()` | `route-data.js:443`                            |
| `listenTo(observable, fn)` | `fn(value)`               | `state-storage.js:463` (`pushStateObservable`) |
| `listenTo(lastSet, fn)`    | `fn(value)`               | `state-storage.js:300`                         |

`lastSet` is an observable of "the last value someone assigned to this property". It is how a prop
stays _settable_ while also being _derived_ — the resolver decides whether to honour the set. That
pattern appears in `fieldsToRequest`, `normalizeOptions`
(`data-utils.js:makeAsyncFromObservableButStillSettableProperty`), `selectedIssueType`, `toIssueType`
and every URL-backed param. Any replacement needs an equivalent.

### Instance methods used

`routeData.assign({...})` (`useJQL.ts:24`), `routeData.serialize()` (`SaveReports.tsx:82`,
`useSelectedReport.ts:57`), `routeData.on('timingCalculations', fn)` (`main-helper.js:117` — a
comment admits this exists only "to make sure things are bound so react can be cool"; it is a
laziness workaround and should die with the migration).

`serialize()` emits all ~51 enumerable params including defaults (~1.2 KB) — see
`storedQueryParams.test.ts:10`. Saved reports depend on this output, so the replacement's
`serialize()` must produce the same key set.

## 5. The URL layer

`src/canjs/routing/state-storage.js` — 468 lines, about half of it commented-out alternatives.

```js
export const pushStateObservable = new RoutePushstate(); // :18
pushStateObservable.replaceStateKeys.push('compareTo'); // :19
pushStateObservable.replaceStateKeys.push('timeInStatusReorder'); // :20
route.urlData = pushStateObservable; // :21
route.urlData.root = window.location.pathname; // :22
route.register(''); // :23  ← the only route
```

`pushStateObservable.value` is `location.search` (leading `?` included). Writing to it
(`updateUrlParam`, `:431-440`) diffs old vs new params and calls `history.pushState` — or
`replaceState` if a changed key is in `replaceStateKeys`.

`directlyReplaceUrlSearch` (`:424-429`) deliberately bypasses the observable using
`underlyingReplaceState`, captured at module load (`:16`) _before_ `route.start()` patches
`history`. That ordering is load-bearing for the boot-time legacy-param rewrite
(`src/jira/reports/migrations/url.ts`). See [`routing.md`](./routing.md) §5.

The three-level precedence every param implements — **URL param → saved report's `queryParams` →
default** — lives in `makeParamAndReportDataReducer` (`:221-311`). This is real product behaviour,
not framework glue, and survives every option unchanged.

## 6. What `route.start()` actually does

Nothing route-like. From `can.js:43663-43712` (`PushstateObservable.onBound`) plus `canRoute.start`:

1. Seeds `_value` from the current URL.
2. Adds a delegated `click` listener on `<a>` — same-origin links under `root` get `preventDefault()`
   - `pushState` instead of a page load. **Two live call sites depend on this**:
     `src/react/ViewReports/ViewReports.tsx:55` and
     `src/react/SaveReports/components/SavedReportDropdown/RecentReports.tsx:62`, both
     `href={'?report=' + report.id}`. Without interception these become full reloads — a real
     regression (re-auth, re-fetch, lost caches).
3. Monkeypatches `history.pushState` and `history.replaceState` so that _any_ navigation — including
   ones this app didn't initiate — notifies subscribers.
4. Adds a `popstate` listener.
5. Calls `route._onStartComplete` — the Connect host uses this to layer _its_ `history.pushState`
   patch on top (`plugin.main.ts:66` → `routing/index.plugin.ts:syncRouters`), mirroring every push
   into `AP.history`. **Patch order matters**: CanJS patches first, the host wraps it.

## 7. Host integration

| Host             | Boot sequence                                                                                                       | File                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Connect (`jira`) | `routing.reconcileRoutingState()` → `beforeRouteStart()` → `route._onStartComplete = syncRouters` → `route.start()` | `src/plugin.main.ts:50-68` |
| Web (`hosted`)   | `beforeRouteStart()` → `route.start()`                                                                              | `src/web.main.ts:20-25`    |

`reconcileRoutingState()` (`routing/index.plugin.ts:9-21`) replaces the entire search string with
the Jira container's params. Anything written before it is discarded — which is why the legacy-param
rewrite has to sit between it and `route.start()`. Preserve this three-slot ordering exactly.

## 8. Known rough edges worth fixing on the way out

Not blockers; note them so the replacement doesn't faithfully reproduce them.

- **`routeData.assign({a,b,c,d})` writes four history entries.** Each prop's `lastSet` handler calls
  `updateUrlParam` independently and each one pushes. `useJQL.ts:24` does exactly this with four
  keys. A batched URL write would produce one entry.
- **`compareTo`'s `stringify` references an undeclared `date`** (`route-data.js:263`) and would throw
  if reached. It is dead (the value is always a number by then). `ChildReportConfig.js` deliberately
  does not reproduce it.
- **`main-helper.js:117`'s `routeData.on('timingCalculations', () => {})`** is a no-op subscription
  that exists only to force lazy binding.
- **~200 of `state-storage.js`'s 468 lines are commented-out alternate implementations** (`:88-218`,
  `:283-288`, `:350-414`).
- **`domEvents.addEvent(domMutateDomEvents.inserted)`** (`main-helper.js:25`) is dead.
