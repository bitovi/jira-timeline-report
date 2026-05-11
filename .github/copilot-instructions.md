# Copilot Instructions — Status Reports for Jira

## Architecture Overview

This is a **hybrid CanJS/React** Jira reporting app with two deployment modes:

- **Web** (standalone OAuth app) — entry: `src/web.main.ts` → `index.html`
- **Plugin** (Jira Connect iframe) — entry: `src/plugin.main.ts` → `dev.html`

Both call a shared `mainHelper()` in `src/shared/main-helper.js` that bootstraps routing, auth, storage, and mounts the app. The mode determines which routing (`src/routing/index.web.ts` vs `index.plugin.ts`), storage (`src/jira/storage/storage-hosted.ts` vs `storage-connect.ts`), and request helpers are used.

**CanJS owns**: routing (`src/canjs/routing/RouteData.js`), global observable state, and the main `<timeline-report>` custom element (`src/timeline-report.js`). **React owns**: all new UI — sidebar controls, saved reports, and newer report types. The bridge is the `useCanObservable` hook (`src/react/hooks/useCanObservable/`) which subscribes React components to CanJS observables.

**Migration rule**: Never create new CanJS UI components. All new UI must be React. CanJS routing code (`RouteData.js`, route definitions) can still be added or modified.

## Jira Data Pipeline

Data flows through `src/jira/` in stages — understand this before touching data logic:

1. **Raw** (`raw/`) — direct Jira API responses, types in `shared/types.ts`
2. **Normalized** (`normalized/`) — `normalizeIssue()` flattens raw data using configurable field extractors (overridable per-team)
3. **Derived** (`derived/`) — `deriveIssue()` computes values from a single issue's own data: timing calculations, work status categories, sprint data
4. **Rolled Up** (`rolledup/`) — child→parent aggregation: dates, status, completion %, warnings, blocking
5. **Rolled Up + Rolled Back** (`rolledup-and-rolledback/`) — final stage combining current and historical data

Key types: `NormalizedIssue`, `DerivedIssue` (in `src/jira/derived/derive.ts`), `RollupResponse`.

## React Service Layer Pattern

Services in `src/react/services/{domain}/` follow this structure:

```
{domain}/
  ├── index.ts              // barrel export
  ├── key-factory.ts        // React Query cache key factory
  ├── {Domain}Provider.tsx  // React Context provider (createContext + useContext + throw if null)
  └── use{Feature}.ts       // TanStack React Query hooks (useSuspenseQuery/useMutation)
```

Examples: `src/react/services/jira/`, `services/storage/`, `services/features/`. Always use `useSuspenseQuery` for critical data. Inject dependencies (jira client, storage) via Context providers, never import singletons directly.

## React Component Conventions

- Use **Atlaskit** (`@atlaskit/*`) for UI components alongside **Tailwind CSS** for layout/utility styling
- Report components receive **CanJS observables as props**, read them with `useCanObservable()`, and write back by setting `.value` directly
- Wrap new React components in `<Suspense>` + `<ErrorBoundary>` when mounting from CanJS (see `timeline-report.js`)
- Component directories use PascalCase matching the component name, with `index.ts` barrel exports
- Custom Tailwind colors (e.g., `neutral-40`, `bitovi-red`) and fonts (`poppinsBold`) are defined in `tailwind.config.js`

## Configuration & Feature Flags

- Reports are defined in `src/configuration/reports.ts` — each has a `featureFlag` string
- Features list is built in `src/configuration/features.ts` combining reports + standalone features
- Runtime dev flags use `src/shared/feature-flag.js` — localStorage-based, toggled via browser console (e.g., `window.featureFlags`)
- Storage of user features/saved reports differs by mode: web uses a Jira issue's description field; plugin uses Atlassian Connect app properties API

## Development Commands

```sh
npm run dev           # Concurrent: Tailwind watch + Vite dev server (5173) + Express auth server (3000)
npm run test          # Vitest unit tests (excludes playwright/)
npm run test:watch    # Vitest in watch mode
npm run test:e2e      # Playwright E2E tests (requires JIRA_TEST_USERNAME, JIRA_TEST_PASSWORD, JIRA_TOTP_SECRET)
npm run test:e2e:watch # Playwright UI mode
npm run typecheck     # TypeScript type checking (tsc)
npm run build         # Full production build: Tailwind + Vite (web) + Tailwind + Vite (plugin)
```

## Testing Conventions

**Unit tests (Vitest)**: Colocated with source files (`*.test.ts`/`*.test.tsx`). Pure logic tests use inline data objects. Component tests mock hooks at module level with `vi.mock()` and wrap renders in providers:

```tsx
render(
  <Suspense fallback="loading">
    <FlagsProvider>
      <StorageProvider storage={mockStorage}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <Component />
        </QueryClientProvider>
      </StorageProvider>
    </FlagsProvider>
  </Suspense>,
);
```

**E2E tests (Playwright)**: In `playwright/` with `authenticated/` and `unauthenticated/` subdirectories. Use `.spec.ts` naming. The custom base fixture (`playwright/base.ts`) captures console logs and asserts no page errors by default. Prefer `getByRole`/`getByText` selectors and web-first assertions.

## Code Style

- **Prettier**: single quotes, 120 print width (`.prettierrc`)
- **TypeScript**: strict mode, `noImplicitAny`, `strictNullChecks`
- **Husky + lint-staged**: Prettier runs on all staged files pre-commit
- Indent: 2 spaces, LF line endings

## UI Layout → Code Map

| UI Region                                                        | Code Location                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Configuration sidebar** (left: Sources, Timing, Teams, Theme)  | `src/react/SettingsSidebar/`                                     |
| **Controls bar** (Report on, Report type, Compare to)            | `src/react/ReportControls/`                                      |
| **Saved Reports** (top-right dropdown)                           | `src/react/SaveReports/`, `src/react/ViewReports/`               |
| **Reports** (main content area: Gantt chart, scatter plot, etc.) | React: `src/react/reports/` — Legacy CanJS: `src/canjs/reports/` |
| **Report footer** (status legend)                                | `src/react/ReportFooter/`                                        |
| **Web app controls** (top bar: cloud selector, login/logout)     | `src/shared/select-cloud.js`, `src/shared/jira-login.js`         |

## Key Files to Understand

| File                             | Purpose                                                                |
| -------------------------------- | ---------------------------------------------------------------------- |
| `src/shared/main-helper.js`      | Shared bootstrap — best entry point to understand the whole app        |
| `src/timeline-report.js`         | CanJS↔React bridge — mounts all React components into the CanJS shell |
| `src/canjs/routing/RouteData.js` | Single source of truth for app state (URL-synced observables)          |
| `src/jira-oidc-helpers/index.ts` | Jira API client factory — composes all Jira operations                 |
| `src/jira/derived/derive.ts`     | Core data derivation logic (timing, status, sprints)                   |
| `src/configuration/reports.ts`   | Report definitions and feature flag mappings                           |
