# Routing without CanJS

**The short answer: there is nothing to route.** `src/canjs/routing/state-storage.js:23` calls
`route.register('')` — one empty rule — and that is the app's entire route table. Every piece of
state lives in the query string. `route` is never asked to match a path, build a link, or fill a
`route.data`. The only `route` API touched outside `can.js` is `route.start()`,
`route._onStartComplete` and `route.urlData`.

So "replace the router" means: replace _an observable holding `location.search`_, plus four pieces of
browser plumbing that keep it honest. That is ~130 lines. This design is the same under Options A, B
and C — only the last section (how React reads it) differs.

## 1. What has to be preserved

| Behaviour                | Today                                                                      | Why it matters                                                                                            |
| ------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Observable search string | `pushStateObservable.value` = `location.search`                            | ~11 files read it directly; every param resolver listens to it                                            |
| Per-param write-through  | `updateUrlParam(key, val, default)` — set, or delete when equal to default | Keeps URLs short; the "default" arg is what makes a saved report's value omittable                        |
| push vs. replace         | `replaceStateKeys = ['compareTo', 'timeInStatusReorder']` (`:19-20`)       | Slider drags would otherwise add one history entry per frame                                              |
| External-change capture  | `history.pushState`/`replaceState` monkeypatch                             | Any navigation, including third-party, notifies subscribers                                               |
| Back/forward             | `popstate` listener                                                        |                                                                                                           |
| Anchor interception      | delegated `click` on `<a>`                                                 | `ViewReports.tsx:55` and `RecentReports.tsx:62` use `href={'?report=' + id}`; without it they full-reload |
| Silent replace           | `underlyingReplaceState` captured pre-patch (`:16`)                        | Boot-time legacy-param rewrite must land _before_ anything observes                                       |
| Host hooks               | `reconcileRoutingState()` → migrate → `start()` → `syncRouters`            | Connect iframe: the real URL is owned by `AP.history`                                                     |

## 2. `src/routing/url-store.ts`

```ts
type Listener = () => void;

/**
 * Params whose change REPLACES the current history entry instead of pushing a new one.
 * Ported from state-storage.js:19-20 — both are scrubbed controls that would otherwise
 * fill the back stack with one entry per animation frame.
 */
const REPLACE_STATE_KEYS = ['compareTo', 'timeInStatusReorder'];

/**
 * The app's entire "router": an observable `location.search`.
 *
 * Exposes the same `{ value, get, set, on, off }` shape CanJS observables did, so
 * `useCanObservable` / `useQueryParams` and the ~11 direct consumers of
 * `pushStateObservable` are unaffected by the swap.
 */
class UrlStore {
  #listeners = new Set<Listener>();
  #search = typeof location === 'undefined' ? '' : location.search;
  #started = false;

  // Captured at module evaluation, before `start()` installs our patch and before any
  // host wraps it. `replaceSilently` needs a way to the real API. (state-storage.js:16
  // does the same thing for the same reason.)
  #nativePushState = globalThis.history?.pushState.bind(globalThis.history);
  #nativeReplaceState = globalThis.history?.replaceState.bind(globalThis.history);

  get value() {
    return this.#search;
  }
  set value(search: string) {
    this.#navigate(search);
  }

  get() {
    return this.#search;
  }
  set(search: string) {
    this.#navigate(search);
  }
  getData() {
    return this.#search;
  }

  on(handler: Listener) {
    this.#listeners.add(handler);
  }
  off(handler: Listener) {
    this.#listeners.delete(handler);
  }

  /** Read one param. */
  param(key: string): string | null {
    return new URLSearchParams(this.#search).get(key);
  }

  /**
   * Set one param, or delete it when it equals `defaultValue`.
   * Direct port of state-storage.js:431-440 — same signature, same omit-on-default rule.
   */
  setParam(key: string, value: string, defaultValue: string) {
    const params = new URLSearchParams(this.#search);
    if (value !== defaultValue) params.set(key, value);
    else params.delete(key);
    this.#navigate(params.toString());
  }

  /**
   * Replace the whole search string WITHOUT notifying — the correction lands before
   * anything observes the URL. Boot-time legacy-param rewrite only
   * (jira/reports/migrations/url.ts); `directlyReplaceUrlSearch`'s replacement.
   *
   * Falls back to the pathname when the new search is empty: `replaceState(…, '')`
   * resolves against the current document URL and would keep the very params being
   * removed. (That bug is documented at state-storage.js:415-423.)
   */
  replaceSilently(search: string) {
    const normalized = !search ? location.pathname : this.#withPrefix(search);
    this.#nativeReplaceState!(null, '', normalized);
    this.#search = location.search; // resync, deliberately no notify
  }

  /** Coalesce several param writes into ONE history entry and ONE notification. */
  batch(fn: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(this.#search);
    fn(params);
    this.#navigate(params.toString());
  }

  #withPrefix(search: string) {
    return !search ? '' : search.startsWith('?') ? search : '?' + search;
  }

  #navigate(search: string) {
    const next = this.#withPrefix(search);
    if (next === this.#search) return;

    const method = this.#shouldReplace(this.#search, next) ? 'replaceState' : 'pushState';
    // Route through the (possibly patched) global so any host wrapper still runs, then
    // resync from `location` rather than trusting our own string.
    history[method](null, '', location.pathname + next + location.hash);
    this.#sync();
  }

  /** replaceState if EVERY changed key is a replace-state key — matches can-route-pushstate. */
  #shouldReplace(prev: string, next: string) {
    const a = new URLSearchParams(prev);
    const b = new URLSearchParams(next);
    const keys = new Set([...a.keys(), ...b.keys()]);
    const changed = [...keys].filter((k) => a.get(k) !== b.get(k));
    return changed.length > 0 && changed.some((k) => REPLACE_STATE_KEYS.includes(k));
  }

  #sync = () => {
    if (location.search === this.#search) return;
    this.#search = location.search;
    // Copy: a listener may unsubscribe during dispatch.
    for (const listener of [...this.#listeners]) listener();
  };

  /**
   * `route.start()`'s replacement. Idempotent. Returns a teardown for tests.
   */
  start() {
    if (this.#started) return () => {};
    this.#started = true;
    this.#search = location.search;

    // 1. Back/forward.
    addEventListener('popstate', this.#sync);

    // 2. Any navigation, including one we didn't initiate, notifies. This is what
    //    can-route-pushstate's onBound patch did (can.js:43684-43700).
    history.pushState = (...args: Parameters<History['pushState']>) => {
      this.#nativePushState!(...args);
      this.#sync();
    };
    history.replaceState = (...args: Parameters<History['replaceState']>) => {
      this.#nativeReplaceState!(...args);
      this.#sync();
    };

    // 3. Same-document anchors become pushState instead of a full reload.
    document.documentElement.addEventListener('click', this.#onAnchorClick);

    return () => {
      removeEventListener('popstate', this.#sync);
      document.documentElement.removeEventListener('click', this.#onAnchorClick);
      history.pushState = this.#nativePushState!;
      history.replaceState = this.#nativeReplaceState!;
      this.#started = false;
    };
  }

  /**
   * Replaces can-route-pushstate's anchor delegate (can.js:43600-43660). Narrower on
   * purpose: it only claims links that change nothing but the query string, which is the
   * only kind this app has (`?report=…`). Everything else — new tabs, modified clicks,
   * `target`, `download`, cross-origin, other paths — falls through to the browser.
   */
  #onAnchorClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = (event.target as Element | null)?.closest?.('a');
    if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
    if (anchor.getAttribute('rel') === 'external') return;

    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname !== location.pathname) return; // we do no path routing
    if (url.hash && url.search === location.search) return; // pure hash change

    event.preventDefault();
    this.#navigate(url.search);
  };
}

export const urlStore = new UrlStore();
```

## 3. What each existing export becomes

`state-storage.js`'s public surface maps one-to-one. Nothing in the ~11 consuming files changes shape.

| Today                                                                    | Tomorrow                                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------------- |
| `pushStateObservable`                                                    | `urlStore` (same `{value, on, off, get, set}`)            |
| `updateUrlParam(k, v, d)`                                                | `urlStore.setParam(k, v, d)`                              |
| `getUrlParamValue(k)`                                                    | `urlStore.param(k)`                                       |
| `directlyReplaceUrlSearch(s)`                                            | `urlStore.replaceSilently(s)`                             |
| `listenToUrlChange(k, listenTo, cb)`                                     | folded into the param registry (§6)                       |
| `paramValue(reportData, k)`                                              | unchanged — pure `URLSearchParams` helper, no CanJS in it |
| `saveJSONToUrl*`, `makeParamAndReportDataReducer`, `makeArrayOfStrings…` | folded into the param registry (§6)                       |
| `saveToLocalStorage`                                                     | unchanged shape, ~8 lines, no CanJS                       |

`route`, `RoutePushstate`, `route.urlData`, `route.register('')` — all deleted.

## 4. Host integration

The three-slot boot order at `plugin.main.ts:50-68` survives, with `route` replaced by `urlStore`:

```ts
// src/plugin.main.ts — Connect
configureRouting: (urlStore, { beforeRouteStart }) => {
  routing.reconcileRoutingState();   // AP.history → location.search (discards prior writes)
  beforeRouteStart();                 // legacy-param rewrite, via replaceSilently
  urlStore.start();
  urlStore.on(routing.mirrorToContainer);   // was route._onStartComplete = syncRouters
},
```

```ts
// src/web.main.ts — hosted
configureRouting: (urlStore, { beforeRouteStart }) => {
  beforeRouteStart();
  urlStore.start();
},
```

**Deliberate change to flag.** `syncRouters` today mirrors into `AP.history` by monkeypatching
`history.pushState` _on top of_ CanJS's patch (`routing/index.plugin.ts:22-33`) — so `replaceState`
navigations are **not** mirrored, and the Jira container URL goes stale for every `compareTo` drag.
Making it a plain `urlStore.on(...)` subscriber mirrors both. That is almost certainly the desired
behaviour, but it _is_ a behaviour change and should be verified in the Connect host, not assumed.
Keeping the current asymmetry is a one-line alternative (`urlStore.on(...)` guarded on the last
method used).

## 5. React binding

Both forms work against the same store; the difference is only whether consumers change.

**Keep the interface** (Options A/B) — nothing changes, `useCanObservable` already fits:

```ts
const search = useCanObservable(urlStore); // unchanged
const { queryParams } = useQueryParams(urlStore); // unchanged
```

**Modernize** (Option C) — `useSyncExternalStore`, which is what this pattern is for:

```ts
// src/routing/useUrlSearch.ts
export const useUrlSearch = () =>
  useSyncExternalStore(
    (cb) => {
      urlStore.on(cb);
      return () => urlStore.off(cb);
    },
    () => urlStore.value,
    () => '', // SSR/test snapshot
  );

// src/routing/useUrlParam.ts — typed, codec-driven, from the param registry
export function useUrlParam<T>(key: ParamKey): [T, (value: T) => void] {
  const search = useUrlSearch();
  const spec = PARAMS[key];
  const value = useMemo(() => spec.parse(new URLSearchParams(search).get(key) ?? spec.defaultRaw), [search, key]);
  const set = useCallback((next: T) => urlStore.setParam(key, spec.stringify(next), spec.defaultRaw), [key]);
  return [value, set];
}
```

`useSyncExternalStore` also removes the laziness workaround documented at
`useCanObservable.ts:26-40` — React handles the subscribe/read race itself.

## 6. The param registry — the piece that isn't routing

The URL store above is the easy half. The other half is the ~60 typed params with three-level
precedence (**URL → saved report `queryParams` → default**), which currently exists **twice**:
imperatively in `route-data.js` and declaratively in `ChildReportConfig.js`'s `CHILD_PARAMS` table.

Every option should collapse them into one table, which the shell and each embedded child both read:

```ts
// src/routing/params.ts — one source of truth for both consumers
export const PARAMS = {
  jql: str(''),
  loadChildren: bool(false),
  compareTo: { parse: parseCompareTo, stringify: String, defaultRaw: String(_15DAYS_IN_S) },
  tableColumns: json([{ sourceId: 'identity:treeSummary' }]),
  statusesToShow: list(),
  // … ~60 entries, the union of route-data.js's props and CHILD_PARAMS
} satisfies Record<string, ParamSpec<unknown>>;

export type ParamKey = keyof typeof PARAMS;
export type ParamValue<K extends ParamKey> = ReturnType<(typeof PARAMS)[K]['parse']>;
```

That single change buys: real types for every param (today `routeData` is typed through a mapped
type over prop _descriptors_), deletion of the drift test, and one place to add a param instead of
two. **It is worth doing on its own merits even if CanJS stayed.**

The precedence rule itself — `makeParamAndReportDataReducer` (`state-storage.js:221-311`) — is
product behaviour and is ported as-is:

```ts
const resolveRaw = (key: ParamKey, search: string, reportData?: SavedReport) =>
  new URLSearchParams(search).get(key) ??
  (reportData ? new URLSearchParams(reportData.queryParams).get(key) : null) ??
  PARAMS[key].defaultRaw;
```

## 7. What this does _not_ solve

Self-healing params are not simple codecs and stay bespoke under every option:

- **`selectedIssueType`** (`route-data.js:612-786`) waits for `derivedIssues`, validates against the
  _returned_ hierarchy, defaults to the top level, and **writes itself back** to the URL.
- **`toIssueType`** (`:802-893`) clamps against `selectedIssueType` and deliberately does _not_
  write back.
- **`timingCalculations`** (`:516-585`) parses a `type:calc,type:calc` string and diffs as a map.
- **`allFieldsToRequest`** (`:422-448`) gates emission on a canonicalized field-id set so a column
  change doesn't trigger a refetch it doesn't need.

These four are where the reactive-core choice actually bites, because each one is "recompute when
any of these three other things change, then maybe write back to the URL". That is
[`option-a`](./option-a-signals-adapter.md) §4's worked example.

## 8. Testing

The store is directly testable in jsdom, which `route`/`RoutePushstate` never really was:

```ts
it('replaces rather than pushes for compareTo', () => {
  const teardown = urlStore.start();
  const before = history.length;
  urlStore.setParam('compareTo', '86400', '1296000');
  urlStore.setParam('compareTo', '172800', '1296000');
  expect(history.length).toBe(before + 1);   // first push, then replace
  teardown();
});

it('intercepts a query-only anchor instead of reloading', () => {
  const teardown = urlStore.start();
  render(<a href="?report=abc">open</a>);
  fireEvent.click(screen.getByText('open'));
  expect(urlStore.param('report')).toBe('abc');
  teardown();
});
```

Existing coverage to keep green: `src/jira/reports/migrations/url.test.ts` (silent-replace ordering),
`ReportLayoutProvider.test.tsx`, `FullscreenToggle.test.tsx`, `DateRangeFilter.test.tsx`,
`useSelectedReport.test.tsx`.

Worth adding, since nothing covers it today: a Playwright case that clicks a saved report in
`ViewReports` and asserts no page load occurred (the anchor-interception path).
