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
3. **Keep the bootstrap gate** awaiting `loginStore` `isResolved` (via `value`/`.on` or a promise) rather than a component instance (`main-helper.js:100-134`).
4. **Build a thin React `<LoginButton>`** that reads the store via `useCanObservable` and calls `loginStore.login()` / `logout()` + `jiraHelpers`. Mount it into `<div id="login">` (or into the React tree once the shell is React). It owns no auth state — just renders the three button states.
5. Delete `src/shared/jira-login.js` once `main-helper.js` and the button read the store.

This confines the actual rewrite to the button UI and leaves the observable fan-out + bootstrap intact.

## Reusable React pieces

`useCanObservable`; `jiraHelpers` already provided to React via `src/react/services/jira/JiraProvider.tsx`; `SampleDataNotice.tsx` already renders a "Connect to Jira" trigger + reads the login observable — pattern to follow. `stateful-data/login.js` as the store blueprint.

## Risks / open questions

- **Cross-framework window:** during migration, login state must feed both remaining StacheElements (`select-cloud`, `timeline-report` view) and React. Keeping state in a CanJS observable store is what makes this safe — decide explicitly to keep `value`/observable as the contract until route-data itself is migrated.
- `timeline-report.js:393` passes `isLoggedIn` as a plain boolean snapshot to `SettingsSidebar` (won't react to later login/logout). Decide whether to fix (pass the observable) during this work.
- Order: do this **before** `select-cloud` (its `canQuery` depends on the login state source).
