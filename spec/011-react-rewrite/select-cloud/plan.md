# select-cloud → React rewrite plan

**Source:** `src/shared/select-cloud.js` (~99 lines)
**Custom element:** `<select-cloud>`
**Status: LIVE** (hosted web app only) — the Jira site/cloud picker in the header.
**Difficulty: Medium** (the auth blocker is now cleared; the work is the popover + wiring)

> **[UNBLOCKED 2026-07-18]** Phase 3 (`jira-login`) is complete. The observable
> auth store now lives at `src/stateful-data/login.js` (`Login extends
ObservableObject`), `main-helper.js` wires `routeData.isLoggedInObservable =
value.from(loginStore, 'isLoggedIn')` (`main-helper.js:77`), and the React
> `LoginButton` is mounted imperatively at `main-helper.js:143`. select-cloud is
> the **last leaf** in the build order and the **last consumer of
> `simple-tooltip`**, so finishing it lets us delete that shared util too.

## Is it used?

Yes, in the hosted web app:

- Rendered declaratively: `index.html:84` and `dev.html:60` (`<select-cloud></select-cloud>`), both loading `src/web.main.ts` (`host:'hosted'`).
- Wired imperatively in `src/shared/main-helper.js`: `:3` side-effect import (`import '../shared/select-cloud'`); `:101-105` `document.querySelector('select-cloud')` then sets `.loginComponent = loginStore` and `.jiraHelpers = jiraHelpers`.
- In the Jira Connect plugin path (`plugin.main.ts`, `host:'jira'`) the tag isn't in the markup, so `querySelector` returns null — **effectively hosted-web-only**. No tests/stories.

## What it does

Header "pill" button showing the current Jira site, with a dropdown to switch sites. Three visual states:

1. **Loading** — while the resources request is pending, a pill showing `...`.
2. **Switchable** — when there are alternate sites, a clickable pill showing the current site name + a chevron; clicking opens a dropdown of the other sites.
3. **Single** — when the only accessible site is the current one, a static (non-interactive) pill showing its name.
4. **(logged out / no resources)** — renders nothing.

Behavior detail:

- **Props (injected):** `jiraHelpers`, `loginComponent`.
- **`canQuery`** getter = `jiraHelpers && loginComponent?.isLoggedIn`.
- **`accessibleResources`** getter (Promise) — if logged in, `jiraHelpers.fetchAccessibleResources()` (GET accessible-resources, `src/jira-oidc-helpers/jira.ts:36`), tagging each `isCurrent = resource.id === localStorage.getItem('scopeId')`; else `[]`. Derives `currentResource` / `alternateResources`.
- **`showResources()`** — renders the site list into a `SimpleTooltip` positioned below the pill, with a manual `setTimeout(…, 13)` + global-click-to-dismiss handler. Each choice does `localStorage.setItem('scopeId', resource.id)` then `window.location.reload()`.
- Reads/writes `localStorage['scopeId']`; emits no events.

## CanJS surface

`StacheElement`, `type.Any`, `stache(...)` (builds the dropdown fragment). Stache `{{#if}}` / `{{#for}}` / `{{#and}}` / `not(...)`, `on:click`, promise auto-unwrapping in the view (`.isPending` / `.value`). Uses `SimpleTooltip` (`src/canjs/ui/simple-tooltip/simple-tooltip.js`, plain HTMLElement) for scroll-aware positioning + outside-click dismiss.

## Dependencies — all present today

Everything this port needs already exists (verified against the codebase 2026-07-18):

- **Login state (React-readable):** `routeData.isLoggedInObservable` (set in `main-helper.js:77`), read via `useCanObservable` (`src/react/hooks/useCanObservable/useCanObservable.ts`). This is exactly how `LoginButton` and `SettingsSidebar` read login/jira state today.
- **`jiraHelpers`:** on `routeData.jiraHelpers` (`main-helper.js:78`) and exposed to React through `JiraProvider` / `useJira` (`src/react/services/jira/`). `fetchAccessibleResources` is a real method on it (`src/jira-oidc-helpers/index.ts:89`).
- **React Query (convention, not strictly required):** shared `queryClient` at `src/react/services/query/` + `useQuery` from `@tanstack/react-query`. It's the app's universal fetch convention (17 usages; every jira/storage/features/reports fetch goes through it — nobody hand-rolls `useEffect`+`fetch`). Here it buys the login gate (`enabled: isLoggedIn`, a 1:1 replacement for the old `canQuery` getter) + free `isLoading`, and keeps this island consistent with the rest. It does **not** buy caching for this component: `accessible-resources` isn't fetched elsewhere through `queryClient` (the raw call at `main-helper.js:50` bypasses it), and the switch hard-reloads anyway. A `useEffect` gated on `isLoggedIn` is a legitimate ~8-line alternative that lets you drop `QueryClientProvider` from the wrapper — see Q6.
- **Dropdown UI:** `@atlaskit/dropdown-menu` (`^12.22.3`), already used in ~10 places — `SavedReportDropdown.tsx` is a near-identical "header trigger → controlled `isOpen` → list of items" shape. It gives us portal positioning **and outside-click dismissal for free**, replacing both `SimpleTooltip` and the manual `setTimeout`/global-click handler.
- **Provider/mount convention:** every React-Query-backed island in this app uses a `*Wrapper.tsx` (see `SettingsSidebarWrapper.tsx`, `ViewReportsWrapper.tsx`) that wraps the inner component in `<JiraProvider jira={routeData.jiraHelpers}><QueryClientProvider client={queryClient}>`. Follow it.
- `useRecentReports.ts:12` already reads `scopeId` from `localStorage` in React — confirms the concept crosses cleanly into React.

No existing cloud-selection component to reuse — this is a net port.

## Replacement plan

Split into three files, mirroring the presentational / container / wrapper convention already in the repo (`LoginButton` is presentational; `SettingsSidebar` + `SettingsSidebarWrapper` is container + providers). The split is what makes this cheap to unit-test and to render in Storybook.

### 1. `SelectCloudView.tsx` — presentational (pure props, no data/providers)

```tsx
interface Resource {
  id: string;
  name: string;
}
interface SelectCloudViewProps {
  isLoading: boolean;
  current?: Resource;
  alternates: Resource[];
  onSelectCloud: (id: string) => void;
}
```

Renders the four states above. Preserve the pill styling verbatim (the `bg-neutral-201 hover:bg-neutral-301 rounded px-3 py-1` classes + the chevron SVG). Use `@atlaskit/dropdown-menu`'s custom-trigger render prop so the trigger keeps the exact pill look:

```tsx
<DropdownMenu
  isOpen={isOpen}
  onOpenChange={() => setIsOpen((p) => !p)}
  shouldRenderToParent
  trigger={({ triggerRef, ...props }) => (
    <button ref={triggerRef} {...props} className={pillClass}>
      <span>{current?.name}</span>
      {/* chevron svg */}
    </button>
  )}
>
  <DropdownItemGroup>
    {alternates.map((r) => (
      <DropdownItem key={r.id} onClick={() => onSelectCloud(r.id)}>
        {r.name}
      </DropdownItem>
    ))}
  </DropdownItemGroup>
</DropdownMenu>
```

Use the controlled `isOpen` + `setIsOpen` pattern from `SavedReportDropdown.tsx:24,42-43` ("Need to control so not to interfere with can routing").

### 2. `SelectCloud.tsx` — container (data + login gate)

```tsx
const jira = useJira();
const isLoggedIn = useCanObservable(isLoggedInObservable); // observable passed as a prop

const { data: resources = [], isLoading } = useQuery({
  queryKey: ['accessible-resources'],
  queryFn: () => jira.fetchAccessibleResources(),
  enabled: isLoggedIn, // gate = old `canQuery`
});

const scopeId = localStorage.getItem('scopeId');
const current = useMemo(() => resources.find((r) => r.id === scopeId), [resources, scopeId]);
const alternates = useMemo(() => resources.filter((r) => r.id !== scopeId), [resources, scopeId]);

const onSelectCloud = (id: string) => {
  localStorage.setItem('scopeId', id);
  window.location.reload();
};

return (
  <SelectCloudView
    isLoading={isLoading && isLoggedIn}
    current={current}
    alternates={alternates}
    onSelectCloud={onSelectCloud}
  />
);
```

- Take `isLoggedInObservable` as a **prop** (like `LoginButton` takes its observables) so the wrapper supplies `routeData.isLoggedInObservable` and tests can supply a fake. This keeps `routeData` out of the testable unit.
- The `enabled: isLoggedIn` gate replaces `canQuery` and is _more_ reactive than the old snapshot: when login resolves, `useCanObservable` re-renders and the query fires.
- **Why React Query at all** (see Q6): it's the house fetch convention, not a hard requirement. It's justified here by the `enabled` gate + free loading state + consistency — _not_ caching (there's none to share, and the switch reloads). If Q6 lands on "keep it minimal," swap the `useQuery` for a `useEffect` fetch gated on `isLoggedIn` and remove `QueryClientProvider` from the wrapper.

### 3. `SelectCloudWrapper.tsx` — providers (the mount target)

```tsx
const SelectCloudWrapper: FC = () => (
  <JiraProvider jira={routeData.jiraHelpers}>
    <QueryClientProvider client={queryClient}>
      <SelectCloud isLoggedInObservable={routeData.isLoggedInObservable} />
    </QueryClientProvider>
  </JiraProvider>
);
```

Suggested location: `src/react/SelectCloud/` (sibling of `LoginButton/`, `SampleDataNotice/`) with `index.ts` re-exporting the wrapper as default — matching the repo layout.

### 4. HTML entry points

In `index.html:84` and `dev.html:60`, replace `<select-cloud></select-cloud>` with `<div id="select-cloud"></div>`.

### 5. `main-helper.js` wiring

`createRoot` and `createElement` are already imported (`:6-7`). Replace the querySelector prop-injection at `:101-105`:

```js
// remove: import '../shared/select-cloud';                 (line 3)
// add:    import SelectCloudWrapper from '../react/SelectCloud';

const selectCloudEl = document.getElementById('select-cloud');
if (selectCloudEl) {
  createRoot(selectCloudEl).render(createElement(SelectCloudWrapper));
}
```

`routeData.isLoggedInObservable` (`:77`) and `routeData.jiraHelpers` (`:78`) are both set before this point, so the wrapper can read them at mount. Keep the `if (selectCloudEl)` guard so the Connect (`jira`) host — where the div isn't in the markup — stays a no-op, exactly as today.

### 6. Cleanup

- Delete `src/shared/select-cloud.js`.
- Delete `src/canjs/ui/simple-tooltip/` — select-cloud is its **last consumer** (verified: only `simple-tooltip.js` itself and `select-cloud.js` reference it now; table-grid already migrated). Confirm with a grep at execution time before deleting.

## Testing

The component has **no tests or stories today.** Follow the layering the `jira-login` phase established (see `../jira-login/plan.md` Testing §). Tooling present: vitest + jsdom (`vite.config.ts:78`), `@testing-library/react` + `user-event`, Storybook, Playwright.

### §A — Unit-test `SelectCloudView` (the big payoff — pure, no query/providers)

`SelectCloudView.test.tsx` (vitest + testing-library). Because the view is pure props, every state is a trivial render assertion:

- **Loading:** `isLoading` → the `...` pill renders; no trigger/current name.
- **Switchable:** `current` + non-empty `alternates` → pill shows `current.name`; opening the dropdown (`userEvent.click` the trigger) reveals one item per alternate; clicking an item calls `onSelectCloud` with that resource's `id` (spy) exactly once.
- **Single:** `current` + empty `alternates` → static pill shows the name, **no** dropdown trigger / not clickable.
- **Empty:** no `current`, no `alternates` → renders nothing (`container` empty).

This isolates the branching logic (the part most likely to regress) with zero async/query flakiness.

### §B — Integration-test `SelectCloud` container (login gate + query wiring)

`SelectCloud.test.tsx` (vitest). Render inside a test `QueryClientProvider` (`new QueryClient({ defaultOptions: { queries: { retry: false } } })` — copy `Features.test.tsx:37-44`) and a `JiraProvider` fed a fake `jira` whose `fetchAccessibleResources` is a `vi.fn()`. Pass a hand-rolled fake observable for `isLoggedInObservable` (copy the `fakeObservable` helper in `LoginButton.test.tsx:11-21`). Assert:

- **Logged out** (`isLoggedInObservable` value `false`) → `fetchAccessibleResources` is **not** called (query disabled) and nothing renders.
- **Logged in** → `fetchAccessibleResources` is called; after it resolves with `[{id:'A',name:'Site A'},{id:'B',name:'Site B'}]` and `localStorage.scopeId='A'`, the pill shows "Site A" and the dropdown offers "Site B".
- **Switch:** stub `onSelectCloud`'s effects — see the note below — click "Site B", assert `localStorage.getItem('scopeId') === 'B'`.

**Testability note (do this in the container):** `window.location.reload()` cannot be called in jsdom (throws "not implemented"). Keep `onSelectCloud` as the single side-effect site and, in the container test, stub reload — e.g. `vi.stubGlobal('location', { ...window.location, reload: vi.fn() })` (vitest) or spy on a thin extracted `reloadPage()` helper. Set/clear `localStorage` in `beforeEach`/`afterEach`. (If §B's reload-stubbing proves fiddly, the §A view test already covers the `onSelectCloud(id)` contract with a plain spy — §B can then assert only the query gate + rendering.)

### §C — Storybook story (visual verification)

`SelectCloudView.stories.tsx` — four stories (Loading / Switchable / Single / Empty) driven by plain props (no query, no store), same as `LoginButton.stories.tsx`. Because we story the _view_, no `QueryClient`/`Jira` fakes are needed. Lets the pill + dropdown be verified visually (Playwright screenshot against `localhost:6006`), and the repo leans on Storybook heavily.

### §D — Manual / e2e verification

**No existing e2e covers the picker** — `playwright/auth.setup.ts` logs in via real OAuth and the `scopeId` gets set during auth, but no spec opens the site switcher. So this is manual (or an optional new spec):

1. `npm run dev`, log in with a Jira account that can access **multiple** sites → pill shows the current site, dropdown lists the others, selecting one reloads the page and the new site's data loads (`localStorage.scopeId` updated).
2. Log in with a **single-site** account → static pill, no dropdown.
3. Logged out → picker renders nothing; app still boots.
4. Load the Connect plugin path (`host:'jira'`) → no `#select-cloud` div, no crash (the `if (selectCloudEl)` guard).

Run `npm test` (vitest) and `npm run test:e2e` before/after to confirm no regressions in the authenticated suite (which depends on `scopeId`/login being intact).

**Optional new e2e (nice-to-have, flaky-prone):** in the authenticated suite, assert the pill renders the current site name. Skip switching sites in e2e — it reloads and requires a multi-site test account.

## Risks / open questions

- **~~Depends on the login/auth bridge~~** — resolved; `jira-login` shipped (see banner). The React-readable source is `routeData.isLoggedInObservable`.
- **Custom-trigger styling:** `@atlaskit/dropdown-menu`'s default trigger is a standard button. Use the `trigger={({ triggerRef, ...props }) => …}` render prop to preserve the existing pill look, and pass `shouldRenderToParent` (as `SavedReportDropdown` does) so the menu positions correctly within the header. Confirm it looks right in the header at execution time; if the render-prop trigger fights the pill CSS, fall back to `@atlaskit/popup` (`^1.29.4`) with a hand-rolled trigger.
- **`reload()` in jsdom** — see §B testability note; funnel the side effect through `onSelectCloud` so it's stubbable.
- **Query key namespacing:** `['accessible-resources']` is fine for a single query; if you prefer the repo's key-factory convention (`featuresKeyFactory`, `reportKeys`), add a small factory under `src/react/services/jira/`. Not required.
- Hosted-web-only — verify it stays absent/no-op in the Connect plugin path (the `getElementById` guard handles this).

## Questions

> Suggested answers included. An agent picking this up can proceed on the suggestions unless Justin overrides.

### Q1 — Popover library: `@atlaskit/dropdown-menu` or `@atlaskit/popup`?

- **(a)** `@atlaskit/dropdown-menu` — matches `SavedReportDropdown` (near-identical shape), gives item semantics + outside-click + positioning for free.
- **(b)** `@atlaskit/popup` — more control over arbitrary popover content, but we'd hand-roll the item list and keyboard/focus behavior.

**Suggestion:** (a). The UI is literally "a trigger → a list of choices," which is exactly what `DropdownMenu` is for, and the repo already has a working template. Keep (b) as the fallback only if the custom-trigger styling can't be made to match the pill.

**Answer:** A

### Q2 — File location & naming for the new component?

- **(a)** `src/react/SelectCloud/` with `SelectCloudView.tsx` (view) + `SelectCloud.tsx` (container) + `SelectCloudWrapper.tsx` (providers) + `index.ts` → sibling of `LoginButton/`, `SampleDataNotice/`.
- **(b)** Somewhere under `src/react/shared/` (as the old plan's "TBD" hinted).

**Suggestion:** (a). `src/react/shared/` doesn't exist as a convention here; the header islands (`LoginButton`, `SampleDataNotice`) live directly under `src/react/`. Keep the three-file split — it's what makes §A/§C cheap.

**Answer:** A

### Q3 — Delete `src/canjs/ui/simple-tooltip/` in this PR?

select-cloud is its last consumer (grep confirms only the util itself + `select-cloud.js` reference it).

- **(a)** Delete it in this PR — finishes the leaf-migration cleanup, shrinks `src/canjs/`.
- **(b)** Leave it; delete in a separate cleanup PR.

**Suggestion:** (a). It's dead the moment `select-cloud.js` is removed; deleting together keeps the "port replaces the old thing" story clean. Re-grep at execution time to be safe.

**Answer:** A

### Q4 — Which testing layers are required to merge?

- **§A** view unit tests · **§B** container integration test · **§C** Storybook · **§D** manual/e2e

**Suggestion:** §A required (core branching logic), §B required (proves the login gate + query wiring — the whole point of the port), §D manual walkthrough required before merge; §C nice-to-have (but cheap, so do it).

**Answer:**lets do it

### Q5 — Preserve the exact `reload()`-on-switch behavior?

The old component does `localStorage.setItem('scopeId', id)` + `window.location.reload()` — a hard reload is how the rest of the app picks up the new `scopeId` (it's read from `localStorage` in request helpers, storage, `useRecentReports`).

- **(a)** Keep the hard reload (behavior-preserving port).
- **(b)** Try to make the switch reactive (invalidate queries / re-fetch) without a reload.

**Suggestion:** (a). `scopeId` is read synchronously from `localStorage` in many non-React places (`hosted-request-helper.js:33`, `jira/storage/index.web.ts:44`, `jira-oidc-helpers/jira.ts:630`); a reactive switch would need all of those to re-read, which is out of scope for a leaf port. Keep the reload; revisit only after the route-data migration.

**Answer:** A. Reload is fine.

### Q6 — Fetch with React Query, or a plain `useEffect`?

React Query is the app's universal fetch convention, but it isn't strictly required for this single, un-shared GET. It's not doing any caching work here (accessible-resources isn't fetched elsewhere through `queryClient`, and the switch hard-reloads).

- **(a)** `useQuery` (`enabled: isLoggedIn`) + `QueryClientProvider` in the wrapper — consistent with every other React island; the `enabled` gate and `isLoading` come free.
- **(b)** `useEffect` gated on `isLoggedIn` + local `useState` — ~8 lines, drops `QueryClientProvider` from the wrapper (only `JiraProvider` remains).

**Suggestion:** (a). The consistency + the free `enabled` gate outweigh the one extra (singleton) provider, and it avoids being the lone hand-rolled fetch a reviewer/agent has to think twice about. Choose (b) only if minimizing the provider tree is a priority.

**Answer:** A for now
