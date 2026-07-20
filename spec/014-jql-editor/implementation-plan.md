# 014 — JQL editor with autocomplete

Replace the plain multi-line JQL `@atlaskit/textarea` in the **Issue Source** panel with
Atlassian's official **`@atlaskit/jql-editor`** — the same JQL editor Jira Cloud uses in its
own advanced search. This adds syntax highlighting, an autocomplete dropdown (fields →
operators → real field values, fetched live from Jira), and inline validation, while keeping
the existing "edit locally → click **Apply**" flow unchanged.

**Scope: Main JQL only.** The child-JQL `Textfield` (`LoadChildren`) stays a plain input for
now (follow-up).

## Context

Today the JQL input is a bare, unassisted textarea
(`src/react/SettingsSidebar/components/IssueSource/components/JqlTextArea/JqlTextArea.tsx`).
Users get no field/value suggestions and no validation — a typo silently produces a failed
Jira request. Atlassian ships this exact capability as two packages:

- **`@atlaskit/jql-editor`** — the `JQLEditor` React component (highlighting + validation +
  autocomplete UI). Required props: `query`, `analyticsSource`, `autocompleteProvider`.
- **`@atlaskit/jql-editor-autocomplete-rest`** — `useAutocompleteProvider(analyticsSource,
getInitialData, getSuggestions)`, a hook that builds an `AutocompleteProvider` from two
  fetchers the consumer supplies. Those fetchers hit Jira's autocomplete REST endpoints:
  - `GET /rest/api/3/jql/autocompletedata` → `{ visibleFieldNames, visibleFunctionNames }`
  - `GET /rest/api/3/jql/autocompletedata/suggestions?fieldName=…&fieldValue=…` → `{ results }`

The clean integration point already exists: this app exposes the authenticated Jira client
through a React context. `SettingsSidebarWrapper.tsx:28` wraps the whole sidebar (and thus
`IssueSource`) in `<JiraProvider jira={routeData.jiraHelpers}>`, and any descendant reads it
via `useJira()` (`src/react/services/jira/JiraProvider.tsx`). So the autocomplete fetchers can
run through the app's existing auth with no new plumbing — we just add two methods to the Jira
client and wire a provider hook into `JqlTextArea`.

The Jira client is assembled in `createJiraHelpers` (`src/jira-oidc-helpers/index.ts:53`) from
per-endpoint factory functions in `src/jira-oidc-helpers/jira.ts`, each of the form
`fetchX(config) => (args) => config.requestHelper('/api/3/…')`. `requestHelper` handles the
base URL + OIDC auth; callers pass the app's `/api/3/…` path convention (see
`fetchJiraIssue`, `jira.ts:46`). `Jira` is typed as `ReturnType<typeof createJiraHelpers>`
(`index.ts:51`), so new methods flow into the type automatically.

## Changes

### 1. Add the two packages

```
npm install @atlaskit/jql-editor @atlaskit/jql-editor-autocomplete-rest
```

**Verify at install (don't assume):**

- **React peer.** `@atlaskit/jql-editor` declares `react` peer `^16.8 || ^17 || ~18.2`; this
  repo runs `react@^18.3.1`. This is the **same situation as the 28 `@atlaskit/*` packages
  already installed and working here**, so it should resolve, but confirm `npm install` does
  not `ERESOLVE`. Fallback: add an `overrides` entry pinning `react`/`react-dom` (the repo has
  no `overrides`/`resolutions`/`legacy-peer-deps` today — see `.npmrc`).
- **`.npmrc` `min-release-age=7`** refuses package versions published <7 days ago; if the
  newest version is too fresh, install the latest that has aged past 7 days.
- **Common-package alignment.** `@atlaskit/jql-editor` and
  `@atlaskit/jql-editor-autocomplete-rest` must resolve a compatible
  `@atlaskit/jql-editor-common` — the `AutocompleteProvider` type the hook returns is the same
  type the `JQLEditor` `autocompleteProvider` prop expects. After install, run
  `npm ls @atlaskit/jql-editor-common` and confirm a single deduped version; a mismatch shows
  up as a TS error on the `autocompleteProvider` prop.
- **Bundling.** Vite handles these packages' `.css`/Emotion imports natively (the webpack
  CSS-loader errors seen in Forge threads don't apply here). The editor is ProseMirror-based
  and sizeable — see the async-load recommendation in step 4.

### 2. `src/jira-oidc-helpers/jira.ts` — add two autocomplete fetchers

Add alongside the other factory functions (e.g. after `fetchJiraIssue`, ~line 50). Follow the
existing `/api/3/…` convention so `requestHelper` supplies base URL + auth:

```ts
// JQL autocomplete (powers @atlaskit/jql-editor). Return shapes match the Jira
// /jql/autocompletedata endpoints and the atlaskit autocomplete-rest response types.
export function fetchJqlAutocompleteData(config: Config) {
  // Field + function metadata. The atlaskit hook passes a url, but it carries no params
  // for initial data, so we ignore it and use the app's path convention.
  return (_url: string) => config.requestHelper('/api/3/jql/autocompletedata');
}

export function fetchJqlAutocompleteSuggestions(config: Config) {
  // The hook builds the query string (fieldName / fieldValue / predicateName); preserve it,
  // prepend the app's known-good path.
  return (url: string) => {
    const search = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    return config.requestHelper(`/api/3/jql/autocompletedata/suggestions${search}`);
  };
}
```

**Verify the suggestions query-param contract** against the installed package: confirm the
hook-built URL uses `fieldName`/`fieldValue` (and optionally `predicateName`). If a future
version passes structured args instead of a URL string, adapt the signature — the
`GetAutocompleteSuggestions` type in `@atlaskit/jql-editor-autocomplete-rest` is the source of
truth. Reuse that package's exported `JQLAutocompleteResponse` /
`JQLAutocompleteSuggestionsResponse` types for the return casts if needed.

### 3. `src/jira-oidc-helpers/index.ts` — register the methods

Import both from `./jira` (~line 25 import block) and add to the `jiraHelpers` object next to
`fetchJiraIssue` (~line 91):

```ts
fetchJqlAutocompleteData: fetchJqlAutocompleteData(config),
fetchJqlAutocompleteSuggestions: fetchJqlAutocompleteSuggestions(config),
```

No change needed to the `Jira` type — it's `ReturnType<typeof createJiraHelpers>`.

### 4. New hook — `useJqlAutocompleteProvider`

Create
`src/react/SettingsSidebar/components/IssueSource/hooks/useJqlAutocompleteProvider/useJqlAutocompleteProvider.ts`.
It bridges the Jira context to the atlaskit hook:

```ts
import { useAutocompleteProvider } from '@atlaskit/jql-editor-autocomplete-rest';
import { useJira } from '../../../../../services/jira';

export const useJqlAutocompleteProvider = () => {
  const jira = useJira();
  return useAutocompleteProvider(
    'jira-timeline-report',
    (url) => jira.fetchJqlAutocompleteData(url) as any, // getInitialData
    (url) => jira.fetchJqlAutocompleteSuggestions(url) as any, // getSuggestions
  );
};
```

(Cast to the package's response types instead of `any` once the exact `RequestHelperResponse`
shape vs. the atlaskit response types is confirmed.)

### 5. `JqlTextArea.tsx` — swap `TextArea` → `JQLEditor`

Replace the `@atlaskit/textarea` with the editor, preserving the current props/flow. Keep the
surrounding `flex` layout and the load-progress readout below it.

```tsx
import { JQLEditorAsync as JQLEditor } from '@atlaskit/jql-editor';
import { useJqlAutocompleteProvider } from '../../hooks/useJqlAutocompleteProvider';
// ...
const autocompleteProvider = useJqlAutocompleteProvider();

<JQLEditor
  analyticsSource="jira-timeline-report"
  query={jql}
  autocompleteProvider={autocompleteProvider}
  onUpdate={(query) => setJql(query)} // replaces TextArea onChange
  isSearching={isLoading} // reuse existing loading prop
  // onSearch={(query) => { setJql(query); /* + applyJql, if Enter-to-run is wanted */ }}
/>;
```

Notes / decisions:

- **Use `JQLEditorAsync`** (with `preloadJQLEditor` on sidebar open, optional) to keep the
  ProseMirror editor out of the main bundle.
- **Controlled value / external updates.** The cycle-time slider in
  `ReportControls.tsx` writes `routeData.jql`, which flows back into `jql` via the `useEffect`
  in `useJQL.ts:19`. **Verify the editor re-renders its content when the `query` prop changes**
  (this is the "external update" path). If the installed version treats `query` as
  initial-only, remount the editor with a `key` derived from the external value, or use the
  `inputRef`/hydrate API — decide after confirming behavior.
- **No `placeholder` prop exists** on `JQLEditor`. Move the current example hint
  (`issueType in (Epic, Story) order by Rank`) to a small helper line under the editor or into
  the existing `SectionMessage` copy in `IssueSource.tsx`.
- **Enter behavior (open, low-stakes):** default keeps **Apply** as the commit action. Wiring
  `onSearch` (Enter) to also call `applyJql` matches Jira's own UX and is a one-line add; leave
  it commented until confirmed. `applyJql` lives in `useJQL.ts:23` and reads `jql` state, which
  `onUpdate` keeps current — so no `useJQL` change is required either way.
- Keep the visually-hidden `<Label>` for accessibility (or rely on the editor's own aria and
  drop it — confirm the editor labels itself).

### 6. Theming smoke check

The app never calls `setGlobalTheme` and has no `@atlaskit/app-provider`; it uses
`@atlaskit/tokens` only for icon colors. The editor should render with default light-mode
token fallbacks. **Verify visually** it looks correct inside the sidebar; if tokens render
unstyled, evaluate adding a minimal token/theme setup (out of scope unless it breaks).

### 7. Tests

- The `JQLEditor` is heavy/ProseMirror-based and awkward under jsdom. In any test that mounts
  `IssueSource`/`JqlTextArea`, **mock `@atlaskit/jql-editor`** with a light stub that renders a
  `textarea` calling `onUpdate`, and mock `@atlaskit/jql-editor-autocomplete-rest`'s
  `useAutocompleteProvider` to return a no-op provider — so existing behavior (Apply enabling,
  `setJql`) stays covered without pulling the real editor into jsdom.
- Add a focused unit test for the two new `jira.ts` fetchers: assert
  `fetchJqlAutocompleteData` calls `requestHelper('/api/3/jql/autocompletedata')` and
  `fetchJqlAutocompleteSuggestions` preserves the query string. Mirror the existing
  `jira`-helper test patterns.

## Verification

- `npm install` resolves without `ERESOLVE`; `npm ls @atlaskit/jql-editor-common` shows one
  deduped version.
- `npm run build` (typecheck) passes; the test suite passes.
- **Storybook / credential-free:** the editor renders and highlights/validates JQL with a
  mocked `autocompleteProvider`. Run `npm run build:css` first if any Tailwind classes change
  (app + Storybook load prebuilt `dist/production.css`; `tsc`/`vitest` don't regenerate it).
- **End-to-end (needs Jira creds — use the `launch-dev` agent or ask the user):** open Issue
  Source and confirm, against a real Jira:
  1. Typing shows the **autocomplete dropdown** — field names after a boolean, operators after
     a field, and **real field values** after an operator (e.g. `status = ` lists actual
     statuses; those are the `.../autocompletedata/suggestions` calls succeeding through auth).
  2. An invalid query shows the **inline red validation** message.
  3. **Apply** still loads the report exactly as before, and the load-progress line under the
     editor still updates.
  4. Move the **cycle-time slider** in Report Controls and confirm the editor's visible query
     updates (the external-update path from step 5).

## Out of scope

- The child-JQL input (`LoadChildren`) — remains a plain `Textfield`; convert in a follow-up.
- Rich inline nodes (`enableRichInlineNodes`: value lozenges / user avatars) — nice-to-have,
  enable later once the base editor is verified.
- Any global Atlaskit theming / `AppProvider` work beyond the smoke check in step 6.
