# select-cloud → React rewrite plan

**Source:** `src/shared/select-cloud.js` (~100 lines)
**Custom element:** `<select-cloud>`
**Status: LIVE** (hosted web app only) — the Jira site/cloud picker in the header.
**Difficulty: Medium** (blocked on the login/auth bridge + a popover replacement)

## Is it used?

Yes, in the hosted web app:

- Rendered declaratively: `index.html:84` and `dev.html:60` (`<select-cloud></select-cloud>`), both loading `src/web.main.ts` (`host:'hosted'`).
- Wired imperatively in `src/shared/main-helper.js`: `:3` side-effect import; `:94-98` `document.querySelector('select-cloud')` then sets `.loginComponent` and `.jiraHelpers`.
- In the Jira Connect plugin path (`plugin.main.ts`, `host:'jira'`) the tag isn't in the markup, so `querySelector` returns null — **effectively hosted-web-only**. No tests/stories.

## What it does

Header "pill" button showing the current Jira site, with a dropdown to switch sites.

- **Props (injected):** `jiraHelpers`, `loginComponent`.
- **`canQuery`** getter = `jiraHelpers && loginComponent?.isLoggedIn`.
- **`accessibleResources`** getter (Promise) — if logged in, `jiraHelpers.fetchAccessibleResources()` (GET accessible-resources, `src/jira-oidc-helpers/jira.ts:36`), mapping `isCurrent = resource.id === localStorage.getItem('scopeId')`; else `[]`. Derives `currentResource` / `alternateResources`.
- **`showResources()`** — renders the site list into a `SimpleTooltip` positioned below the pill, with global-click dismiss. Each choice does `localStorage.setItem('scopeId', resource.id)` then `window.location.reload()`.
- Reads/writes `localStorage['scopeId']`; emits no events.

## CanJS surface

`StacheElement`, `type.Any`, `stache(...)` (builds the dropdown fragment). Stache `{{#if}}` / `{{#for}}` / `{{#and}}` / `not(...)`, `on:click`, promise auto-unwrapping in the view (`.isPending` / `.value`). Uses `SimpleTooltip` (`src/canjs/ui/simple-tooltip/simple-tooltip.js`, plain HTMLElement) for scroll-aware positioning + outside-click dismiss.

## Replacement plan

1. **New React component** `src/react/shared/SelectCloud/SelectCloud.tsx` (name TBD), mounted into the header slot in `index.html`/`dev.html` (replace the `<select-cloud>` tag with a React mount point, or mount via the React tree once the shell is React).
2. **Data:** replace the three chained promise-computed props with a single `useQuery` (React Query `queryClient` already exists at `src/react/services/query/queryClient`) calling `jiraHelpers.fetchAccessibleResources`; derive `current` / `alternates` with `useMemo`. Gate the query on login state (`enabled: isLoggedIn`).
3. **Login state:** consume the login observable — after the jira-login rewrite this is the auth store via `useCanObservable`; `jiraHelpers` comes from `JiraProvider` (`src/react/services/jira/JiraProvider.tsx`). This is why this component should follow jira-login.
4. **Popover:** replace `SimpleTooltip` with a React popover (an `@atlaskit` popup/popover, already a project dependency) or a small portal + positioning + outside-click `useEffect`.
5. **Switch site:** on select, `localStorage.setItem('scopeId', id)` + `window.location.reload()` (unchanged behavior).
6. Remove the `querySelector`/prop-injection glue in `main-helper.js:94-98` and the side-effect import `:3`; delete `src/shared/select-cloud.js`.

## Reusable React pieces

`fetchAccessibleResources` (`src/jira-oidc-helpers/jira.ts:36`); React Query `queryClient`; `JiraProvider` for `jiraHelpers`; the login auth store + `useCanObservable` (from the jira-login rewrite); `useRecentReports.ts:12` already reads `scopeId` from localStorage (confirms the concept crosses into React). No existing cloud-selection component to reuse — this is a net port.

## Risks / open questions

- **Depends on the login/auth bridge** — build after `jira-login` so `isLoggedIn` has a clean React-readable source. Until then the query gate has no good hook.
- **Imperative mounting:** today props are injected via `querySelector`; the React version needs an explicit header mount point in the HTML entry files.
- Hosted-web-only — verify it stays absent/no-op in the Jira Connect plugin path.
- Custom popover positioning (scroll-aware `belowElementInScrollingContainer`) — confirm the chosen popover lib handles the scrolling-container case, or port the positioning logic.
