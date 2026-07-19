# Testing exploration — making data-loading behavior testable

> **Why this doc exists.** During the timeline-report React rewrite, the live loading indicator
> ("Loading … / Loaded X of Y issues", where the total _grows_ as child issues are discovered)
> regressed and we **could not catch it with an automated test**. This explores why, and what it
> would take to make this class of behavior testable. Written to inform a decision, not to prescribe
> one. Applies well beyond this one bug — most of the react-rewrite's report components consume live
> Jira data.

## 1. The behavior we need to exercise

A real report load moves through: **pending** → **progress ticks** (`issuesReceived`/`issuesRequested`
update, and `issuesRequested` climbs as children are found) → **resolved** (report renders) — or
**rejected** (generic error / no-license). The regression was silent: the shell showed "Loading …"
but the counts never updated, because it observed the progress value at the wrong key path.

## 2. Why it's untestable today (grounded in the code)

Two compounding facts:

1. **The credential-free path skips progress entirely.**
   `getRawIssues` (`src/stateful-data/jira-data-requests.js:95`) short-circuits when unauthenticated:

   ```js
   if (isLoggedIn === false) {
     return bitoviTrainingData(new Date());   // synchronous; progressUpdate NEVER called
   }
   ...
   return loadIssues({ jql, ... }, progressUpdate);   // only THIS path emits progress
   ```

   Sample mode — the only mode our Playwright harness can reach without secrets — _structurally
   cannot_ produce a loading/progress state. (Confirmed: forcing a `?jql=` in unauth mode renders a
   report instantly.)

2. **Progress originates only from the live network fetch.**
   `jiraHelpers.fetchAll…WithJQLAndFetchAllChangelogUsingNamedFields(params, progressUpdate)` invokes
   `progressUpdate({ issuesReceived, issuesRequested })` as pages/children stream in. That flows to
   `rawIssuesRequestData` (`state-helpers.js:32,46`) which does `progressData.value = {...received}`,
   then to `derivedIssuesRequestData.progressData` (a `value.with` observable), then to the shell.
   No backend ⇒ no ticks.

There is currently **no seam** to supply a _controlled, still-pending, incrementally-progressing_
response.

### 2a. A secondary, structural gap

The shell reads progress **inline**:

```ts
useRouteData('derivedIssuesRequestData.progressData.value.issuesRequested');
```

The rest of the codebase reads routeData through **dedicated hooks** and tests mock _those_ — e.g.
`IssueSource.test.tsx` mocks `useRawIssueRequestData` and returns canned
`{ issuesPromise, numberOfIssues, receivedChunks, totalChunks }`. The inline read is both **what
broke** (wrong key path) and **what has no mock boundary**.

## 3. The seams available

| Seam                          | Where                                                            | Notes                                                                               |
| ----------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **`jiraHelpers`**             | injected via `routeData.jiraHelpers` (built in `main-helper.js`) | already a DI point; a fake covers `getServerInfo()` + the fetch methods             |
| **`progressUpdate` callback** | passed into the fetch method                                     | the exact lever that drives the counter                                             |
| **`isLoggedIn`**              | `routeData.isLoggedInObservable` (from the `Login` store)        | gates the training-data short-circuit; must be forced `true` to reach the real path |
| **HTTP / the wire**           | request helpers → Jira API / backend proxy                       | interceptable by MSW or Playwright `page.route`                                     |
| **Per-concern hooks**         | e.g. a new `useReportLoadingState()`                             | the missing mock boundary (§2a)                                                     |

## 4. Approaches

Each is scored on: **fidelity** (how much real code runs), **would it have caught the `.value`
bug**, **credential-free**, **setup cost**, **brittleness**, **reusability**, **touches prod code**.

---

### A. Mockable hook + pure view component (unit)

Extract two things from `TimelineReport.tsx`: `useReportLoadingState()` (the promise-subscription +
the `.value` progress reads — the fragile part, isolated) and a pure `ReportArea` presentational
component that takes explicit props (`status`, `issuesReceived`, `issuesRequested`, `count`,
`rejectReason`, children). Unit-test `ReportArea` for every state by passing props; test the shell by
`vi.mock`-ing the hook (the `IssueSource` pattern).

- **Fidelity:** low (renders states from fabricated inputs).
- **Catches the `.value` bug:** ❌ — mocking the hook bypasses the exact line that broke.
- **Credential-free:** ✅ **Setup:** low **Brittleness:** low **Reusability:** medium
- **Touches prod code:** yes, but only a _refactor_ (extract hook/component) — no behavior change.
- **Verdict:** cheap, good regression value for _rendering_ logic (count formatting, which-state-
  when, the growing-total display), and it aligns the shell with the codebase's hook pattern. But it
  does **not** protect the observation path — pair it with B or C.

---

### B. Fake `jiraHelpers` injection (jsdom integration)

In a jsdom/RTL test, set `routeData.isLoggedInObservable = true`, `routeData.jql`, `fields`,
`normalizeOptions`, `licensingPromise`, and `routeData.jiraHelpers = fake`, where `fake` implements
`getServerInfo()` and `fetchAll…(params, progressUpdate)` returning a **deferred** promise and
capturing `progressUpdate`. Render the shell (or `renderHook(useReportLoadingState)`), fire
`progressUpdate({received:3,requested:10})`, assert the UI shows "Loaded 3 of 10", fire
`{received:7,requested:22}` (total grew), assert it updates, then resolve → assert the report renders.

- **Fidelity:** high — drives the **real** `rawIssuesRequestData → derivedIssuesRequestData →
progressData → value.from('…value…') → shell` chain. This is the pipeline that broke.
- **Catches the `.value` bug:** ✅ — it exercises the real key-path observation against real can.js.
- **Credential-free:** ✅ **No production changes:** ✅
- **Setup:** medium-high — you must satisfy routeData's dependency graph (serverInfo, config/
  normalizeOptions, licensing) enough for `derivedIssuesRequestData` to reach "pending". Against a
  global singleton, this needs careful setup/reset between tests.
- **Brittleness:** medium — coupled to routeData's internal prop names, not the wire.
- **Reusability:** medium (a good `makeFakeJiraHelpers()` + `primeRouteData()` helper pays off across
  report tests).
- **Verdict:** the **best fit for this specific bug** — highest fidelity without wire reverse-
  engineering. Main cost is taming the routeData singleton.

---

### C. Mock Service Worker (MSW) — mock at the HTTP layer

MSW intercepts at the network boundary: a request interceptor in Node (vitest/jsdom) and a Service
Worker in the browser (Playwright / Storybook via `msw-storybook-addon`). You write handlers for the
Jira endpoints the app calls and return realistic **paginated** responses (with `total`, `startAt`,
`maxResults`, changelog pages). The app's **real** `jiraHelpers` then computes progress from those
responses exactly as in production, and `progressUpdate` fires naturally as pages arrive.

- **Fidelity:** highest of all — exercises `jiraHelpers`' real pagination + child-discovery +
  progress computation, not just everything downstream of it. Nothing is faked below the wire.
- **Catches the `.value` bug:** ✅ (and also any bug in `jiraHelpers` itself).
- **Credential-free:** ✅ — but see the auth caveat below.
- **Reusability:** ⭐ the biggest win — **the same handlers work in vitest, Playwright, and
  Storybook.** This could make the _entire authenticated app_ runnable in tests/stories without real
  Jira, which is strategically valuable for the whole react-rewrite (many report components consume
  Jira data), far beyond this one indicator.
- **No production changes:** ✅ (handlers live in test/dev code).
- **Costs / cons:**
  - **Must reverse-engineer the wire contract** — exact endpoints (JQL search, changelog,
    pagination params) and response shapes the app depends on. This is real work and drifts if Jira's
    API or our request helpers change. (Mitigated: record real responses once as fixtures.)
  - **Auth gate isn't solved by MSW alone.** `isLoggedIn` comes from the `Login` store (token
    presence), and the hosted app proxies through its own backend (`VITE_AUTH_SERVER_URL`) +
    `api.atlassian.com`. You still must force logged-in state (seed a token / mock the auth store)
    **and** add MSW handlers for the token/refresh endpoints. So MSW is "mock the wire" _plus_ an
    auth bypass — more moving parts than B.
  - **Which layer to intercept?** MSW runs client-side, so it intercepts the browser→backend-proxy
    calls (or browser→Atlassian). Need to confirm which URLs the hosted vs Connect helpers actually
    hit. Getting this wrong means handlers never match and requests fall through.
  - Node interceptor vs Service Worker have separate setup; the browser worker needs a generated
    `mockServiceWorker.js` served by the app.
- **Verdict:** overkill for _only_ the loading counter, but the **highest-leverage strategic
  investment** if we want broad, realistic, reusable coverage of Jira-backed UI across unit + e2e +
  Storybook. Bigger up-front cost, best long-term payoff.

---

### D. Playwright network interception (`page.route`)

Like C but Playwright-native: intercept the app's outgoing requests in a real browser and fulfill
them with canned paginated responses (with artificial delay). No MSW dependency.

- **Fidelity:** very high — real browser, real `jiraHelpers`, real routeData, real rendering.
- **Catches the `.value` bug:** ✅ **Credential-free:** ✅ (still needs the auth-state bypass).
- **Reusability:** low — handlers are Playwright-only (not shared with vitest/Storybook, unlike MSW).
- **Setup:** medium-high — same wire reverse-engineering as MSW, plus faking logged-in state in the
  browser; and it only runs against the built `dist/` (slower loop).
- **Verdict:** great for a true end-to-end guard; if we're going to reverse-engineer the wire anyway,
  MSW (C) gives the same fidelity **plus** cross-tool reuse, so prefer C unless we want zero new deps.

---

### E. "Simulate slow load" dev flag + existing unauth Playwright

Add a dev/test-only affordance (reuse `defineFeatureFlag`) so the `isLoggedIn === false` training
path streams `bitoviTrainingData` behind a deferred promise that fires synthetic `progressUpdate`
ticks. The **existing** unauth Playwright suite then navigates with the flag and watches the real UI:
"Loading …" → growing "Loaded X of Y" → report.

- **Fidelity:** medium-high for the _UI wiring_ (real routeData → real shell in a real browser), but
  the progress numbers are synthetic, not from real pagination.
- **Catches the `.value` bug:** ✅ (it drives the real `progressData` observable end-to-end).
- **Credential-free:** ✅ **Reuses the existing harness:** ✅ (lowest incremental test cost).
- **Cons:** **adds a test hook to production request code** — a code path that only exists for tests
  is a smell, must be dead in prod builds, and risks drift/accidental activation.
- **Verdict:** cheapest path to a _real-browser_ guard for this exact indicator, at the cost of a
  permanent seam in production code. Good tactically; less clean than B/C strategically.

---

### F. Default-prop dependency injection (inject the dep, default = real)

Not a separate fidelity tier — a **delivery mechanism** for A and B that fits this team's preferred
style and avoids `vi.mock`. Import the real implementation as the default value of a prop/parameter;
callers (tests) override it. Apply at two levels:

**F1 — inject the hook into the shell** (upgrades Approach A):

```tsx
import { useReportLoadingState as defaultUseReportLoadingState } from './hooks/useReportLoadingState';

export function TimelineReport({
  useReportLoadingState = defaultUseReportLoadingState,
  ...props
}: TimelineReportProps) {
  const { status, issuesReceived, issuesRequested, rejectReason } = useReportLoadingState(); // called UNCONDITIONALLY
}
```

Tests render `<TimelineReport useReportLoadingState={() => ({ status: 'pending', issuesReceived: 7, issuesRequested: 22 })} />`
and assert "Loaded 7 of 22". No `vi.mock`, no routeData.

**F2 — inject the data source into the hook** (lightens Approach B — this is the one that catches the
`.value` bug):

```tsx
import routeData from '../../canjs/routing/route-data';

export function useReportLoadingState(rd = routeData) {
  const issuesRequested = useCanObservable(
    value.from(rd, 'derivedIssuesRequestData.progressData.value.issuesRequested'),
  );
  // …promise subscription off value.from(rd, 'derivedIssuesRequestData.issuesPromise')
}
```

A `renderHook` test passes a **hand-built fake store** — a small `ObservableObject` whose
`derivedIssuesRequestData` is `{ issuesPromise: <deferred>, progressData: value.with({...}) }` — fires
progress ticks, and asserts the counts climb, then resolves. It runs the **real `value.from('…value…')`
observation** against controlled data **without** driving the real fetch/serverInfo/config pipeline.

- **Fidelity:** F1 low (rendering only); F2 high for the observation path specifically.
- **Catches the `.value` bug:** F1 ❌, **F2 ✅**.
- **Credential-free:** ✅ **Setup:** low (esp. F2 vs. full B) **Reusability:** high **Prod change:** refactor only (add a defaulted prop/param).
- **Caveat (rules of hooks):** put the default on the prop and call the hook **unconditionally** in the
  body. Never `= useReportLoadingState()` in a default parameter slot — that conditionally invokes a
  hook. The injected fake must itself be hook-consistent (a plain `() => ({...})` is fine). Keep the
  injected function identity stable across a component instance's renders.
- **Strategic bonus:** injecting `routeData` with a default (rather than importing the singleton) is
  the same decoupling the **route-data keystone migration** needs — components stop depending on the
  global store directly. This pattern pays off twice: testability now, migration later.
- **Verdict:** the **preferred delivery mechanism** for A and B here. F1 replaces A's `vi.mock`; F2 is
  a lighter, equally-effective form of B for guarding the observation path.

## 5. Comparison

| Approach                      | Fidelity             | Catches `.value` bug | Cred-free | Setup    | Reusable across tools | Prod-code change    |
| ----------------------------- | -------------------- | -------------------- | --------- | -------- | --------------------- | ------------------- |
| A. Hook + pure view (unit)    | Low                  | ❌                   | ✅        | Low      | Medium                | Refactor only       |
| B. Fake `jiraHelpers` (jsdom) | High                 | ✅                   | ✅        | Med-High | Medium                | None                |
| C. **MSW (wire)**             | **Highest**          | ✅                   | ✅\*      | High     | ⭐ High (unit+e2e+SB) | None                |
| D. Playwright `page.route`    | Very high            | ✅                   | ✅\*      | Med-High | Low                   | None                |
| E. Simulate-slow-load flag    | Med-High             | ✅                   | ✅        | Low      | Low                   | **Yes (test hook)** |
| **F. Default-prop DI**        | F1 Low / **F2 High** | F1 ❌ / **F2 ✅**    | ✅        | **Low**  | High                  | Refactor only       |

\* still requires forcing logged-in state to pass the `isLoggedIn` gate.

**F is a delivery mechanism, not a rival tier:** F1 = how to do A cleanly (no `vi.mock`); F2 = a lighter
form of B. It's the team's preferred injection style and doubles as route-data-migration groundwork.

## 6. Recommendation (layered)

> **Status (2026-07-18): step 1 below is implemented.** `useReportLoadingState(rd = routeData)` +
> pure `ReportArea` extracted; `TimelineReport` takes `useReportLoadingState` as a defaulted prop.
> Tests: `components/ReportArea.test.tsx` (F1 — all view states incl. growing counts) and
> `hooks/useReportLoadingState.test.tsx` (F2 — fake store drives the real `.value` path; would have
> caught the bug). MSW (step 2) not yet done.

1. **Do now — A + B, delivered via F (default-prop injection).** Extract `useReportLoadingState()`
   (accepting `rd = routeData` as a defaulted param) and a pure `ReportArea`. Then:
   - **F1:** give `TimelineReport` a `useReportLoadingState = defaultUseReportLoadingState` prop and
     unit-test every view state incl. the growing total by injecting a fake (no `vi.mock`).
   - **F2:** `renderHook(useReportLoadingState)` with a hand-built fake `rd` store; fire progress ticks
     and assert the counts climb, then resolve. This runs the **real observation path** and guards the
     `.value` bug — the lightweight form of B.
     Keep `progress-path.test.ts` as the low-level `value.from`/`value.with` mechanic guard.
     All credential-free, no production behavior change (only a defaulted prop/param).
2. **Invest next — C (MSW), if we want broad Jira-backed coverage.** Stand up MSW handlers (recorded
   from real responses) shared across vitest + Playwright + Storybook, plus a small logged-in-state
   test utility. This unlocks realistic testing/stories for _all_ report components, not just the
   loading indicator — the strategic win for the rest of the react-rewrite. (F and C compose: F
   isolates/injects; C provides realistic data underneath.)
3. **Skip E** unless we specifically want a real-browser guard cheaply and accept a permanent
   test-only branch in production request code. Prefer D over E only if we reject a new dependency,
   but D duplicates C's wire work without C's reuse.

> **Bonus alignment:** F2's `rd = routeData` default is the same decoupling the **route-data keystone
> migration** requires (components stop importing the singleton). Adopting F now is testability +
> migration groundwork in one move.

## 7. What would actually have caught _this_ bug

Only approaches that exercise the real `value.from('…progressData.value.…')` read against real data:
**B, C, D, and E**. Approach **A alone would not** (mocking the hook skips the broken line). That's
the crux: the fix must be guarded by a test that runs the real observation path, not a fabricated
stand-in for it.

## Appendix — key references

- Progress skip on unauth: `src/stateful-data/jira-data-requests.js:95` (`getRawIssues`),
  `getServerInfo` at `:37`.
- Progress observable: `src/canjs/controls/timeline-configuration/state-helpers.js:32,46`
  (`progressData = value.with(null)`; `progressData.value = {...received}`), `derivedIssuesRequestData`
  at `:131`.
- routeData resolver: `src/canjs/routing/route-data/route-data.js:390`.
- Shell reads: `src/react/TimelineReport/TimelineReport.tsx` (`useReportLoadingState` candidate) →
  `useRouteData` → `useCanObservable`.
- Existing mockable-hook pattern: `src/react/SettingsSidebar/components/IssueSource/IssueSource.test.tsx`
  (mocks `useRawIssueRequestData`).
- Mechanic guard already added: `src/react/TimelineReport/progress-path.test.ts`.
