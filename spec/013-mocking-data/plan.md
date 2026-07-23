# Mocking Data (Capture → Fixture → Replay) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dev-only pipeline that captures real Jira data into local fixture folders at the app-function seam and replays a chosen fixture instead of calling Jira — even while logged in.

**Architecture:** All Jira reads are funneled through a small set of "source" functions. We consolidate the two reads that currently bypass `jira-data-requests.js` (fields + team data) into that module so there is a single seam. A new dev-only `fixtures` module wraps each source function with two behaviors: (1) **replay** — if `?fixture=<name>` is present, load the assembled result from the dev express server instead of calling Jira (active even when logged in); (2) **capture** — if the `captureFixtures` feature flag is on, POST each assembled result to the express server, which writes it to `.temp/fixtures/<name>/<kind>.json`. Production builds no-op via `import.meta.env.DEV`.

**Tech Stack:** TypeScript/JavaScript, Vite (`import.meta.env.DEV`), Express (`server/server.js`), Vitest (colocated `*.test.ts`), the existing localStorage feature-flag system (`src/shared/feature-flag.js`).

## Global Constraints

- **Dev-only.** Every capture/replay code path must be inert in production. Gate on `import.meta.env.DEV` (client) and refuse to register fixture routes unless `process.env.NODE_ENV !== 'production'` (server). Copy this check verbatim; do not invent alternate env flags.
- **Replay wins over `isLoggedIn`.** In each wrapped source function, the replay check runs _before_ the existing `isLoggedIn` branch, so a fixture replays even while logged in.
- **One file per kind per fixture.** Fixture kinds are exactly: `rawIssues`, `serverInfo`, `issueHierarchy`, `jiraFields`, `teamData`. Use these exact strings everywhere.
- **Fixture root:** `.temp/fixtures/<name>/`. The `.temp/` directory is already gitignored precedent (`temp/` appears in status); confirm `.temp` is gitignored and add it if not.
- **No redaction in v1** (out of scope, confirmed). Do not add sanitization logic.
- **Server base URL** for client POST/GET is the same origin the app already uses for OAuth token exchange (express on port 3000). Reuse the existing helper/constant the app uses to reach the server rather than hardcoding `http://localhost:3000`.

---

## File Structure

- `src/stateful-data/fixtures.ts` — **new.** Dev-only fixture control: read active fixture name from URL, read capture flag, `loadFixture(kind)`, `captureFixture(kind, data)`, `withFixture(kind, produce)` wrapper. All functions no-op/return `null`/`false` outside dev.
- `src/stateful-data/fixtures.test.ts` — **new.** Unit tests for name resolution, dev-gating, and `withFixture` control flow (fetch mocked).
- `src/stateful-data/jira-data-requests.js` — **modify.** Wrap `getRawIssues`, `getServerInfo`, `getSimplifiedIssueHierarchy` with `withFixture`; add new `getJiraFields` and `getAllTeamDataSource` source functions so fields + team data share the seam.
- `src/canjs/routing/route-data/route-data.js` — **modify.** Route `jiraFieldsPromise` (line ~105) and `allTeamDataPromise` (line ~131) through the new source functions.
- `server/fixtures.js` — **new.** Express router: `GET /fixtures`, `GET /fixtures/:name/:kind`, `POST /fixtures/:name/:kind`, reading/writing `.temp/fixtures`.
- `server/server.js` — **modify.** Mount the fixtures router in dev only.
- `src/shared/feature-flag.js` usage — register a `captureFixtures` flag (in the fixtures module).

---

### Task 1: Fixtures control module (dev-gating + name/flag resolution)

**Files:**

- Create: `src/stateful-data/fixtures.ts`
- Test: `src/stateful-data/fixtures.test.ts`

**Interfaces:**

- Consumes: `defineFeatureFlag` from `src/shared/feature-flag.js`; `import.meta.env.DEV`.
- Produces:

  - `type FixtureKind = 'rawIssues' | 'serverInfo' | 'issueHierarchy' | 'jiraFields' | 'teamData'`
  - `getActiveFixtureName(): string | null` — from `?fixture=<name>`, only in dev.
  - `isCapturing(): boolean` — `captureFixtures` flag AND dev.
  - `isReplaying(): boolean` — `getActiveFixtureName() !== null`.

- [ ] **Step 1: Write the failing test**

```ts
// src/stateful-data/fixtures.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// import.meta.env.DEV is true under vitest by default; assert dev-gated behavior.
import { getActiveFixtureName, isReplaying, isCapturing } from './fixtures';

function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
  });
}

describe('fixtures control', () => {
  beforeEach(() => {
    setSearch('');
    localStorage.clear();
  });

  it('returns null fixture name when no param present', () => {
    expect(getActiveFixtureName()).toBeNull();
    expect(isReplaying()).toBe(false);
  });

  it('reads fixture name from the URL', () => {
    setSearch('?fixture=acme-bug');
    expect(getActiveFixtureName()).toBe('acme-bug');
    expect(isReplaying()).toBe(true);
  });

  it('is not capturing until the captureFixtures flag is set', () => {
    expect(isCapturing()).toBe(false);
    localStorage.setItem('captureFixtures', 'ON');
    expect(isCapturing()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stateful-data/fixtures.test.ts`
Expected: FAIL — cannot resolve `./fixtures`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/stateful-data/fixtures.ts
import { defineFeatureFlag } from '../shared/feature-flag';

export type FixtureKind = 'rawIssues' | 'serverInfo' | 'issueHierarchy' | 'jiraFields' | 'teamData';

const isDev = (): boolean => import.meta.env.DEV;

// Dev-only feature flag: when ON, assembled Jira results are POSTed to the dev
// server and written to .temp/fixtures/<name>/. Toggle in the console via
// `window.featureFlags['captureFixtures toggle value']` (see feature-flag.js).
const readCaptureFlag = defineFeatureFlag(
  'captureFixtures',
  'Dev-only: capture assembled Jira results into .temp/fixtures/<name>/ for later replay.',
  undefined,
  'ON',
);

export function getActiveFixtureName(): string | null {
  if (!isDev()) return null;
  const params = new URLSearchParams(window.location.search);
  const name = params.get('fixture');
  return name && name.trim() ? name.trim() : null;
}

export function isReplaying(): boolean {
  return getActiveFixtureName() !== null;
}

export function isCapturing(): boolean {
  return isDev() && !!readCaptureFlag();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stateful-data/fixtures.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stateful-data/fixtures.ts src/stateful-data/fixtures.test.ts
git commit -m "feat(fixtures): dev-only fixture name and capture-flag resolution"
```

---

### Task 2: `loadFixture` / `captureFixture` / `withFixture` transport + wrapper

**Files:**

- Modify: `src/stateful-data/fixtures.ts`
- Test: `src/stateful-data/fixtures.test.ts`

**Interfaces:**

- Consumes: `getActiveFixtureName`, `isCapturing`, `isReplaying`, `FixtureKind` from Task 1; global `fetch`.
- Produces:
  - `loadFixture<T>(kind: FixtureKind): Promise<T>` — GET `/fixtures/<name>/<kind>`; rejects if no active fixture or 404.
  - `captureFixture(kind: FixtureKind, data: unknown): void` — fire-and-forget POST; swallows errors (logs to console).
  - `withFixture<T>(kind: FixtureKind, produce: () => Promise<T> | T): Promise<T> | T` — if `isReplaying()` return `loadFixture(kind)`; otherwise await/resolve `produce()`, and if `isCapturing()` capture the resolved value, then return it.
- The server origin is resolved by `fixtureBaseUrl()`: reuse the same origin the app posts OAuth to. If the codebase has no shared constant, default to `''` (same-origin relative path `/fixtures/...`) since the app is served through the express server in dev.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/stateful-data/fixtures.test.ts
import { loadFixture, captureFixture, withFixture } from './fixtures';

describe('fixtures transport', () => {
  beforeEach(() => {
    setSearch('');
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('withFixture calls produce and does not capture when idle', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const produce = vi.fn().mockResolvedValue({ ok: 1 });
    const result = await withFixture('serverInfo', produce);
    expect(result).toEqual({ ok: 1 });
    expect(produce).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('withFixture captures the resolved value when capturing', async () => {
    localStorage.setItem('captureFixtures', 'ON');
    setSearch('?fixture=demo'); // name needed for the POST target
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    // isReplaying() true here, so use a capture-only assertion: temporarily clear replay.
    setSearch(''); // not replaying
    localStorage.setItem('captureFixtureName', 'demo'); // fallback name for capture-only
    const result = await withFixture('serverInfo', () => Promise.resolve({ ok: 2 }));
    expect(result).toEqual({ ok: 2 });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/fixtures/demo/serverInfo'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('withFixture replays via loadFixture when a fixture is active', async () => {
    setSearch('?fixture=demo');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ replayed: true }), { status: 200 }));
    const produce = vi.fn();
    const result = await withFixture('serverInfo', produce);
    expect(result).toEqual({ replayed: true });
    expect(produce).not.toHaveBeenCalled();
  });
});
```

> Note: the capture-only test above requires a capture-target name even when not replaying. Implement `captureFixtureName()` = `getActiveFixtureName()` ?? `localStorage.getItem('captureFixtureName')` so an author can capture without switching into replay. Reflect this in the implementation below.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/stateful-data/fixtures.test.ts`
Expected: FAIL — `loadFixture`/`captureFixture`/`withFixture` not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// add to src/stateful-data/fixtures.ts

function fixtureBaseUrl(): string {
  // App is served through the express server in dev; use same-origin relative paths.
  return '';
}

function captureFixtureName(): string | null {
  return getActiveFixtureName() ?? (isDev() ? localStorage.getItem('captureFixtureName') : null);
}

export async function loadFixture<T>(kind: FixtureKind): Promise<T> {
  const name = getActiveFixtureName();
  if (!name) throw new Error('loadFixture called with no active fixture');
  const res = await fetch(`${fixtureBaseUrl()}/fixtures/${name}/${kind}`);
  if (!res.ok) throw new Error(`fixture ${name}/${kind} not found (${res.status})`);
  return (await res.json()) as T;
}

export function captureFixture(kind: FixtureKind, data: unknown): void {
  const name = captureFixtureName();
  if (!name) {
    console.warn(`[fixtures] capturing ${kind} but no fixture name set; skipping`);
    return;
  }
  fetch(`${fixtureBaseUrl()}/fixtures/${name}/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch((err) => console.warn(`[fixtures] failed to capture ${kind}`, err));
}

export function withFixture<T>(kind: FixtureKind, produce: () => Promise<T> | T): Promise<T> | T {
  if (isReplaying()) {
    return loadFixture<T>(kind);
  }
  const produced = produce();
  if (!isCapturing()) return produced;
  return Promise.resolve(produced).then((value) => {
    captureFixture(kind, value);
    return value;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/stateful-data/fixtures.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/stateful-data/fixtures.ts src/stateful-data/fixtures.test.ts
git commit -m "feat(fixtures): loadFixture/captureFixture/withFixture transport"
```

---

### Task 3: Express fixtures router (read/write `.temp/fixtures`)

**Files:**

- Create: `server/fixtures.js`
- Modify: `server/server.js:1-25` (imports + mount)
- Verify: manual `curl` (no server test harness exists today).

**Interfaces:**

- Produces: `export function createFixturesRouter()` returning an Express `Router` with:
  - `GET /fixtures` → `{ fixtures: string[] }` (directory names under `.temp/fixtures`).
  - `GET /fixtures/:name/:kind` → the parsed JSON body, or `404`.
  - `POST /fixtures/:name/:kind` → writes `req.body` to `.temp/fixtures/<name>/<kind>.json`, returns `204`.
- Consumes: node `fs/promises`, `path`; mounted by `server.js` only when `process.env.NODE_ENV !== 'production'`.

- [ ] **Step 1: Write the router**

```js
// server/fixtures.js
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';

const FIXTURE_ROOT = path.resolve(process.cwd(), '.temp/fixtures');
const VALID_KINDS = new Set(['rawIssues', 'serverInfo', 'issueHierarchy', 'jiraFields', 'teamData']);

// Reject names/kinds that could escape the fixture root.
function safeSegment(seg) {
  return typeof seg === 'string' && /^[a-zA-Z0-9._-]+$/.test(seg) && !seg.includes('..');
}

export function createFixturesRouter() {
  const router = express.Router();

  router.get('/fixtures', async (_req, res) => {
    try {
      const entries = await fs.readdir(FIXTURE_ROOT, { withFileTypes: true });
      res.json({ fixtures: entries.filter((e) => e.isDirectory()).map((e) => e.name) });
    } catch {
      res.json({ fixtures: [] });
    }
  });

  router.get('/fixtures/:name/:kind', async (req, res) => {
    const { name, kind } = req.params;
    if (!safeSegment(name) || !VALID_KINDS.has(kind)) return res.status(400).end();
    try {
      const file = path.join(FIXTURE_ROOT, name, `${kind}.json`);
      const body = await fs.readFile(file, 'utf8');
      res.type('application/json').send(body);
    } catch {
      res.status(404).end();
    }
  });

  router.post('/fixtures/:name/:kind', async (req, res) => {
    const { name, kind } = req.params;
    if (!safeSegment(name) || !VALID_KINDS.has(kind)) return res.status(400).end();
    const dir = path.join(FIXTURE_ROOT, name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${kind}.json`), JSON.stringify(req.body, null, 2), 'utf8');
    res.status(204).end();
  });

  return router;
}
```

- [ ] **Step 2: Mount it in dev only**

In `server/server.js`, after `app.use(express.urlencoded(...))` (line ~25), add:

```js
import { createFixturesRouter } from './fixtures.js';
// ... (place the import with the other imports at the top)

if (process.env.NODE_ENV !== 'production') {
  app.use(createFixturesRouter());
}
```

Note: `express.json()` is already registered (server.js:24). Raw issue payloads can be large — bump its limit alongside this change: `app.use(express.json({ limit: '50mb' }))`.

- [ ] **Step 3: Verify with curl**

Run:

```bash
npm run dev   # or the server-only script; server listens on :3000
curl -s -X POST localhost:3000/fixtures/demo/serverInfo -H 'Content-Type: application/json' -d '{"baseUrl":"x"}' -w '%{http_code}\n'
curl -s localhost:3000/fixtures/demo/serverInfo
curl -s localhost:3000/fixtures
```

Expected: `204`; then `{"baseUrl":"x"}`; then `{"fixtures":["demo"]}`. Confirm `.temp/fixtures/demo/serverInfo.json` exists.

- [ ] **Step 4: Ensure `.temp` is gitignored**

Run: `git check-ignore .temp/fixtures/demo/serverInfo.json`
Expected: prints the path. If it prints nothing, add `.temp/` to `.gitignore` and commit.

- [ ] **Step 5: Commit**

```bash
git add server/fixtures.js server/server.js .gitignore
git commit -m "feat(server): dev-only fixtures read/write endpoints"
```

---

### Task 4: Consolidate fields + team-data reads into the seam

**Files:**

- Modify: `src/stateful-data/jira-data-requests.js` (add two source functions)
- Modify: `src/canjs/routing/route-data/route-data.js:105-114` (`jiraFieldsPromise`), `:131-133` (`allTeamDataPromise`)

**Interfaces:**

- Produces (in `jira-data-requests.js`):
  - `getJiraFields({ jiraHelpers, isLoggedIn })` → logged in: `jiraHelpers.fetchJiraFields()`; else `bitoviTrainingFields()`.
  - `getAllTeamDataSource({ storage, isLoggedIn }, getAllTeamData)` → passthrough that lets route-data keep owning `getAllTeamData(storage)` while exposing a wrappable seam. (Team data isn't currently `isLoggedIn`-branched; preserve current behavior — just make it wrappable.)
- Consumes: `bitoviTrainingFields` (currently imported in route-data.js:8 — move/duplicate the import into jira-data-requests.js).

- [ ] **Step 1: Add source functions**

In `src/stateful-data/jira-data-requests.js`:

```js
import { bitoviTrainingFields } from '../examples/bitovi-training.js';

export const getJiraFields = makeCacheable(({ jiraHelpers, isLoggedIn }) => {
  if (isLoggedIn) {
    return jiraHelpers.fetchJiraFields();
  } else {
    return bitoviTrainingFields();
  }
});
```

(Team data stays owned by route-data; it will be wrapped in place in Task 5 rather than moved, since it depends on `storage` + `createNormalizeConfiguration` wiring local to route-data. No new export needed for teamData.)

- [ ] **Step 2: Route `jiraFieldsPromise` through it**

In `src/canjs/routing/route-data/route-data.js`, replace the `jiraFieldsPromise` default (lines ~105-114):

```js
    jiraFieldsPromise: {
      get default() {
        return getJiraFields({
          jiraHelpers: this.jiraHelpers,
          isLoggedIn: this.isLoggedInObservable.value,
        });
      },
      enumerable: false,
    },
```

Add `getJiraFields` to the existing import from `jira-data-requests.js` (route-data.js:43).

- [ ] **Step 3: Verify nothing regressed**

Run: `npx vitest run` and `npx tsc --noEmit`
Expected: PASS / no new type errors. Manually load the app logged out; fields still populate (proves `getJiraFields` fallback path works).

- [ ] **Step 4: Commit**

```bash
git add src/stateful-data/jira-data-requests.js src/canjs/routing/route-data/route-data.js
git commit -m "refactor(seam): route jira fields fetch through jira-data-requests"
```

---

### Task 5: Wire capture/replay into all five sources

**Files:**

- Modify: `src/stateful-data/jira-data-requests.js` (`getRawIssues`, `getServerInfo`, `getSimplifiedIssueHierarchy`, `getJiraFields`)
- Modify: `src/canjs/routing/route-data/route-data.js` (`allTeamDataPromise`, line ~131)

**Interfaces:**

- Consumes: `withFixture`, `FixtureKind` from `src/stateful-data/fixtures.ts` (Tasks 1–2).
- Each source now returns `withFixture(kind, () => <existing logic>)`.

- [ ] **Step 1: Wrap the four source functions**

In `src/stateful-data/jira-data-requests.js`, add `import { withFixture } from './fixtures';` and wrap each. Examples:

```js
export const getServerInfo = makeCacheable(({ jiraHelpers, isLoggedIn }) =>
  withFixture('serverInfo', () => {
    if (isLoggedIn) return jiraHelpers.getServerInfo();
    return nativeFetchJSON('./examples/bitovi-training-server-info.json');
  }),
);

export const getSimplifiedIssueHierarchy = makeCacheable(({ jiraHelpers, isLoggedIn }) =>
  withFixture('issueHierarchy', () => {
    if (isLoggedIn) return jiraHelpers.fetchIssueTypes().then(simplifyIssueHierarchy);
    return bitoviTrainingIssueData().then(simplifyIssueHierarchy);
  }),
);

export const getJiraFields = makeCacheable(({ jiraHelpers, isLoggedIn }) =>
  withFixture('jiraFields', () => {
    if (isLoggedIn) return jiraHelpers.fetchJiraFields();
    return bitoviTrainingFields();
  }),
);
```

For `getRawIssues` (a plain function, not `makeCacheable`), wrap the body but preserve the early `return undefined` guards _outside_ `withFixture` when not replaying — during replay we always want the fixture:

```js
export function getRawIssues(opts, { progressUpdate }) {
  const { isLoggedIn, loadChildren, jiraHelpers, jql, fields, childJQL } = opts;
  return withFixture('rawIssues', () => {
    if (isLoggedIn === false) return bitoviTrainingData(new Date());
    if (!fields) return undefined;
    let fieldsToLoad = [...new Set([...fields, ...CORE_FIELDS])];
    if (!jql) return undefined;
    const loadIssues = loadChildren
      ? jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields.bind(jiraHelpers)
      : jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields.bind(jiraHelpers);
    return loadIssues(
      { jql, childJQL: childJQL ? ' and ' + childJQL : '', fields: fieldsToLoad, expand: ['changelog'] },
      progressUpdate,
    );
  });
}
```

> `withFixture` returns a Promise during replay/capture but may return `undefined` synchronously (the guard case) when idle. Callers already treat the result as possibly-undefined/promise (see `state-helpers.js:36` and `route-data.js:268`), so this is compatible. Verify in Step 3.

- [ ] **Step 2: Wrap team data in route-data**

In `src/canjs/routing/route-data/route-data.js`, wrap the `allTeamDataPromise` getter body:

```js
    get allTeamDataPromise() {
      return withFixture('teamData', () => getAllTeamData(this.storage));
    },
```

Add `import { withFixture } from '../../../stateful-data/fixtures';` at the top.

- [ ] **Step 3: Verify idle behavior unchanged**

Run: `npx vitest run` and `npx tsc --noEmit`
Expected: PASS. Manually load the app (no `?fixture`, flag off) logged in and logged out — reports render exactly as before (proves `withFixture` is transparent when idle).

- [ ] **Step 4: Commit**

```bash
git add src/stateful-data/jira-data-requests.js src/canjs/routing/route-data/route-data.js
git commit -m "feat(fixtures): wire capture/replay into all five Jira sources"
```

---

### Task 6: End-to-end capture → replay verification

**Files:** none (manual verification + docs).

- [ ] **Step 1: Capture a real dataset**

While logged in, in the browser console:

```js
localStorage.setItem('captureFixtureName', 'my-first');
window.featureFlags['captureFixtures toggle value']; // turns ON + reloads
```

Load a report that exercises all sources. Confirm `.temp/fixtures/my-first/` contains `rawIssues.json`, `serverInfo.json`, `issueHierarchy.json`, `jiraFields.json`, `teamData.json`.

- [ ] **Step 2: Replay it**

Turn the flag back off (`window.featureFlags['captureFixtures toggle value']`), clear `captureFixtureName`, then open the app with `?fixture=my-first` — still logged in. Confirm via the Network tab that requests hit `/fixtures/my-first/*` and **not** Jira, and the report renders from the fixture.

- [ ] **Step 3: Confirm production is inert**

Run: `npm run build && npx vite preview` (or the production preview script). With a production build, confirm `?fixture=my-first` does nothing (real Jira calls happen) and no `/fixtures` requests fire. Confirm the server, if started with `NODE_ENV=production`, returns `404` for `GET /fixtures`.

- [ ] **Step 4: Document usage**

Append a "How to use" section to `spec/013-mocking-data/summary.md` (or a new `README.md` in that folder): the capture recipe, the replay URL param, and the five fixture kinds. Commit.

```bash
git add spec/013-mocking-data/
git commit -m "docs(fixtures): capture/replay usage instructions"
```

---

## Self-Review

**Spec coverage:**

- Capture scope = **full replay bundle** → all five kinds (Tasks 4–5). ✓
- Capture trigger = **localStorage feature flag** (`captureFixtures`) → Task 1. ✓
- Fixture selection = **URL param `?fixture=<name>`** → Task 1 `getActiveFixtureName`. ✓
- Redaction **out of scope** → no sanitization tasks. ✓
- Replay active **while logged in** → `withFixture` checks `isReplaying()` before `isLoggedIn` (Task 5, Global Constraints). ✓
- Capture writes to **`.temp/fixtures/<name>/`, one file per input** → Task 3. ✓
- Dev-only → `import.meta.env.DEV` (client) + `NODE_ENV` gate (server), verified in Task 6 Step 3. ✓
- Reuses existing express server → Task 3 mounts on `server/server.js`. ✓

**Open decision not blocking implementation:** capture uses a separate `captureFixtureName` localStorage key so authors can capture without switching the app into replay mode; documented in Task 2 and Task 6.

**Type/name consistency:** `FixtureKind` string literals (`rawIssues`/`serverInfo`/`issueHierarchy`/`jiraFields`/`teamData`) match `VALID_KINDS` in `server/fixtures.js` and every `withFixture(kind, …)` call. `getJiraFields` named consistently across Tasks 4–5. ✓
