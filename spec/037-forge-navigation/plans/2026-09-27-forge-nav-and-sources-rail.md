# Forge Nav Sidebar + Sources Rail (A3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the app's six settings panels into Jira's own Forge sidebar as sub-pages, so the app never renders a second permanent rail — with Sources and Timing opening as a transient rail over the live report, and Teams/Features/Theme/Storage replacing it as full pages.

**Architecture:** `jira:globalPage` gains a `sections` block declaring seven sub-page routes. Forge only gives us routes; it has no opinion about what a route renders, so the app maps the container's pathname onto the existing `showSettings` CanJS observable and decides per-route whether to render a rail over the report (report settings) or a page instead of it (global settings). The existing `view.createHistory()` mirror in `src/routing/index.forge.ts` is extended from search-only to search-plus-pathname, in both directions. Nothing about Connect or the standalone web app changes.

**Tech Stack:** Forge (`jira:globalPage`, `@forge/bridge` `view.createHistory`), Vite, React 18, CanJS observables (`RouteData`), TanStack React Query, Atlaskit, Tailwind, Vitest.

**Design source:** [spec/037-forge-navigation/README.md](../README.md) and [mockups/forge-navigation.html](../mockups/forge-navigation.html) §2b and §3 (A3).

## Global Constraints

- **Branch from `origin/feature/forge`, not `main`.** The Forge app only exists there. `main` has no `manifest.yml`, no `@forge/*` dependencies, and no `src/forge.main.ts`.
- **Forge-only.** Connect (`src/plugin.main.ts`) and web (`src/web.main.ts`) keep today's in-app `SettingsSidebar` unchanged. Every behavioural switch in this plan is gated on `host === 'forge'`.
- **Never deploy to production during this work.** `forge deploy` with no `-e` targets PRODUCTION. Always use `-e prodcheck`. See the warning in `manifest.yml` above `app.id`.
- **Do not touch `app.connect.key: bitovi.status-report`.** It is what grants access to existing customers' saved reports. If any `forge` command offers to delete it, answer **N**.
- **Do not touch `app.licensing.enabled: true`.** Removing it ships licensing disabled, which already happened once to production major version 3.
- **Module keys `main` and `project` must not be renamed.** Forge's Connect URL forwarding matches on `{addonKey}__{moduleKey}`; renaming breaks every bookmark customers hold.
- **Adding manifest `scopes` or `content.styles` entries is a MAJOR version.** This plan adds neither. If a task appears to need one, stop and escalate.
- **No new dependencies.** `@forge/bridge` is already present on the branch.
- Prettier: single quotes, 120 print width, 2-space indent.
- TypeScript strict: `noImplicitAny`, `strictNullChecks`.
- Unit tests colocated as `*.test.ts` and run with `npm run test`.

## File Structure

| File                                                                     | Responsibility                                                                                                                                                                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `manifest.yml`                                                           | **Modify.** Add `sections` to the `jira:globalPage` module.                                                                                                                                                  |
| `src/routing/forge-settings-routes.ts`                                   | **Create.** Pure, dependency-free bidirectional map between a Forge sub-page pathname and a `showSettings` value, plus the report-scoped/global-scoped classification. The only file that knows route slugs. |
| `src/routing/forge-settings-routes.test.ts`                              | **Create.** Unit tests for the above.                                                                                                                                                                        |
| `src/routing/index.forge.ts`                                             | **Modify.** Extend the history mirror: subscribe to container pathname changes (container → app) and echo pathname as well as search (app → container).                                                      |
| `src/routing/index.forge.test.ts`                                        | **Modify.** Add coverage for the new pathname behaviour.                                                                                                                                                     |
| `src/react/hooks/useSettingsScope/useSettingsScope.ts`                   | **Create.** Reads `showSettings` and the host, returns how the current panel should be presented (`'none' \| 'rail' \| 'page'`). Single place the render split is decided.                                   |
| `src/react/hooks/useSettingsScope/useSettingsScope.test.tsx`             | **Create.** Unit tests for the above.                                                                                                                                                                        |
| `src/react/SettingsSidebar/SettingsSidebar.tsx`                          | **Modify.** Suppress the `ReportSettings` button menu on Forge (Jira's nav replaces it).                                                                                                                     |
| `src/react/TimelineReport/TimelineReport.tsx`                            | **Modify.** Render global-settings panels as a page instead of the report; keep report-settings panels as a rail beside it.                                                                                  |
| `src/react/SettingsSidebar/components/HelpAndSupport/HelpAndSupport.tsx` | **Create.** The footer links as a real page, for the `help` route.                                                                                                                                           |
| `src/css/status-reports.css`                                             | **Modify.** Seam styling so the rail reads as continuous with Jira's nav.                                                                                                                                    |
| `spec/037-forge-navigation/spike-findings.md`                            | **Create** (Task 1). The recorded answers that gate everything after it.                                                                                                                                     |

---

## Task 1: Spike — prove the platform behaves as the design assumes

**This task gates every task after it.** The design in §7 of the mockup rests on four unverified assumptions. Two of them can kill A3 outright. Do not start Task 2 until this task's findings are written down and reviewed.

**Files:**

- Modify: `manifest.yml`
- Modify: `src/forge.main.ts` (temporary instrumentation, reverted in Step 8)
- Create: `spec/037-forge-navigation/spike-findings.md`

**Interfaces:**

- Consumes: nothing.
- Produces: `spec/037-forge-navigation/spike-findings.md`, containing a **yes/no** for each of Q1–Q5 below. Task 3 depends on Q1/Q2/Q3; Task 5 depends on Q5.

- [ ] **Step 1: Create the working branch**

```bash
git fetch origin
git checkout -b feat/037-forge-nav origin/feature/forge
npm ci
```

- [ ] **Step 2: Add `sections` to the global page**

In `manifest.yml`, under `modules.jira:globalPage`, the entry keyed `main` currently reads:

```yaml
jira:globalPage:
  - key: main
    resource: main
    title: Status Reports for Jira
    layout: blank
```

Add a `sections` block so it reads:

```yaml
jira:globalPage:
  - key: main
    resource: main
    title: Status Reports for Jira
    layout: blank
    sections:
      - header: Report settings
        pages:
          - title: Sources
            route: sources
          - title: Timing
            route: timing
      - header: Global settings
        pages:
          - title: Teams
            route: teams
          - title: Features
            route: features
          - title: Theme
            route: theme
          - title: Storage
            route: storage
      - header: Help
        pages:
          - title: Guides & support
            route: help
```

Leave `jira:projectPage` untouched — `sections` is not part of this plan's scope for the project page.

Note: `icon` is omitted deliberately. Forge falls back to a generic app icon, which is fine for a spike; icons are added in Task 8.

- [ ] **Step 3: Instrument the bootstrap**

In `src/forge.main.ts`, add this block immediately after the existing `import` statements:

```ts
// TEMPORARY spike instrumentation — spec/037-forge-navigation Task 1. Removed in Step 8.
declare global {
  interface Window {
    __spikeMounts?: number;
  }
}
window.__spikeMounts = (window.__spikeMounts ?? 0) + 1;
console.log('[spike] module evaluated, mount count =', window.__spikeMounts);
```

Then inside `main()`, immediately after `const routing = await getRouting();`, add:

```ts
// TEMPORARY spike instrumentation — spec/037-forge-navigation Task 1. Removed in Step 8.
try {
  const spikeHistory = await view.createHistory();
  console.log('[spike] boot location', JSON.stringify(spikeHistory.location));
  await spikeHistory.listen((location, action) => {
    console.log('[spike] listen fired', action, JSON.stringify(location), 'mounts =', window.__spikeMounts);
  });
} catch (err) {
  console.error('[spike] could not attach listener', err);
}
```

`window.__spikeMounts` lives on `window` rather than in module scope on purpose: if Forge tears down the whole iframe, `window` is replaced and the counter resets to 1, which is exactly the signal we are looking for. A module-scope `let` would reset on a module re-evaluation too, but would not distinguish an iframe reload from a bundle re-import.

- [ ] **Step 4: Run against real Jira**

Two terminals:

```bash
# terminal 1
npm run dev:forge
```

```bash
# terminal 2
forge deploy -e prodcheck
forge install --upgrade -e prodcheck   # only if the sections block is a new module shape
forge tunnel -e prodcheck
```

Open the app in Jira from **Apps → Status Reports for Jira**. Open the browser devtools console.

- [ ] **Step 5: Answer Q1–Q5 and record the raw console output**

Work through these in order, copying the actual console lines into the findings doc as you go.

**Q1 — Does a sidebar click remount the app?**
Click `Timing`, then `Teams`, then back to the parent `Status Reports`.

- PASS: `[spike] module evaluated, mount count = 1` appears **once**, and `[spike] listen fired` appears on each click.
- FAIL: the mount-count line reprints (with `= 1` again, since `window` was replaced) on each click.

**Q2 — Does the query string survive navigation?**
From the report, configure a JQL so the URL carries real state. Confirm `[spike] boot location` showed a non-empty `search`. Now click `Teams`, then click the parent `Status Reports`.

- PASS: each `[spike] listen fired` line carries the same non-empty `search`.
- FAIL: `search` is `""` after the first navigation. **This is the dangerous one** — it is silent data loss, not slowness. If it fails, Task 3 must stash the search string in memory and re-apply it, and that becomes a new sub-task.

**Q3 — What exactly is in `location.pathname`?**
Read the `pathname` logged for each sub-page.

- Record the literal strings. The docs say paths are "relative to your app's URL", so `/timing` is expected — but record what actually appears. Task 2's parser is written to tolerate either form, and this answer confirms which one it is dealing with.

**Q4 — Is the parent nav item independently clickable?**
Look at the rendered sidebar.

- Record whether `Status Reports` is a link with a separate chevron (like Jira's Spaces nav), or whether clicking it only expands/collapses.
- If it is expand-only, Task 2 and Task 8 must add a `Report` sub-page back and accept the redundancy. Record this explicitly.

**Q5 — Does `layout: blank` still render the sidebar?**

- PASS: the sub-pages appear in Jira's left rail.
- FAIL: no sidebar appears. Retry once with `layout: native` and record whether that fixes it and what chrome `native` adds around the iframe. Task 5's seam work depends on which layout is in play.

- [ ] **Step 6: Write the findings document**

Create `spec/037-forge-navigation/spike-findings.md`:

```markdown
# 037 — Forge sidebar spike findings

Run against `-e prodcheck` on <SITE>, <DATE>, by <NAME>.
Manifest at the time: `layout: <blank|native>`, `sections` with 7 routes.

| #   | Question                                 | Answer           | Evidence               |
| --- | ---------------------------------------- | ---------------- | ---------------------- |
| Q1  | Sidebar click remounts the app?          | <NO / YES>       | <pasted console lines> |
| Q2  | Query string survives navigation?        | <YES / NO>       | <pasted console lines> |
| Q3  | Literal `location.pathname` per route    | <e.g. `/timing`> | <pasted console lines> |
| Q4  | Parent nav item independently clickable? | <YES / NO>       | <observation>          |
| Q5  | Sidebar renders with `layout: blank`?    | <YES / NO>       | <observation>          |

## Verdict

<One of:>
- **A3 is viable as designed.** Proceed to Task 2.
- **A3 is viable with the following adjustment:** <describe>
- **A3 is not viable** because <reason>. Fall back to A1 (right drawer, in-app
  trigger) per mockup §3 — its trigger is not a route change, so it is unaffected.
```

- [ ] **Step 7: STOP and review**

Do not proceed to Task 2 until a human has read the findings and confirmed the verdict. If the verdict is "not viable", this plan is abandoned in favour of an A1 plan; do not attempt to salvage individual tasks.

- [ ] **Step 8: Revert the instrumentation, keep the manifest**

Remove both TEMPORARY blocks from `src/forge.main.ts`. Keep the `sections` block in `manifest.yml`.

```bash
git add manifest.yml spec/037-forge-navigation/spike-findings.md
git commit -m "spike: declare Forge sidebar sections and record platform findings"
```

---

## Task 2: Route ↔ panel mapping

A pure module with no imports, so it is fully unit-testable without Forge, Jira, or a browser. Every other task depends on it and nothing else may hard-code a route slug.

**Files:**

- Create: `src/routing/forge-settings-routes.ts`
- Test: `src/routing/forge-settings-routes.test.ts`

**Interfaces:**

- Consumes: `spec/037-forge-navigation/spike-findings.md` Q3 (confirms which pathname form is real) and Q4 (whether a `Report` route is needed).
- Produces:

  - `type SettingsValue = '' | 'SOURCES' | 'TIMING' | 'TEAMS' | 'FEATURES' | 'THEME' | 'STORAGE' | 'HELP'`
  - `type SettingsScope = 'none' | 'rail' | 'page'`
  - `settingsFromPathname(pathname: string): SettingsValue`
  - `pathnameForSettings(settings: string): string`
  - `scopeForSettings(settings: string): SettingsScope`

- [ ] **Step 1: Write the failing tests**

Create `src/routing/forge-settings-routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { pathnameForSettings, scopeForSettings, settingsFromPathname } from './forge-settings-routes';

describe('settingsFromPathname', () => {
  it('maps each declared route to its showSettings value', () => {
    expect(settingsFromPathname('/sources')).toBe('SOURCES');
    expect(settingsFromPathname('/timing')).toBe('TIMING');
    expect(settingsFromPathname('/teams')).toBe('TEAMS');
    expect(settingsFromPathname('/features')).toBe('FEATURES');
    expect(settingsFromPathname('/theme')).toBe('THEME');
    expect(settingsFromPathname('/storage')).toBe('STORAGE');
    expect(settingsFromPathname('/help')).toBe('HELP');
  });

  it('treats the app root as no panel', () => {
    expect(settingsFromPathname('/')).toBe('');
    expect(settingsFromPathname('')).toBe('');
  });

  // Q3 of the spike: the docs say pathnames are relative to the app URL, but the
  // container has historically handed back absolute ones. Tolerate both rather than
  // betting on it.
  it('reads the last segment, so an absolute container path works too', () => {
    expect(settingsFromPathname('/jira/apps/abc-123/def-456/timing')).toBe('TIMING');
    expect(settingsFromPathname('/jira/apps/abc-123/def-456')).toBe('');
  });

  it('ignores a trailing slash', () => {
    expect(settingsFromPathname('/teams/')).toBe('TEAMS');
  });

  it('is case insensitive', () => {
    expect(settingsFromPathname('/Teams')).toBe('TEAMS');
  });

  it('returns no panel for an unknown segment rather than throwing', () => {
    expect(settingsFromPathname('/not-a-route')).toBe('');
  });
});

describe('pathnameForSettings', () => {
  it('round-trips every value', () => {
    for (const value of ['SOURCES', 'TIMING', 'TEAMS', 'FEATURES', 'THEME', 'STORAGE', 'HELP']) {
      expect(settingsFromPathname(pathnameForSettings(value))).toBe(value);
    }
  });

  it('maps no panel to the app root', () => {
    expect(pathnameForSettings('')).toBe('/');
  });

  // `REPORTS` is the saved-reports browser (TimelineReport sets it), not a settings
  // panel, and has no declared Forge route. It must not move the container pathname.
  it('maps values with no declared route to the app root', () => {
    expect(pathnameForSettings('REPORTS')).toBe('/');
    expect(pathnameForSettings('NONSENSE')).toBe('/');
  });
});

describe('scopeForSettings', () => {
  it('opens report settings as a rail over the live report', () => {
    expect(scopeForSettings('SOURCES')).toBe('rail');
    expect(scopeForSettings('TIMING')).toBe('rail');
  });

  it('opens global settings as a page instead of the report', () => {
    expect(scopeForSettings('TEAMS')).toBe('page');
    expect(scopeForSettings('FEATURES')).toBe('page');
    expect(scopeForSettings('THEME')).toBe('page');
    expect(scopeForSettings('STORAGE')).toBe('page');
    expect(scopeForSettings('HELP')).toBe('page');
  });

  it('shows no panel at the root', () => {
    expect(scopeForSettings('')).toBe('none');
  });

  it('leaves non-settings values alone', () => {
    expect(scopeForSettings('REPORTS')).toBe('none');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/routing/forge-settings-routes.test.ts
```

Expected: FAIL — `Failed to resolve import "./forge-settings-routes"`.

- [ ] **Step 3: Write the implementation**

Create `src/routing/forge-settings-routes.ts`:

```ts
/**
 * The one place that knows Forge sub-page route slugs.
 *
 * `showSettings` (canjs/routing/route-data/route-data.js) is the app's existing panel state and
 * stays the source of truth on every host. On Forge it additionally has to agree with the
 * container's pathname, because that is what Jira highlights in its sidebar. This module is the
 * translation, and it is pure so it can be tested without the bridge.
 *
 * Slugs here must match `manifest.yml` → `jira:globalPage` → `sections` exactly.
 */

export type SettingsValue = '' | 'SOURCES' | 'TIMING' | 'TEAMS' | 'FEATURES' | 'THEME' | 'STORAGE' | 'HELP';

/**
 * How a panel is presented.
 *
 * - `rail` — report settings. Rendered over a live report, which stays mounted behind it. These
 *   are the panels whose whole job is to change what you are looking at, so losing the report to
 *   edit them is the thing spec/037 exists to fix.
 * - `page` — global settings. Rendered instead of the report. You are leaving it.
 */
export type SettingsScope = 'none' | 'rail' | 'page';

const ROUTE_TO_SETTINGS: Record<string, SettingsValue> = {
  sources: 'SOURCES',
  timing: 'TIMING',
  teams: 'TEAMS',
  features: 'FEATURES',
  theme: 'THEME',
  storage: 'STORAGE',
  help: 'HELP',
};

const SETTINGS_TO_ROUTE: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTE_TO_SETTINGS).map(([route, settings]) => [settings, route]),
);

const RAIL_SETTINGS: ReadonlySet<string> = new Set<SettingsValue>(['SOURCES', 'TIMING']);

export const settingsFromPathname = (pathname: string): SettingsValue => {
  // Last segment only. The bridge documents `location.pathname` as relative to the app URL, but
  // reading from the end costs nothing and survives being handed an absolute container path.
  const segment = pathname.split('/').filter(Boolean).pop() ?? '';

  return ROUTE_TO_SETTINGS[segment.toLowerCase()] ?? '';
};

export const pathnameForSettings = (settings: string): string => {
  const route = SETTINGS_TO_ROUTE[settings];

  // Anything without a declared route — notably `REPORTS`, the saved-reports browser — maps to the
  // root. Inventing a pathname for it would make Jira highlight nothing and strand the nav.
  return route ? `/${route}` : '/';
};

export const scopeForSettings = (settings: string): SettingsScope => {
  if (RAIL_SETTINGS.has(settings)) {
    return 'rail';
  }

  return settings in SETTINGS_TO_ROUTE ? 'page' : 'none';
};
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/routing/forge-settings-routes.test.ts
```

Expected: PASS, 12 tests.

- [ ] **Step 5: If spike Q4 said the parent is expand-only, add the Report route**

Only if `spec/037-forge-navigation/spike-findings.md` answered **NO** to Q4. Otherwise skip to Step 6.

Add to `manifest.yml`, as the first section (before `Report settings`):

```yaml
- pages:
    - title: Report
      route: report
```

Add to `ROUTE_TO_SETTINGS` — nothing, deliberately: `report` must map to `''` so it behaves as the root, which the existing `?? ''` fallback already does. Add this test to the describe block for `settingsFromPathname`:

```ts
it('treats the explicit report route as no panel', () => {
  expect(settingsFromPathname('/report')).toBe('');
});
```

Re-run the tests and confirm PASS.

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
npx vitest run src/routing/forge-settings-routes.test.ts
git add src/routing/forge-settings-routes.ts src/routing/forge-settings-routes.test.ts manifest.yml
git commit -m "feat(forge): map sidebar sub-page routes to settings panels"
```

---

## Task 3: Two-way pathname mirror

`src/routing/index.forge.ts` currently mirrors only the **search** string. A3 needs the **pathname** mirrored too: container → app so a sidebar click opens the right panel, and app → container so an in-app panel change highlights the right nav item.

**Files:**

- Modify: `src/routing/index.forge.ts`
- Test: `src/routing/index.forge.test.ts`

**Interfaces:**

- Consumes: `settingsFromPathname`, `pathnameForSettings` from Task 2. Spike Q1/Q2/Q3.
- Produces: `createForgeRouting()` keeps its existing `Promise<RoutingConfiguration>` signature — `{ reconcileRoutingState, syncRouters }` — so `src/forge.main.ts` needs no change. The new behaviour is internal.

- [ ] **Step 1: Read the existing file end to end**

```bash
sed -n '1,200p' src/routing/index.forge.ts
sed -n '1,200p' src/routing/index.forge.test.ts
```

The branch version is authoritative. Note in particular that `syncRouters` patches `history.pushState` and calls `forgeHistory.replace({ pathname: forgeHistory.location.pathname, search: window.location.search })` — it deliberately preserves the container pathname today. That preservation is what this task replaces.

- [ ] **Step 2: Write the failing tests**

Append to `src/routing/index.forge.test.ts`. Match the existing file's mocking style for `@forge/bridge`; if it already defines a `createHistory` mock factory, reuse it rather than redefining one.

```ts
describe('createForgeRouting — pathname mirror', () => {
  it('writes the settings param from the container pathname at boot', async () => {
    const forgeHistory = makeFakeForgeHistory({ pathname: '/timing', search: '?report=abc' });
    mockCreateHistory(forgeHistory);

    const routing = await createForgeRouting();
    routing.reconcileRoutingState();

    expect(window.location.search).toContain('settings=TIMING');
    expect(window.location.search).toContain('report=abc');
  });

  it('leaves the settings param absent when the container is at the root', async () => {
    const forgeHistory = makeFakeForgeHistory({ pathname: '/', search: '?report=abc' });
    mockCreateHistory(forgeHistory);

    const routing = await createForgeRouting();
    routing.reconcileRoutingState();

    expect(window.location.search).not.toContain('settings=');
  });

  it('updates the app URL when the container navigates', async () => {
    const forgeHistory = makeFakeForgeHistory({ pathname: '/', search: '' });
    mockCreateHistory(forgeHistory);

    const routing = await createForgeRouting();
    routing.reconcileRoutingState();
    routing.syncRouters();

    forgeHistory.emit({ pathname: '/teams', search: '' }, 'PUSH');

    expect(window.location.search).toContain('settings=TEAMS');
  });

  // Spike Q2. Even if the container drops the search string on a sidebar click, the app's own
  // state must not be destroyed — the app is the source of truth for everything except which
  // panel is open.
  it('preserves app query state when the container navigates without a search string', async () => {
    const forgeHistory = makeFakeForgeHistory({ pathname: '/', search: '?report=abc&jql=project%3DX' });
    mockCreateHistory(forgeHistory);

    const routing = await createForgeRouting();
    routing.reconcileRoutingState();
    routing.syncRouters();

    forgeHistory.emit({ pathname: '/sources', search: '' }, 'PUSH');

    expect(window.location.search).toContain('report=abc');
    expect(window.location.search).toContain('jql=project%3DX');
    expect(window.location.search).toContain('settings=SOURCES');
  });

  it('echoes the pathname to the container when the app opens a panel', async () => {
    const forgeHistory = makeFakeForgeHistory({ pathname: '/', search: '' });
    mockCreateHistory(forgeHistory);

    const routing = await createForgeRouting();
    routing.syncRouters();

    history.pushState(null, '', '?settings=THEME');

    expect(forgeHistory.replace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/theme', search: '?settings=THEME' }),
    );
  });

  it('does not echo back a container-initiated change', async () => {
    const forgeHistory = makeFakeForgeHistory({ pathname: '/', search: '' });
    mockCreateHistory(forgeHistory);

    const routing = await createForgeRouting();
    routing.reconcileRoutingState();
    routing.syncRouters();

    forgeHistory.replace.mockClear();
    forgeHistory.emit({ pathname: '/teams', search: '' }, 'PUSH');

    // The listener writes the app URL, which trips the patched pushState. Without a guard that
    // would call back into the container and loop.
    expect(forgeHistory.replace).not.toHaveBeenCalled();
  });
});
```

If `makeFakeForgeHistory` and `mockCreateHistory` do not already exist in the file, add them above the new `describe`:

```ts
const makeFakeForgeHistory = (initial: { pathname: string; search: string }) => {
  const listeners: Array<(location: { pathname: string; search: string }, action: string) => void> = [];
  const location = { ...initial };

  return {
    action: 'POP' as const,
    location,
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    listen: vi.fn(async (listener: (typeof listeners)[number]) => {
      listeners.push(listener);
      return () => {};
    }),
    emit(next: { pathname: string; search: string }, action: string) {
      Object.assign(location, next);
      listeners.forEach((listener) => listener(next, action));
    },
  };
};
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npx vitest run src/routing/index.forge.test.ts
```

Expected: the new tests FAIL. The boot test fails because `reconcileRoutingState` currently writes only `search`; the listener tests fail because nothing subscribes.

- [ ] **Step 4: Implement**

In `src/routing/index.forge.ts`, add to the imports:

```ts
import { pathnameForSettings, settingsFromPathname } from './forge-settings-routes';
```

`createForgeRouting` becomes:

```ts
export const createForgeRouting = async (): Promise<RoutingConfiguration> => {
  const forgeHistory: ForgeHistory = await view.createHistory();

  /**
   * Set while the app URL is being rewritten in response to the *container*.
   *
   * The listener writes `window.location`, which trips the `history.pushState` patch below, which
   * would write straight back to the container and loop. Connect never needed this because
   * `AP.history` only ever carried the query string; a Forge sub-page click moves the pathname,
   * so the round trip is now real.
   */
  let applyingContainerChange = false;

  /**
   * Fold the container's pathname into the app's own query string as `settings=…`.
   *
   * The app URL stays the single source of truth for everything else. Only the panel is taken
   * from the container, and only because Jira owns the sidebar highlight.
   */
  const applyPathname = (pathname: string): void => {
    const settings = settingsFromPathname(pathname);
    const params = new URLSearchParams(window.location.search);

    if ((params.get('settings') ?? '') === settings) {
      return;
    }

    if (settings) {
      params.set('settings', settings);
    } else {
      params.delete('settings');
    }

    const query = params.toString();

    applyingContainerChange = true;
    try {
      // `pushState`, not `replaceState`: CanJS's `pushStateObservable` listens for it, and this is
      // a real user navigation. The patch below is what would echo it back, and the guard is what
      // stops that.
      history.pushState(null, '', query ? `?${query}` : window.location.pathname);
    } finally {
      applyingContainerChange = false;
    }
  };

  return {
    reconcileRoutingState: () => {
      const search = forgeHistory.location.search ?? '';
      const pathname = forgeHistory.location.pathname ?? '';

      if (logRouting()) {
        console.log('forge routing info', {
          forgeLocation: forgeHistory.location,
          iframeSearch: window.location.search,
        });
        console.log('status reports routing (replace state with)', search);
      }

      history.replaceState(null, '', search || window.location.pathname);

      // After the search string is in place, so the settings param is merged into the container's
      // params rather than being wiped by them.
      applyPathname(pathname);
    },

    syncRouters: () => {
      const originalPushState = history.pushState;

      history.pushState = function (...args) {
        originalPushState.apply(this, args);

        if (applyingContainerChange) {
          return;
        }

        const settings = new URLSearchParams(window.location.search).get('settings') ?? '';
        const pathname = pathnameForSettings(settings);

        forgeHistory.replace({
          pathname,
          search: window.location.search,
        });
      };

      // Container → app for the rest of the session. Attached after `route.start()` (see the
      // `_onStartComplete` wiring in forge.main.ts) so CanJS is running and will react to the
      // `pushState` that `applyPathname` performs.
      void forgeHistory
        .listen((location) => {
          applyPathname(location.pathname ?? '');
        })
        .catch((err: unknown) => {
          console.error('Could not subscribe to Forge sidebar navigation', err);
        });
    },
  };
};
```

Note the one behavioural change to the existing echo: it no longer writes `forgeHistory.location.pathname` verbatim. The pathname is now derived from the app's `settings` param, which is what makes the nav highlight follow in-app panel changes.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/routing/index.forge.test.ts
npm run typecheck
```

Expected: PASS, including the pre-existing tests in the file. If a pre-existing test asserted that `replace` is called with `forgeHistory.location.pathname`, update it to assert the derived pathname and note why in the test body.

- [ ] **Step 6: Commit**

```bash
git add src/routing/index.forge.ts src/routing/index.forge.test.ts
git commit -m "feat(forge): mirror sidebar pathname to and from the settings param"
```

---

## Task 4: The render-scope hook

One hook, so the rail/page decision is made in exactly one place and both `SettingsSidebar` and `TimelineReport` read the same answer.

**Files:**

- Create: `src/react/hooks/useSettingsScope/useSettingsScope.ts`
- Create: `src/react/hooks/useSettingsScope/index.ts`
- Test: `src/react/hooks/useSettingsScope/useSettingsScope.test.tsx`

**Interfaces:**

- Consumes: `scopeForSettings` from Task 2; the existing `useRouteData` hook at `src/react/hooks/useRouteData/useRouteData.ts`.
- Produces: `useSettingsScope(host: string): { settings: string; scope: SettingsScope; isForgeNav: boolean }`. Task 5 and Task 6 both call it.

- [ ] **Step 1: Read the existing hook conventions**

```bash
sed -n '1,80p' src/react/hooks/useRouteData/useRouteData.ts
ls src/react/hooks/useRouteData/
```

Match the directory-with-barrel-export layout.

- [ ] **Step 2: Write the failing test**

Create `src/react/hooks/useSettingsScope/useSettingsScope.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useSettingsScope } from './useSettingsScope';

const mockShowSettings = vi.fn();

vi.mock('../useRouteData', () => ({
  useRouteData: () => [mockShowSettings(), vi.fn()],
}));

describe('useSettingsScope', () => {
  it('reports a rail for report settings on Forge', () => {
    mockShowSettings.mockReturnValue('SOURCES');

    const { result } = renderHook(() => useSettingsScope('forge'));

    expect(result.current).toEqual({ settings: 'SOURCES', scope: 'rail', isForgeNav: true });
  });

  it('reports a page for global settings on Forge', () => {
    mockShowSettings.mockReturnValue('TEAMS');

    const { result } = renderHook(() => useSettingsScope('forge'));

    expect(result.current).toEqual({ settings: 'TEAMS', scope: 'page', isForgeNav: true });
  });

  // Connect and web keep today's behaviour: one in-app sidebar, every panel rendered in it.
  it('reports a rail for every panel off Forge, so nothing changes for Connect', () => {
    mockShowSettings.mockReturnValue('TEAMS');

    const { result } = renderHook(() => useSettingsScope('jira'));

    expect(result.current).toEqual({ settings: 'TEAMS', scope: 'rail', isForgeNav: false });
  });

  it('reports no panel when none is open', () => {
    mockShowSettings.mockReturnValue('');

    const { result } = renderHook(() => useSettingsScope('forge'));

    expect(result.current).toEqual({ settings: '', scope: 'none', isForgeNav: true });
  });

  it('treats the saved-reports browser as no settings panel', () => {
    mockShowSettings.mockReturnValue('REPORTS');

    const { result } = renderHook(() => useSettingsScope('forge'));

    expect(result.current.scope).toBe('none');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run src/react/hooks/useSettingsScope/useSettingsScope.test.tsx
```

Expected: FAIL — `Failed to resolve import "./useSettingsScope"`.

- [ ] **Step 4: Implement**

Create `src/react/hooks/useSettingsScope/useSettingsScope.ts`:

```ts
import type { SettingsScope } from '../../../routing/forge-settings-routes';

import { scopeForSettings } from '../../../routing/forge-settings-routes';
import { useRouteData } from '../useRouteData';

interface SettingsScopeResult {
  settings: string;
  scope: SettingsScope;
  /** True when Jira's own sidebar is providing navigation, so the app must not render its own. */
  isForgeNav: boolean;
}

/**
 * How the currently open settings panel should be presented.
 *
 * Forge is the only host where a panel can be a full page, because it is the only host where the
 * user can get back without an in-app control — Jira's sidebar is still there. On Connect and the
 * standalone site there is no such sidebar, so every panel stays a rail and this hook returns
 * exactly today's behaviour.
 */
export const useSettingsScope = (host: string): SettingsScopeResult => {
  const [showSettings] = useRouteData<string>('showSettings');
  const settings = showSettings ?? '';
  const isForgeNav = host === 'forge';

  if (!isForgeNav) {
    return { settings, scope: settings ? 'rail' : 'none', isForgeNav };
  }

  return { settings, scope: scopeForSettings(settings), isForgeNav };
};
```

Create `src/react/hooks/useSettingsScope/index.ts`:

```ts
export { useSettingsScope } from './useSettingsScope';
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/react/hooks/useSettingsScope/useSettingsScope.test.tsx
npm run typecheck
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/react/hooks/useSettingsScope
git commit -m "feat: add useSettingsScope hook for the rail/page split"
```

---

## Task 5: Render the split

Wire the hook into the shell. Report settings keep rendering as a rail beside the report; global settings replace the report; the in-app settings menu disappears on Forge because Jira's sidebar now performs that job.

**Files:**

- Modify: `src/react/TimelineReport/TimelineReport.tsx`
- Modify: `src/react/SettingsSidebar/SettingsSidebar.tsx`
- Modify: `src/react/SettingsSidebar/SettingsSidebarWrapper.tsx` (prop pass-through only)

**Interfaces:**

- Consumes: `useSettingsScope` from Task 4.
- Produces: no new exported symbols. `SettingsSidebar` gains an optional prop `host?: string` (default `'jira'`, preserving current behaviour for every existing caller).

- [ ] **Step 1: Read the three files end to end**

```bash
sed -n '1,260p' src/react/TimelineReport/TimelineReport.tsx
sed -n '1,120p' src/react/SettingsSidebar/SettingsSidebar.tsx
sed -n '1,60p' src/react/SettingsSidebar/SettingsSidebarWrapper.tsx
```

The `feature/forge` versions are authoritative — Task 1's branch already differs from `main` here (the forge commit touched `SettingsSidebarWrapper.tsx` and `TimelineReport.tsx`). Find the existing `showingConfiguration && (...)` block and the `id="timeline-configuration"` wrapper; those are the anchors for this task.

- [ ] **Step 2: Thread `host` through to the sidebar**

`mainHelper` already receives `host` and passes `showSidebarBranding` down to `TimelineReport`. Add `host` alongside it.

In `src/shared/main-helper.js`, at the `createElement(TimelineReport, { ... })` call, add `host` to the props object:

```js
createElement(TimelineReport, {
  loginComponent: loginStore,
  storage,
  linkBuilder,
  showSidebarBranding,
  host,
});
```

In `src/react/TimelineReport/TimelineReport.tsx`, add `host?: string` to the component's props interface with a default of `'jira'`, and pass it to `SettingsSidebarWrapper`. In `SettingsSidebarWrapper.tsx`, accept `host?: string` and forward it to `SettingsSidebar`.

- [ ] **Step 3: Suppress the in-app settings menu on Forge**

In `src/react/SettingsSidebar/SettingsSidebar.tsx`, replace the `useRouteData` read of `showSettings` with the new hook and gate the `ReportSettings` branch:

```tsx
const { settings: showSettings, isForgeNav } = useSettingsScope(host ?? 'jira');
```

Then the first conditional changes from:

```tsx
{!showSettings && <ReportSettings showSidebarBranding={showSidebarBranding} ... />}
```

to:

```tsx
{/* On Forge, Jira's own sidebar is this menu — rendering ours too is the double rail
    spec/037 exists to remove. */}
{!showSettings && !isForgeNav && <ReportSettings showSidebarBranding={showSidebarBranding} ... />}
```

Add the `HELP` branch alongside the existing panel branches:

```tsx
{
  showSettings === 'HELP' && (
    <SidebarLayout>
      <HelpAndSupport linkBuilder={linkBuilder} />
    </SidebarLayout>
  );
}
```

`HelpAndSupport` is created in Task 6. Until then this branch renders nothing useful; that is expected and Task 6 closes it.

Also pass `host` down so `SidebarLayout`'s back button can be suppressed on Forge — on Forge, "back" is Jira's sidebar, and an in-app back button would take the user somewhere the nav highlight disagrees with. If `SidebarLayout` has no `host` prop, give it one with the same `'jira'` default and hide `GoBackButton` when `host === 'forge'`.

- [ ] **Step 4: Render global settings as a page**

In `src/react/TimelineReport/TimelineReport.tsx`, read the scope near the top of the component:

```tsx
const { scope: settingsScope } = useSettingsScope(host ?? 'jira');
```

The existing configuration block keeps rendering whenever a panel is open:

```tsx
{showingConfiguration && (
  <div
    id="timeline-configuration"
    className="app-chrome-hidden border-gray-100 border-r border-neutral-301 relative block bg-white shrink-0"
  >
    <SettingsSidebarWrapper ... />
  </div>
)}
```

Wrap the report column so it is not rendered when a global-settings page is open. Find the `<div className="fullish-vh">` that contains `ViewReports`, `SavedReports`, `#report-controls` and `ReportArea`, and render it conditionally:

```tsx
{
  settingsScope !== 'page' && <div className="fullish-vh">{/* ...existing contents unchanged... */}</div>;
}
```

Do not unmount `QueryClientProvider` in the process — the provider instances inside that subtree all take the shared `queryClient` singleton from `src/react/services/query/queryClient.ts`, so the cache survives the subtree being removed and returning to the report does not refetch. Verify this explicitly in Task 7's manual matrix.

When `settingsScope === 'page'`, the configuration block is the only child, so remove `shrink-0` in that case and let it fill:

```tsx
className={`app-chrome-hidden border-gray-100 relative block bg-white ${
  settingsScope === 'page' ? 'flex-1' : 'border-r border-neutral-301 shrink-0'
}`}
```

- [ ] **Step 5: Typecheck and run the full unit suite**

```bash
npm run typecheck
npm run test
```

Expected: PASS. Any existing `SettingsSidebar` or `TimelineReport` test that rendered without a `host` prop must still pass unchanged — that is what the `'jira'` default is for. If one fails, the default is not being applied somewhere; fix the default rather than the test.

- [ ] **Step 6: Commit**

```bash
git add src/react/TimelineReport/TimelineReport.tsx src/react/SettingsSidebar src/shared/main-helper.js
git commit -m "feat(forge): render report settings as a rail and global settings as a page"
```

---

## Task 6: The Help page

The in-app sidebar footer currently holds seven links that get clipped when space runs short (spec/025). On Forge the footer is gone with the menu, so they need a home — and a real page has room for all of them plus descriptions.

**Files:**

- Create: `src/react/SettingsSidebar/components/HelpAndSupport/HelpAndSupport.tsx`
- Create: `src/react/SettingsSidebar/components/HelpAndSupport/index.ts`
- Test: `src/react/SettingsSidebar/components/HelpAndSupport/HelpAndSupport.test.tsx`

**Interfaces:**

- Consumes: the existing bug-report and feature-request modals used by `ReportSettings`; `LinkBuilder` from `src/routing/common.ts`.
- Produces: `HelpAndSupport` default export, rendered by the `HELP` branch added in Task 5 Step 3.

- [ ] **Step 1: Read the current footer**

```bash
sed -n '1,140p' src/react/SettingsSidebar/components/ReportSettings/ReportSettings.tsx
```

Copy the exact seven link URLs and the two modal triggers from there. Do not retype URLs from memory — one of them carries a Marketplace app id.

- [ ] **Step 2: Write the failing test**

Create `src/react/SettingsSidebar/components/HelpAndSupport/HelpAndSupport.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HelpAndSupport from './HelpAndSupport';

describe('HelpAndSupport', () => {
  it('renders every link the sidebar footer used to clip', () => {
    render(<HelpAndSupport />);

    for (const label of [
      'Read the guides',
      'APM Training',
      'Connect with Bitovi',
      'Join the Mailing List',
      'Write a review',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('offers the bug and feature actions', () => {
    render(<HelpAndSupport />);

    expect(screen.getByText('Report a bug')).toBeInTheDocument();
    expect(screen.getByText('Request a feature')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run src/react/SettingsSidebar/components/HelpAndSupport/HelpAndSupport.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `HelpAndSupport.tsx`. Use `Heading` from `@atlaskit/heading` to match `IssueSource`, lay the links out one per row with a short description, and reuse the existing modal components rather than duplicating them. External links must go through the app's `open-external` helper — on Forge, `target="_blank"` silently does nothing because the sandbox has no `allow-popups` (see `src/shared/open-external.ts`), and `interceptExternalLinkClicks()` is already installed by `forge.main.ts`, so a plain `<a href>` is handled correctly. Do not add `target="_blank"`.

Create `index.ts`:

```ts
export { default } from './HelpAndSupport';
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/react/SettingsSidebar/components/HelpAndSupport/HelpAndSupport.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/react/SettingsSidebar/components/HelpAndSupport
git commit -m "feat(forge): add a Help & support page for the sidebar footer links"
```

---

## Task 7: The seam

The risk named in mockup §3: our rail and Jira's rail are in different documents. If the join is visible, the result reads as two competing rails, which is the thing this whole spec removes.

**Files:**

- Modify: `src/css/status-reports.css`
- Modify: `src/react/SettingsSidebar/components/AnimatedSidebar/AnimatedSidebar.tsx` (only if a width change is needed)

**Interfaces:**

- Consumes: spike Q5 (whether `layout: blank` or `layout: native` is in play — `native` adds Jira-rendered chrome above the iframe and changes where the seam falls).
- Produces: no exported symbols.

- [ ] **Step 1: Look at the real seam**

With `npm run dev:forge` and `forge tunnel -e prodcheck` running, open the app and click `Sources`. Screenshot the join between Jira's rail and ours at 100% zoom.

- [ ] **Step 2: Fix what you actually see**

Check each of these against the screenshot and change only what is wrong:

- Our rail must have **no left border**. Jira's rail already draws a right border; two borders make a double line.
- Backgrounds must match. Jira's nav uses the Atlassian `elevation.surface` token. If ours is hard-coded `bg-white` and Jira is in dark theme, it will not match — see `view.theme.enable()` in the bridge docs and check whether `forge.main.ts` already calls it. If it does not, that is a separate finding, not a fix to make here; record it and keep the light-theme case correct.
- Our rail's top edge must align with the first nav item, not with the iframe top.
- The rail must not cast a shadow to the left.

Add the rules under a Forge-scoped selector so Connect and web are untouched:

```css
/* The Forge rail sits directly against Jira's own nav. Anything that draws a line, a shadow, or a
   different background between the two makes it read as a second competing rail — see
   spec/037-forge-navigation. */
.host-forge #timeline-configuration {
  border-left: 0;
  box-shadow: none;
}
```

Apply `host-forge` to the root element in `src/shared/main-helper.js` when `host === 'forge'`:

```js
if (host === 'forge') {
  document.documentElement.classList.add('host-forge');
}
```

- [ ] **Step 3: Rebuild the CSS and re-check**

```bash
npm run build:css:forge
```

Then hard-reload the Jira tab. If the change does not appear, the Vite dev server is serving a stale stylesheet — see `/memories/repo/styling-and-storybook.md`; kill the process on 5173 directly and restart `npm run dev:forge`.

- [ ] **Step 4: Commit**

```bash
git add src/css/status-reports.css src/shared/main-helper.js
git commit -m "fix(forge): make the settings rail sit flush against Jira's nav"
```

---

## Task 8: Icons, and the manual test matrix in real Jira

There is no automated coverage for "does Jira's sidebar do the right thing", so this is the acceptance gate. It runs against `-e prodcheck`, never production.

**Files:**

- Modify: `manifest.yml` (icons)
- Create: `static/nav-icons/*.svg` — or reuse existing assets if `public/images/` already has suitable 16×16 glyphs
- Modify: `spec/037-forge-navigation/spike-findings.md` (append the acceptance results)

**Interfaces:**

- Consumes: everything from Tasks 1–7.
- Produces: a signed-off acceptance record.

- [ ] **Step 1: Add icons to the manifest routes**

Each `pages` entry takes an optional `icon`. Without one, Forge renders a generic app icon for all seven, which makes the list unreadable. Add a distinct icon per route, matching the mockup: search (Sources), calendar (Timing), people (Teams), sparkle (Features), brush (Theme), database (Storage), question mark (Help).

Follow the Atlassian icon guidance recorded in the `global:ui` docs: one icon per destination, never reuse an icon across two items, and avoid glyphs Atlassian reserves for its own nav — in particular do **not** use a clock (Jira's "Recent"), a star (Jira's "Starred"), or a person (Jira's "For you").

- [ ] **Step 2: Deploy to prodcheck**

```bash
npm run build:forge
forge deploy -e prodcheck
forge install --upgrade -e prodcheck
```

Confirm the environment before continuing:

```bash
forge version list -e prodcheck
```

- [ ] **Step 3: Work the matrix**

Record PASS/FAIL for each row. Any FAIL blocks the task.

| #   | Action                                                                  | Expected                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Open the app from Apps → Status Reports for Jira                        | Report renders; sidebar shows three sections and seven items; no second rail inside the iframe                                                                                              |
| 2   | Configure a JQL so the report loads issues                              | Report populates; note the issue count                                                                                                                                                      |
| 3   | Click `Sources`                                                         | Rail opens flush against Jira's nav; **report still visible behind it**; `Sources` highlighted in the nav                                                                                   |
| 4   | Edit the JQL and click Apply                                            | Report updates; rail stays open                                                                                                                                                             |
| 5   | Click `Timing`                                                          | Rail swaps content; report still visible; `Timing` highlighted                                                                                                                              |
| 6   | Click `Teams`                                                           | Report is replaced by the Teams page; `Teams` highlighted                                                                                                                                   |
| 7   | Click the parent `Status Reports`                                       | Report returns **without refetching** — issue count from step 2 reappears immediately, no loading state. This is the single most important row: it is the Q1 assumption holding end to end. |
| 8   | Click `Theme`, change a colour, click parent                            | Change persisted; report returns                                                                                                                                                            |
| 9   | Reload the browser tab while on `/sources`                              | App returns to the report with the Sources rail open and the JQL intact                                                                                                                     |
| 10  | Copy the URL from the address bar, open it in a new tab                 | Same report, same panel                                                                                                                                                                     |
| 11  | Open `Help`                                                             | All seven links present; clicking one opens it in a new browser tab (not a dead click)                                                                                                      |
| 12  | Collapse Jira's own sidebar                                             | App fills the space; no orphaned rail                                                                                                                                                       |
| 13  | Open the app as a **project page** (`jira:projectPage`)                 | Unchanged from before this work — the in-app sidebar still renders there, because `sections` was not added to that module                                                                   |
| 14  | Open the Connect app (`Status Reports for Jira`, the non-Forge install) | Completely unchanged: in-app sidebar with the full settings menu                                                                                                                            |

- [ ] **Step 4: Append the results**

Add an `## Acceptance` section to `spec/037-forge-navigation/spike-findings.md` with the table, the date, the site, and the tester.

- [ ] **Step 5: Commit and open the PR**

```bash
git add manifest.yml static/nav-icons spec/037-forge-navigation/spike-findings.md
git commit -m "feat(forge): add sidebar icons and record acceptance run"
git push -u origin feat/037-forge-nav
```

Open the PR against `feature/forge`, **not** `main`. Link spec/037's README and the mockup.

- [ ] **Step 6: Do not deploy to production**

Production deployment is a separate decision with its own runbook at `spec/021-forge/next-steps/release-runbook.md`. This plan ends at a reviewed PR on `feature/forge`.

---

## Notes for the implementer

**Why `showSettings` stays the source of truth.** It would be tidier to drive the panel purely from the Forge route. It would also mean Connect and web need a second mechanism, every existing `routeData.showSettings = 'X'` call site needs rewriting, and saved report URLs that already carry `?settings=` break. Mapping the route onto the existing observable is one adapter in one file instead.

**Why the loop guard is necessary now and was not before.** Connect's `AP.history` only ever carried a query string, so the app→container echo could never trigger a container→app change. A Forge sub-page click moves the pathname, the listener writes the app URL, the app URL write trips the patched `pushState`, and that writes the container. The `applyingContainerChange` flag breaks the cycle. If you see the nav flickering between two items, this is why.

**What is deliberately not in this plan.** B2's collapsed query-chip row above the controls bar (a good later addition, and it would open the same rail). Recent reports in the nav — impossible, `pages`/`sections` are static manifest declarations and the module that could do it, `global:ui`, is EAP and barred from production. `sections` on `jira:projectPage`. Any Connect or web change.
