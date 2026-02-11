<!--
Sync Impact Report
- Version change: none → 1.0.0 (initial ratification)
- Added principles:
  1. React-First UI Development
  2. Staged Data Pipeline
  3. Dependency Injection via Context
  4. Colocated Testing
  5. Dual-Mode Compatibility
- Added sections:
  - Technology Constraints
  - Development Workflow
  - Governance
- Templates requiring updates:
  - `.specify/templates/plan-template.md` — ✅ no updates needed (generic template, constitution gates filled at plan time)
  - `.specify/templates/spec-template.md` — ✅ no updates needed (generic template)
  - `.specify/templates/tasks-template.md` — ✅ no updates needed (generic template, task types filled at task time)
  - `.specify/templates/commands/` — no command files found; N/A
- Follow-up TODOs: none
-->

# Status Reports for Jira Constitution

## Core Principles

### I. React-First UI Development

All new user-facing components MUST be implemented in React. CanJS UI
components MUST NOT be created. CanJS routing code (`RouteData.js`,
route definitions in `src/canjs/routing/`) MAY still be added or
modified. The bridge between CanJS state and React rendering is the
`useCanObservable` hook — React components receive CanJS observables
as props, read them via the hook, and write back by setting `.value`.

**Rationale**: The codebase is incrementally migrating from CanJS to
React. Allowing new CanJS UI would expand the legacy surface area and
increase long-term migration cost.

### II. Staged Data Pipeline

Jira data MUST flow through the defined pipeline stages in order:
Raw → Normalized → Derived → Rolled Up → Rolled Up + Rolled Back.
Each stage lives in its own `src/jira/{stage}/` directory. Derived
values MUST be computed from a single issue's own data only.
Cross-issue aggregation MUST occur in the Rollup stage. New data
transformations MUST be placed in the correct stage — never skip or
merge stages.

**Rationale**: The pipeline stages enforce separation of concerns:
single-issue logic vs. hierarchy aggregation vs. historical
comparison. Mixing stages creates untestable coupling and makes it
impossible to reuse individual transformations.

### III. Dependency Injection via Context

React services MUST inject dependencies (Jira client, storage,
routing) through React Context providers — never import singletons
directly. Each service domain (`src/react/services/{domain}/`) MUST
follow the established pattern: barrel `index.ts`, key-factory for
React Query cache keys, `{Domain}Provider.tsx` with
`createContext` + `useContext` + null guard, and `use{Feature}.ts`
hooks using `useSuspenseQuery` or `useMutation` from TanStack
React Query.

**Rationale**: Context-based injection enables isolated unit testing
(swap real Jira client for a mock via provider), prevents hidden
global state, and keeps the two deployment modes (web vs. plugin)
interchangeable at the composition root.

### IV. Colocated Testing

Unit tests MUST be colocated with their source files using
`*.test.ts` / `*.test.tsx` naming. Pure logic tests MUST use inline
data objects — no shared fixture files for unit tests. Component
tests MUST mock hooks at the module level with `vi.mock()` and wrap
renders in the standard provider stack (`Suspense` → `FlagsProvider`
→ `StorageProvider` → `QueryClientProvider`). E2E tests (Playwright)
live in `playwright/` with `authenticated/` and `unauthenticated/`
subdirectories using `.spec.ts` naming and the custom base fixture.

**Rationale**: Colocation keeps tests discoverable and maintains a
1:1 relationship with source. Inline data avoids brittle shared
fixtures. The standard provider wrapper ensures components are tested
in the same context they run in production.

### V. Dual-Mode Compatibility

Every feature MUST work in both deployment modes: standalone Web
(OAuth) and Jira Connect Plugin (iframe). Mode-specific behavior
MUST be abstracted behind the shared interfaces established in
`mainHelper()` — routing, storage, and request helpers. New code
MUST NOT import mode-specific modules directly; it MUST consume the
abstractions provided by context providers or the `mainHelper`
configuration object.

**Rationale**: The app ships as both a standalone web app and a Jira
Connect plugin. Hard-coding assumptions about one mode breaks the
other and doubles QA effort.

## Technology Constraints

- **UI framework**: React 18 with Atlaskit (`@atlaskit/*`) for design
  system components and Tailwind CSS for layout/utility styling
- **State management**: TanStack React Query for async server state;
  CanJS observables (via `useCanObservable`) for legacy global state
- **TypeScript**: strict mode with `noImplicitAny` and
  `strictNullChecks` enabled — all new code MUST be TypeScript
- **Build**: Vite with dual configs (`vite.config.ts` for web,
  `vite.dev.config.ts` for plugin)
- **Testing**: Vitest (unit, jsdom) + Playwright (E2E)
- **Code style**: Prettier (single quotes, 120 print width, 2-space
  indent, LF line endings) enforced via Husky + lint-staged pre-commit

## Development Workflow

- Run `npm run dev` to start all three processes (Tailwind watch,
  Vite dev server on port 5173, Express auth server on port 3000)
- Run `npm run test` for unit tests; `npm run test:e2e` for E2E
  (requires `JIRA_TEST_USERNAME`, `JIRA_TEST_PASSWORD`,
  `JIRA_TOTP_SECRET` environment variables)
- Run `npm run typecheck` before committing to catch type errors
- Feature flags for new reports are defined in
  `src/configuration/reports.ts`; runtime dev flags use
  `src/shared/feature-flag.js` (localStorage, toggled via browser
  console)
- Prettier runs automatically on staged files at pre-commit via
  Husky + lint-staged

## Governance

This constitution supersedes ad-hoc conventions and MUST be
consulted when making architectural decisions. Amendments require:

1. A description of the change and its rationale
2. An update to this file with version bump
3. Propagation of any affected guidance to
   `.github/copilot-instructions.md` and dependent templates

Versioning follows semantic versioning:

- **MAJOR**: Principle removed, redefined, or made incompatible
- **MINOR**: New principle or section added, or material expansion
- **PATCH**: Clarifications, wording, or non-semantic refinements

Compliance: All code reviews SHOULD verify adherence to these
principles. Violations MUST be justified in the PR description.

**Version**: 1.0.0 | **Ratified**: 2026-02-10 | **Last Amended**: 2026-02-10
