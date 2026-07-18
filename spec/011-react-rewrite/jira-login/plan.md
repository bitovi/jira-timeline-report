# jira-login → React rewrite plan

**Source:** `src/shared/jira-login.js` (~86 lines); related dead model `src/stateful-data/login.js`
**Custom element:** `<jira-login>`
**Status: LIVE and load-bearing** — drives global login state + gates app bootstrap.
**Difficulty: Medium** (the UI is trivial; the coupling is the work)

## Is it used?

Yes, critically. The `<jira-login>` _tag_ is never used declaratively — the component is instantiated **imperatively** in `src/shared/main-helper.js`:

- `:69` `const loginComponent = new JiraLogin().initialize({ jiraHelpers, ...props })`
- `:70` **the key wire:** `routeData.isLoggedInObservable = value.from(loginComponent, 'isLoggedIn')`
- `:96` `selectCloud.loginComponent = loginComponent`
- `:100-134` bootstrap gate: listens for the component's `isResolved` event; the entire `TimelineReport` is only inserted **after login resolves**
- `:117` passed into `new TimelineReport().initialize(...)`
- `:134` `login.appendChild(loginComponent)` → rendered into `<div id="login">`

No tests or stories.

## What it does

One button in three states — "Connecting" (`isPending`), "Log Out" (`isLoggedIn`), "Connect to Jira" (not logged in).

- **Props:** `jiraHelpers`, `isLoggedIn`, `isResolved`, `isPending` (all observable booleans; `isLoggedIn`/`isResolved` are what the app binds to).
- **`login()`** → `jiraHelpers.getAccessToken()` then set logged-in.
- **`logout()`** → `jiraHelpers.clearAuthFromLocalStorage()` then clear flags.
- **`connected()`** → auto-login: if token present & valid → log in; if present & stale → refresh; else mark resolved/not-logged-in.
- Emits no explicit events — consumers rely on CanJS auto-firing change events on the observable props.

`src/stateful-data/login.js` is a **dead** `ObservableObject` duplicate of this state machine (zero imports; has a latent `type.Any`-without-import bug). It is a ready-made blueprint for extracting the auth logic out of the view.

## The hard part: `isLoggedIn` fan-out + bootstrap gate

`isLoggedIn` is consumed as a **CanObservable** by ~9 downstream places. A rewrite must preserve an observable/`value`-compatible interface, not just React state, or all of these break:

- `route-data.js:107,137,273,284` (real fields vs sample data, hierarchy, whether real issues are fetched, serverInfo) + prop def `:95-98`
- `timeline-report.js:90,169` (stache view gating), `:366,378` (React `SampleDataNotice` / `SavedReports` observables), `:368` (`onLoginClicked` → `loginComponent.login()`), `:393` (boolean snapshot to `SettingsSidebar`)
- `select-cloud.js:35,37` (`canQuery` gate) — see `../select-cloud/plan.md`
- `stateful-data/jira-data-requests.js` + `timeline-configuration/state-helpers.js` (resolved value)

And bootstrap (`main-helper.js:100-134`) awaits the component instance's `isResolved` **event** to decide when to mount the app — a React button inside the React tree cannot easily be the thing bootstrap awaits.

## Replacement plan (recommended: extract an observable auth store, thin React view)

1. **Create an observable auth store** outside React — promote/fix the dead `stateful-data/login.js` `Login extends ObservableObject` (add the missing `type` import) to be the single source of truth. Move `login()` / `logout()` / auto-login (`connected` logic) into it.
2. **Keep the observable contract:** point `routeData.isLoggedInObservable = value.from(loginStore, 'isLoggedIn')` at the store instead of the component (`main-helper.js:70`). All ~9 CanObservable consumers stay untouched.
3. **Keep the bootstrap gate** awaiting `loginStore` `isResolved` rather than a component instance (`main-helper.js:100-134`). ⚠️ **Resolution race — must handle:** today the gate is safe by accident. `main-helper.js:133` attaches the `isResolved` listener _before_ `:134` appends the element, so the StacheElement's `connected()` auto-login (which can set `isResolved=true` synchronously for a valid token) fires _after_ the listener exists. The dead `login.js` blueprint runs that same logic in its **constructor** — i.e. at `:69` (`new Login()`), _before_ the listener is attached at `:133`. A plain `.on()` only delivers _future_ changes, so for the valid-token path the resolution fires into the void, the gate never runs, and **the app never mounts.** **Fix (decided — Q2/a): the store exposes a `resolved` promise** (resolves once auto-login settles; already-resolved if construction settled synchronously) and `main-helper` `await`s it instead of subscribing to a change event. Immune to ordering. Add a regression test (see Testing §A).
4. **Preserve the `isAlwaysLoggedIn` seed path** (`main-helper.js:63-67`) — the store must accept an `{ isLoggedIn: true }` seed so its constructor/auto-login short-circuits (matches the current `if (this.isLoggedIn)` branch). Matters for the Connect (`jira`) host.
5. **Build a thin React `<LoginButton>`** that reads the store via `useCanObservable` and calls `loginStore.login()` / `logout()` + `jiraHelpers`. Mount it into `<div id="login">` (or into the React tree once the shell is React). It owns no auth state — just renders the three button states. **Preserve the exact button labels/testids** — `Connecting`/`Log Out`/`Connect to Jira` and `connecting-button`/`logout-button`/`login-button` — the e2e auth setup depends on them (see Testing §C).
6. Delete `src/shared/jira-login.js` once `main-helper.js` and the button read the store. Preserve the quirk that `logout()` sets `isResolved=false` (don't "fix" it — it's an intentional-looking behavior consumers may depend on).

This confines the actual rewrite to the button UI and leaves the observable fan-out + bootstrap intact.

## Testing

The current component has **no tests or stories** — but the whole point of extracting the store is that it becomes cleanly testable. The store's only dependency is `jiraHelpers` (4 methods: `getAccessToken`, `hasAccessToken`, `hasValidAccessToken`, `clearAuthFromLocalStorage`), all trivially mockable. Tooling already present: vitest + jsdom, `@testing-library/react` + `user-event`, Playwright (with a real-OAuth `auth.setup.ts`), Storybook.

**§A — Unit-test the store** (`login.test.js`, vitest, no DOM — the big payoff). Mock `jiraHelpers`; assert the state-machine matrix:

- auto-login: no token → `{ isResolved: true, isLoggedIn: false, isPending: false }`
- auto-login: valid token → `{ isLoggedIn: true, isResolved: true }` (synchronous)
- auto-login: stale token (`hasAccessToken` true, `hasValidAccessToken` false) → calls `getAccessToken`, then logged in / resolved
- `login()`: `isPending` true immediately → after `getAccessToken` resolves → `isLoggedIn`/`isResolved` true, `isPending` false
- `logout()`: calls `clearAuthFromLocalStorage`, sets `isLoggedIn` false **and `isResolved` false** (preserve the quirk)
- `isAlwaysLoggedIn` seed short-circuits auto-login
- **Observable contract:** `value.from(store, 'isLoggedIn').on(cb)` (and `store.on('isLoggedIn', cb)`) fires on change — this is the contract the ~9 consumers depend on; assert it directly.
- **Resolution-race regression:** a store that resolves synchronously in its constructor still notifies a gate that subscribes _after_ construction (guards the bug called out in Replacement step 3).

**§B — Component-test `<LoginButton>`** (`LoginButton.test.tsx`, vitest + testing-library). Copy the pattern in `src/react/SampleDataNotice/SampleDataNotice.test.tsx` — it already renders a component against a hand-rolled fake observable (`{ value, getData, on, off, set, get }`). Assert: the three states render by `data-testid` (`connecting-button` / `logout-button` / `login-button`); clicking calls `store.login()` / `store.logout()`.

**§C — E2e is the regression guardrail (already exists, don't break it).** `playwright/auth.setup.ts` clicks `getByRole('button', { name: 'Connect to Jira' })`, runs real OAuth, and asserts `getByRole('button', { name: 'Log Out' })` becomes visible; the authenticated suite (`playwright/authenticated/*.spec.ts`) depends on that stored session. No new e2e is required, but the React button **must keep the exact accessible names and testids** or the whole authenticated suite fails at setup. Run `npm run test:e2e` before/after as the before-and-after check.

**§D — Storybook story** (`LoginButton.stories.tsx`). Three stories (Connecting / Logged Out / Logged In) driven by a fake store, so the button can be verified visually (Playwright screenshot against `localhost:6006`). The repo leans on Storybook heavily and this component has none today.

## Reusable React pieces

`useCanObservable`; `jiraHelpers` already provided to React via `src/react/services/jira/JiraProvider.tsx`; `SampleDataNotice.tsx` already renders a "Connect to Jira" trigger + reads the login observable — pattern to follow. `stateful-data/login.js` as the store blueprint.

## Decisions & constraints (resolved)

- **[RESOLVED 2026-07-17] Keep auth state in a CanJS observable store.** During migration login state must feed both remaining StacheElements (`select-cloud`, `timeline-report` view) and React. Keep `value`/observable as the contract until route-data itself is migrated — do **not** move auth state into React-only state this phase.
- **[RESOLVED — Q1/a] Store location:** promote `src/stateful-data/login.js` in place (fix the missing `type` import); do not create a new `src/state/` dir.
- **[RESOLVED — Q2/a] Resolution race:** store exposes a `resolved` promise the bootstrap gate `await`s (see Replacement step 3).
- **[RESOLVED — Q3/a] `SettingsSidebar` snapshot deferred:** leave `timeline-report.js:393` passing a plain boolean this phase; it's a pre-existing bug. **Follow-up:** file a ticket to pass the login observable so the sidebar reacts to login/logout.
- **[RESOLVED — Q4] Test scope:** §A (store unit) + §B (`LoginButton` component) + §C (run existing e2e) required to merge; §D (Storybook story) nice-to-have.
- **[CONSTRAINT] Order:** do this **before** `select-cloud` (its `canQuery` depends on the login state source).

## Questions

> Justin to answer inline on each `**Answer:**` line. This file is the source of truth — an agent picking up the work should not start until these are answered.

### Q1 — Where should the extracted observable auth store live?

- **(a)** Promote `src/stateful-data/login.js` in place (fix the missing `type` import).
- **(b)** New module `src/state/login-store.js` — fresh file, delete the dead `src/stateful-data/login.js`.
- **(c)** Under `src/react/services/auth/` — co-located with `JiraProvider` and other React services.

**Suggestion:** (a) — the dead blueprint already lives in `src/stateful-data/`, alongside `jira-data-requests.js` (both are observable app-state modules), so promoting it in place adds zero new surface. `src/state/` doesn't exist and would be a confusing near-synonym of `stateful-data/`; `react/services/` overstates the React coupling while this stays a CanJS observable. (Minor downside of (a): `stateful-data/` then holds both a request module and the auth store — already true today.)

**Answer:** A

### Q2 — How should the bootstrap gate handle the resolution race? (see Replacement step 3)

- **(a)** Store exposes a `resolved` promise; `main-helper` awaits it.
- **(b)** Gate reads `store.isResolved` synchronously first, only `.on()`-subscribes if not-yet-resolved.

**Suggestion:** (a) — the promise is immune to ordering, gives a clean contract, and is the easiest to unit-test. (b) leaves fragile ordering logic in `main-helper`.

**Answer:** A

### Q3 — Fix the `SettingsSidebar` static-boolean snapshot now? (`timeline-report.js:393`)

Today `isLoggedIn` is passed as a plain boolean, so the sidebar won't react to later login/logout.

- **(a)** Defer — preserve current (pre-existing) behavior, note for a later ticket.
- **(b)** Fix now — pass the observable so the sidebar reacts.

**Suggestion:** (a) — keep this phase's diff focused on the extraction; the snapshot bug predates this work and widening into `SettingsSidebar` grows the blast radius. Capture it as a follow-up.

**Answer:** A

### Q4 — Which testing layers are required to merge this phase?

- **§A** store unit tests · **§B** `LoginButton` component tests · **§C** run existing e2e guardrail · **§D** Storybook story

**Suggestion:** §A + §B + §C required (A is the core payoff, C is free regression coverage); §D nice-to-have.

**Answer:** §A + §B + §C required; §D nice-to-have.
