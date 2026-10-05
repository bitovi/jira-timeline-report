# Auto-Scheduler Editable Capacity & Tracks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user change a team's capacity and track count directly from the Auto-Scheduler's team header row, see the plan re-solve immediately, and either `Reset` the change or `Commit` it to saved team settings.

**Architecture:** Overrides live in a React context (`CapacityOverridesProvider`) mounted in the app shell. The shell wraps `routeData.normalizeOptions`' `getVelocity` / `getParallelWorkLimit` with the overrides, so the existing normalize → derive → rollup pipeline re-runs and the Monte Carlo restarts on its own. Nothing is written to storage until `Commit`, which reuses the sidebar's `useSaveTeamData` mutation. Overrides are session state — never the URL, never a saved report.

**Tech Stack:** React 18 + TypeScript, `@atlaskit/inline-edit`, `@atlaskit/textfield`, TanStack Query, Tailwind, CanJS observables (`routeData`), Vitest + Testing Library, Storybook.

**Spec:** [../README.md](../README.md) · **Mockup:** [../mockups/capacity-controls.html](../mockups/capacity-controls.html) (open in a browser before starting)

## Global Constraints

- **New UI must be React.** Never add a CanJS UI component (`.github/copilot-instructions.md`).
- **Prettier:** single quotes, 120 print width, 2-space indent. Run `npx prettier --write <paths>` before every commit.
- **TypeScript strict**, `noImplicitAny`, `strictNullChecks`. `npm run typecheck` must pass.
- **Node:** `export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"` before npm/npx in a fresh shell.
- **Tests are colocated** `*.test.ts` / `*.test.tsx`. Run a single file with `npx vitest run <path>`.
- **Storybook titles** follow `reports/AutoScheduler/<ComponentName>`.
- **Component dirs are PascalCase** with an `index.ts` barrel.
- **Never put overrides in the URL.** `AutoScheduler.tsx` has a ref-equality guard on `primaryIssuesOrReleases` that swallows URL-triggered re-emits; overrides must travel through `normalizeOptions` so the issue objects genuinely change.
- **Copy is fixed.** Labels are exactly `Capacity`, `pts / sprint`, `Points / Day`, `Total Working Days`, `Reset`, `Commit`, and `N track` / `N tracks`.

---

## Background the implementer needs

### The capacity model

`src/jira/normalized/normalize.ts:66-68` derives everything from three stored fields:

```
totalPointsPerDay    = velocityPerSprint / daysPerSprint
pointsPerDayPerTrack = totalPointsPerDay / tracks
```

and `src/jira/derived/work-timing/work-timing.ts:88` turns that into duration:

```
storyPointsDaysOfWork = issuePoints / pointsPerDayPerTrack
```

**Adding a track does not add capacity.** `totalPointsPerDay` is untouched by `tracks`. Two tracks means each _estimated_ epic takes twice as long and two run side by side. The tooltip in Task 5 must say this.

Unestimated epics are the exception, and the tooltip must not overstate it: `getDefaultStoryPointsDefault` is `velocity / tracks`, so `defaultPoints / pointsPerDayPerTrack = (velocity / tracks) / (velocity / daysPerSprint / tracks) = daysPerSprint`. The `tracks` cancel — changing tracks moves the synthetic point estimate but leaves an unestimated epic's duration at one sprint.

### Where the stored values come from

The sidebar's Teams panel writes `velocityPerSprint`, `tracks`, `sprintLength` into `AllTeamData`. `createNormalizeConfiguration` (`src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/shared/normalize.ts:60-72`) turns those into `getVelocity` / `getParallelWorkLimit` functions. `TimelineReport.tsx:137-158` receives the result and sets `rd.normalizeOptions`, which re-runs the whole pipeline.

This plan overrides those two functions rather than rebuilding `AllTeamData` — the override is a wrapper, not a new mechanism.

### Hierarchy level decision

Team config is keyed `allData[teamKey][hierarchyLevel]`, and `'defaults'` is a valid key. **Commit writes to the team's `defaults`**, because the header row shows one capacity for the whole team and `applyInheritance` propagates `defaults` down to every level. If this turns out to be wrong, the only line to change is the `hierarchyLevel: 'defaults'` argument in Task 6.

> **Superseded during implementation.** Always writing `defaults` would silently strand a team that had set a level-specific capacity: the commit would land on `defaults` and be shadowed by the level value, so the plan would appear not to change. `useTeamCommit` instead targets **per field**: the scheduled hierarchy level when the team's own saved data already defines that field there, `defaults` otherwise (including when the value is inherited from `__GLOBAL__`). The two fields may target different levels, so a commit may touch both. Task 6's steps below still read `defaults`-only.

---

## File structure

| File                                                                                               | Responsibility                                                          |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/react/services/capacity-overrides/types.ts`                                                   | `TeamCapacityOverride`, `CapacityOverrides` types                       |
| `src/react/services/capacity-overrides/applyCapacityOverrides.ts`                                  | Pure wrapper over a `NormalizeIssueConfig`                              |
| `src/react/services/capacity-overrides/applyCapacityOverrides.test.ts`                             | Unit tests for the wrapper                                              |
| `src/react/services/capacity-overrides/CapacityOverridesProvider.tsx`                              | Context + `useCapacityOverrides()`                                      |
| `src/react/services/capacity-overrides/CapacityOverridesProvider.test.tsx`                         | Provider behaviour tests                                                |
| `src/react/services/capacity-overrides/index.ts`                                                   | Barrel                                                                  |
| `src/react/TimelineReport/TimelineReport.tsx`                                                      | Mount provider; apply overrides to `rd.normalizeOptions`                |
| `src/react/reports/AutoScheduler/components/TeamCapacityControls/CapacityField.tsx`                | Atlaskit InlineEdit capacity field                                      |
| `src/react/reports/AutoScheduler/components/TeamCapacityControls/TrackStepper.tsx`                 | `− n +` stepper                                                         |
| `src/react/reports/AutoScheduler/components/TeamCapacityControls/TeamCapacityControls.tsx`         | Composes field + stepper + Reset/Commit                                 |
| `src/react/reports/AutoScheduler/components/TeamCapacityControls/useTeamCommit.ts`                 | Commit-to-settings hook                                                 |
| `src/react/reports/AutoScheduler/components/TeamCapacityControls/*.test.tsx`                       | Component tests                                                         |
| `src/react/reports/AutoScheduler/components/TeamCapacityControls/TeamCapacityControls.stories.tsx` | Storybook states                                                        |
| `src/react/reports/AutoScheduler/components/TeamCapacityControls/index.ts`                         | Barrel                                                                  |
| `src/react/reports/AutoScheduler/AutoScheduler.tsx`                                                | Header row split into input/output groups; wrapper gets StorageProvider |

---

### Task 1: The override wrapper (pure)

**Files:**

- Create: `src/react/services/capacity-overrides/types.ts`
- Create: `src/react/services/capacity-overrides/applyCapacityOverrides.ts`
- Test: `src/react/services/capacity-overrides/applyCapacityOverrides.test.ts`

**Interfaces:**

- Consumes: `NormalizeIssueConfig` from `src/jira/normalized/normalize.ts`
- Produces:

  - `type TeamCapacityOverride = { velocityPerSprint?: number; tracks?: number }`
  - `type CapacityOverrides = Record<string, TeamCapacityOverride>`
  - `applyCapacityOverrides(base: Partial<NormalizeIssueConfig>, overrides: CapacityOverrides): Partial<NormalizeIssueConfig>`

- [ ] **Step 1: Write the failing test**

Create `src/react/services/capacity-overrides/applyCapacityOverrides.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { applyCapacityOverrides } from './applyCapacityOverrides';

// `normalize.ts` calls these with (issue, configWithDefaults); only `getTeamKey` is read here.
const config = { getTeamKey: (issue: any) => issue.teamKey } as any;
const issue = (teamKey: string) => ({ teamKey }) as any;

const base = {
  getVelocity: () => 21,
  getParallelWorkLimit: () => 1,
  getDaysPerSprint: () => 10,
} as any;

describe('applyCapacityOverrides', () => {
  it('returns the base values when there is no override for the team', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: { velocityPerSprint: 35 } });

    expect(wrapped.getVelocity!(issue('STORE'), config)).toBe(21);
    expect(wrapped.getParallelWorkLimit!(issue('STORE'), config)).toBe(1);
  });

  it('overrides velocity for the named team only', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: { velocityPerSprint: 35 } });

    expect(wrapped.getVelocity!(issue('ORDER'), config)).toBe(35);
    expect(wrapped.getParallelWorkLimit!(issue('ORDER'), config)).toBe(1);
  });

  it('overrides tracks independently of velocity', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: { tracks: 3 } });

    expect(wrapped.getVelocity!(issue('ORDER'), config)).toBe(21);
    expect(wrapped.getParallelWorkLimit!(issue('ORDER'), config)).toBe(3);
  });

  it('passes through every other config key untouched', () => {
    const wrapped = applyCapacityOverrides(base, {});

    expect(wrapped.getDaysPerSprint).toBe(base.getDaysPerSprint);
  });

  it('returns the base object itself when there are no overrides at all', () => {
    const wrapped = applyCapacityOverrides(base, {});

    expect(wrapped).toBe(base);
  });

  it('falls back to the base when the team has an override object with no values', () => {
    const wrapped = applyCapacityOverrides(base, { ORDER: {} });

    expect(wrapped.getVelocity!(issue('ORDER'), config)).toBe(21);
  });

  it('does not call the base getters when an override supplies the value', () => {
    const getVelocity = vi.fn(() => 21);
    const wrapped = applyCapacityOverrides({ ...base, getVelocity } as any, {
      ORDER: { velocityPerSprint: 35 },
    });

    wrapped.getVelocity!(issue('ORDER'), config);

    expect(getVelocity).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"
npx vitest run src/react/services/capacity-overrides/applyCapacityOverrides.test.ts
```

Expected: FAIL — `Failed to resolve import "./applyCapacityOverrides"`.

- [ ] **Step 3: Write the types**

Create `src/react/services/capacity-overrides/types.ts`:

```ts
/** A session-only, uncommitted change to one team's scheduling inputs. */
export type TeamCapacityOverride = {
  velocityPerSprint?: number;
  tracks?: number;
};

/** Keyed by the team key `getTeamKey` returns for an issue. */
export type CapacityOverrides = Record<string, TeamCapacityOverride>;
```

- [ ] **Step 4: Write the implementation**

Create `src/react/services/capacity-overrides/applyCapacityOverrides.ts`:

```ts
import type { NormalizeIssueConfig } from '../../../jira/normalized/normalize';
import type { CapacityOverrides } from './types';

/**
 * Wraps the two normalize getters the Auto-Scheduler's team row can change. Everything downstream
 * (`totalPointsPerDay`, `pointsPerDayPerTrack`, every derived duration) recomputes from these, so
 * this is the whole override mechanism.
 */
export function applyCapacityOverrides(
  base: Partial<NormalizeIssueConfig>,
  overrides: CapacityOverrides,
): Partial<NormalizeIssueConfig> {
  // Identity when nothing is overridden, so the shell can assign unconditionally without forcing a
  // re-derive on every render.
  if (Object.keys(overrides).length === 0) return base;

  return {
    ...base,
    getVelocity: (issue, config) => {
      const override = overrides[config!.getTeamKey(issue)]?.velocityPerSprint;
      return override ?? base.getVelocity!(issue, config);
    },
    getParallelWorkLimit: (issue, config) => {
      const override = overrides[config!.getTeamKey(issue)]?.tracks;
      return override ?? base.getParallelWorkLimit!(issue, config);
    },
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/react/services/capacity-overrides/applyCapacityOverrides.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Typecheck, format, commit**

```bash
npx prettier --write src/react/services/capacity-overrides/
npm run typecheck
git add src/react/services/capacity-overrides/
git commit -m "feat(autoscheduler): add capacity override wrapper for normalize config"
```

---

### Task 2: The overrides provider

**Files:**

- Create: `src/react/services/capacity-overrides/CapacityOverridesProvider.tsx`
- Create: `src/react/services/capacity-overrides/index.ts`
- Test: `src/react/services/capacity-overrides/CapacityOverridesProvider.test.tsx`

**Interfaces:**

- Consumes: `CapacityOverrides`, `TeamCapacityOverride` from Task 1.
- Produces:

  - `<CapacityOverridesProvider>{children}</CapacityOverridesProvider>`
  - `useCapacityOverrides(): { overrides: CapacityOverrides; setTeamOverride(team: string, patch: TeamCapacityOverride): void; clearTeamOverride(team: string): void; }`

- [ ] **Step 1: Write the failing test**

Create `src/react/services/capacity-overrides/CapacityOverridesProvider.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CapacityOverridesProvider, useCapacityOverrides } from './CapacityOverridesProvider';

const Probe = () => {
  const { overrides, setTeamOverride, clearTeamOverride } = useCapacityOverrides();

  return (
    <div>
      <output>{JSON.stringify(overrides)}</output>
      <button onClick={() => setTeamOverride('ORDER', { velocityPerSprint: 35 })}>set capacity</button>
      <button onClick={() => setTeamOverride('ORDER', { tracks: 2 })}>set tracks</button>
      <button onClick={() => clearTeamOverride('ORDER')}>clear</button>
    </div>
  );
};

const renderProbe = () =>
  render(
    <CapacityOverridesProvider>
      <Probe />
    </CapacityOverridesProvider>,
  );

describe('CapacityOverridesProvider', () => {
  it('starts with no overrides', () => {
    renderProbe();
    expect(screen.getByRole('status')).toHaveTextContent('{}');
  });

  it('records an override for a team', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('set capacity'));
    expect(screen.getByRole('status')).toHaveTextContent('{"ORDER":{"velocityPerSprint":35}}');
  });

  it('merges a second field into the same team rather than replacing it', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('set capacity'));
    await userEvent.click(screen.getByText('set tracks'));
    expect(screen.getByRole('status')).toHaveTextContent('{"ORDER":{"velocityPerSprint":35,"tracks":2}}');
  });

  it('drops the team entirely on clear', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('set capacity'));
    await userEvent.click(screen.getByText('clear'));
    expect(screen.getByRole('status')).toHaveTextContent('{}');
  });

  it('throws when used outside its provider', () => {
    expect(() => render(<Probe />)).toThrow('Cannot use useCapacityOverrides outside of its provider');
  });
});
```

> `<output>` has the implicit ARIA role `status`, which is why `getByRole('status')` finds it.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/react/services/capacity-overrides/CapacityOverridesProvider.test.tsx
```

Expected: FAIL — `Failed to resolve import "./CapacityOverridesProvider"`.

- [ ] **Step 3: Write the provider**

Create `src/react/services/capacity-overrides/CapacityOverridesProvider.tsx`:

```tsx
import type { FC, ReactNode } from 'react';
import type { CapacityOverrides, TeamCapacityOverride } from './types';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface CapacityOverridesContextValue {
  overrides: CapacityOverrides;
  setTeamOverride: (team: string, patch: TeamCapacityOverride) => void;
  clearTeamOverride: (team: string) => void;
}

const CapacityOverridesContext = createContext<CapacityOverridesContextValue | null>(null);

export const useCapacityOverrides = () => {
  const context = useContext(CapacityOverridesContext);

  if (!context) {
    throw new Error('Cannot use useCapacityOverrides outside of its provider');
  }

  return context;
};

/**
 * Session-only what-if changes to team scheduling inputs. Deliberately not URL-backed: a shared link
 * that silently rebuilt a plan on capacity that does not exist would be worse than losing the edit.
 */
export const CapacityOverridesProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [overrides, setOverrides] = useState<CapacityOverrides>({});

  const setTeamOverride = useCallback((team: string, patch: TeamCapacityOverride) => {
    setOverrides((previous) => ({ ...previous, [team]: { ...previous[team], ...patch } }));
  }, []);

  const clearTeamOverride = useCallback((team: string) => {
    setOverrides((previous) => {
      if (!(team in previous)) return previous;
      const { [team]: _removed, ...rest } = previous;
      return rest;
    });
  }, []);

  const value = useMemo(
    () => ({ overrides, setTeamOverride, clearTeamOverride }),
    [overrides, setTeamOverride, clearTeamOverride],
  );

  return <CapacityOverridesContext.Provider value={value}>{children}</CapacityOverridesContext.Provider>;
};
```

- [ ] **Step 4: Write the barrel**

Create `src/react/services/capacity-overrides/index.ts`:

```ts
export * from './types';
export * from './applyCapacityOverrides';
export * from './CapacityOverridesProvider';
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/react/services/capacity-overrides/
```

Expected: PASS, 12 tests across both files.

- [ ] **Step 6: Typecheck, format, commit**

```bash
npx prettier --write src/react/services/capacity-overrides/
npm run typecheck
git add src/react/services/capacity-overrides/
git commit -m "feat(autoscheduler): add capacity overrides provider"
```

---

### Task 3: Feed overrides into the derived-data pipeline

**Files:**

- Modify: `src/react/TimelineReport/TimelineReport.tsx`

**Interfaces:**

- Consumes: `CapacityOverridesProvider`, `useCapacityOverrides`, `applyCapacityOverrides` from Task 2.
- Produces: every report rendered by the shell can call `useCapacityOverrides()`; changing an override re-runs normalize → derive → rollup.

**Why an inner component:** the provider must wrap the subtree that reads it, and the code that reacts to `overrides` must be _inside_ the provider. So the effect lives in a small component mounted inside it.

- [ ] **Step 1: Add the imports**

In `src/react/TimelineReport/TimelineReport.tsx`, after the `import { ReportLayoutProvider } from '../services/report-layout';` line, add:

```tsx
import {
  CapacityOverridesProvider,
  applyCapacityOverrides,
  useCapacityOverrides,
} from '../services/capacity-overrides';
```

- [ ] **Step 2: Replace `onUpdateTeamsConfiguration` so it remembers the un-overridden config**

Find this block (currently around line 137):

```tsx
  const onUpdateTeamsConfiguration = ({ fields, ...configuration }: any) => {
```

Replace the whole function, and add the ref above it, with:

```tsx
// The last team configuration as saved, before any what-if override is layered on. Kept so an
// override can be recomputed from a clean base instead of wrapping an already-wrapped config.
const baseNormalizeOptionsRef = React.useRef<any>(null);

const onUpdateTeamsConfiguration = ({ fields, ...configuration }: any) => {
  // A save that could not derive its config passes `{}` (see useSaveAllTeamData's guards), so
  // `fields` is undefined. Writing that through clears `fieldsToRequest`, which makes
  // `getRawIssues` return undefined and leaves the report on `derivedIssuesPromise`'s
  // never-settling promise — a spinner that can never clear. Keep the last known-good config
  // instead; the report stays on the data it already has. See spec/015-field-selection.
  if (!fields) {
    console.warn(
      [
        'onUpdateTeamsConfiguration (TimelineReport):',
        'Ignoring a team configuration update that carried no fields.',
        'The report keeps its previous configuration.',
      ].join('\n'),
    );
    return;
  }

  baseNormalizeOptionsRef.current = configuration;

  queues.batch.start();
  rd.fieldsToRequest = fields;
  rd.normalizeOptions = configuration;
  queues.batch.stop();
};
```

> The only change is the added ref assignment — the guard and its comment are unchanged.

- [ ] **Step 3: Add the applier component**

At the bottom of `src/react/TimelineReport/TimelineReport.tsx`, above `function getElementPosition(`, add:

```tsx
/**
 * Re-derives the whole pipeline when a what-if capacity override changes. Overrides deliberately do
 * not travel through the URL: `AutoScheduler` keeps the previous `primaryIssuesOrReleases` array
 * whenever the issue objects are identical, so a URL-only change would be swallowed. Going through
 * `normalizeOptions` produces genuinely new issue objects, which is what restarts the simulation.
 */
const CapacityOverrideApplier: FC<{ baseRef: React.MutableRefObject<any> }> = ({ baseRef }) => {
  const { overrides } = useCapacityOverrides();

  useEffect(() => {
    // Each assignment re-runs normalize → derive → rollup and restarts the Monte Carlo, so coalesce
    // a burst of stepper clicks into one run.
    const timer = setTimeout(() => {
      // Seed from whatever the route-data promise chain resolved, the first time an override lands.
      const base = baseRef.current ?? rd.normalizeOptions;
      if (!base) return;
      baseRef.current = base;

      rd.normalizeOptions = applyCapacityOverrides(base, overrides);
    }, CAPACITY_OVERRIDE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [overrides, baseRef]);

  return null;
};
```

Add the constant next to `KNOWN_REPORT_TYPES` near the top of the file:

```tsx
// Long enough that clicking the track stepper three times is one simulation, short enough that a
// single edit still feels immediate.
const CAPACITY_OVERRIDE_DEBOUNCE_MS = 300;
```

- [ ] **Step 4: Mount the provider and the applier**

Change the opening and closing of the returned tree. Replace:

```tsx
    <ReportLayoutProvider savedReport={openReport}>
```

with:

```tsx
    <CapacityOverridesProvider>
      <CapacityOverrideApplier baseRef={baseNormalizeOptionsRef} />
      <ReportLayoutProvider savedReport={openReport}>
```

and replace the matching closing tag:

```tsx
    </ReportLayoutProvider>
  );
};
```

with:

```tsx
      </ReportLayoutProvider>
    </CapacityOverridesProvider>
  );
};
```

> Re-indent the body of `ReportLayoutProvider` by two spaces — Prettier in Step 6 will do this for you.

- [ ] **Step 5: Verify the shell still renders**

```bash
npx vitest run src/react/TimelineReport/
```

Expected: PASS — no behaviour changed while `overrides` is `{}`, because `applyCapacityOverrides` returns the base object identity.

- [ ] **Step 6: Typecheck, format, commit**

```bash
npx prettier --write src/react/TimelineReport/TimelineReport.tsx
npm run typecheck
git add src/react/TimelineReport/TimelineReport.tsx
git commit -m "feat(autoscheduler): apply capacity overrides to the derived-data pipeline"
```

---

### Task 4: The capacity field and the track stepper

**Files:**

- Create: `src/react/reports/AutoScheduler/components/TeamCapacityControls/CapacityField.tsx`
- Create: `src/react/reports/AutoScheduler/components/TeamCapacityControls/TrackStepper.tsx`
- Test: `src/react/reports/AutoScheduler/components/TeamCapacityControls/CapacityField.test.tsx`
- Test: `src/react/reports/AutoScheduler/components/TeamCapacityControls/TrackStepper.test.tsx`

**Interfaces:**

- Consumes: `@atlaskit/inline-edit`, `@atlaskit/textfield` (both already dependencies).
- Produces:

  - `<CapacityField value={number} onChange={(next: number) => void} />`
  - `<TrackStepper value={number} onChange={(next: number) => void} />`

- [ ] **Step 1: Write the failing tests**

Create `src/react/reports/AutoScheduler/components/TeamCapacityControls/CapacityField.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CapacityField } from './CapacityField';

describe('CapacityField', () => {
  it('renders the value as a button, not an input, at rest', () => {
    render(<CapacityField value={21} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /21 points per sprint/i })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('opens a field when the read view is clicked', async () => {
    render(<CapacityField value={21} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /21 points per sprint/i }));

    expect(screen.getByRole('spinbutton')).toHaveValue(21);
  });

  it('reports the new value on confirm', async () => {
    const onChange = vi.fn();
    render(<CapacityField value={21} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /21 points per sprint/i }));
    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '35{Enter}');

    expect(onChange).toHaveBeenCalledWith(35);
  });

  it('does not report a value that did not change', async () => {
    const onChange = vi.fn();
    render(<CapacityField value={21} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /21 points per sprint/i }));
    await userEvent.type(screen.getByRole('spinbutton'), '{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects zero and negative capacity', async () => {
    const onChange = vi.fn();
    render(<CapacityField value={21} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /21 points per sprint/i }));
    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '0{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });
});
```

Create `src/react/reports/AutoScheduler/components/TeamCapacityControls/TrackStepper.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TrackStepper } from './TrackStepper';

describe('TrackStepper', () => {
  it('reads out a singular track', () => {
    render(<TrackStepper value={1} onChange={vi.fn()} />);
    expect(screen.getByText('1 track')).toBeInTheDocument();
  });

  it('reads out plural tracks', () => {
    render(<TrackStepper value={2} onChange={vi.fn()} />);
    expect(screen.getByText('2 tracks')).toBeInTheDocument();
  });

  it('adds a track', async () => {
    const onChange = vi.fn();
    render(<TrackStepper value={2} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('removes a track', async () => {
    const onChange = vi.fn();
    render(<TrackStepper value={2} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /remove a work track/i }));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('cannot go below one track', () => {
    render(<TrackStepper value={1} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /remove a work track/i })).toBeDisabled();
  });

  it('has no upper bound', () => {
    render(<TrackStepper value={99} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add a parallel work track/i })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/react/reports/AutoScheduler/components/TeamCapacityControls/
```

Expected: FAIL — `Failed to resolve import "./CapacityField"` and `"./TrackStepper"`.

- [ ] **Step 3: Write `CapacityField`**

Create `src/react/reports/AutoScheduler/components/TeamCapacityControls/CapacityField.tsx`:

```tsx
import type { FC } from 'react';

import React, { useState } from 'react';
import InlineEdit from '@atlaskit/inline-edit';
import Textfield from '@atlaskit/textfield';

interface CapacityFieldProps {
  value: number;
  onChange: (next: number) => void;
}

/**
 * The team's capacity per sprint, as the standard Jira click-to-edit. `EditableTitle.tsx` is the
 * model: `InlineEdit`'s own read view is the click target, which works here because the team header
 * row has no click handler of its own competing for the gesture.
 */
export const CapacityField: FC<CapacityFieldProps> = ({ value, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    // InlineEdit's internal styles can't be reached through props; this drops its outer margin,
    // which would otherwise stretch the team header row's height.
    <div className="[&>form>div]:!m-0">
      <InlineEdit<string>
        isEditing={isEditing}
        onEdit={() => setIsEditing(true)}
        defaultValue={String(value)}
        editButtonLabel={`Capacity, ${value} points per sprint`}
        validate={(next) => (Number(next) > 0 ? undefined : 'Enter a number greater than 0')}
        onConfirm={(next) => {
          setIsEditing(false);
          const parsed = Number(next);
          if (parsed > 0 && parsed !== value) onChange(parsed);
        }}
        onCancel={() => setIsEditing(false)}
        editView={({ errorMessage, ...fieldProps }) => (
          <Textfield {...fieldProps} type="number" min={1} autoFocus width={72} />
        )}
        readView={() => <span className="font-semibold tabular-nums">{value}</span>}
      />
    </div>
  );
};
```

- [ ] **Step 4: Write `TrackStepper`**

Create `src/react/reports/AutoScheduler/components/TeamCapacityControls/TrackStepper.tsx`:

```tsx
import type { FC } from 'react';

import React from 'react';

interface TrackStepperProps {
  value: number;
  onChange: (next: number) => void;
}

const stepButton =
  'w-[22px] border-none bg-white text-slate-600 font-mono text-[13px] leading-none cursor-pointer ' +
  'hover:bg-neutral-20 disabled:text-neutral-50 disabled:cursor-not-allowed';

/**
 * Both directions in one control, unlike the original tool which put `+` on the team row and `−` on
 * the first track's label row. That row is not rendered when a track has no work — exactly when you
 * would want to remove it.
 */
export const TrackStepper: FC<TrackStepperProps> = ({ value, onChange }) => (
  <span className="inline-flex h-[22px] items-stretch overflow-hidden rounded-[3px] border border-neutral-40 bg-white">
    <button
      type="button"
      className={stepButton}
      disabled={value <= 1}
      title="Remove a work track for this team."
      aria-label="Remove a work track for this team"
      onClick={() => onChange(value - 1)}
    >
      −
    </button>
    <span className="inline-flex min-w-[56px] items-center justify-center whitespace-nowrap border-x border-neutral-30 px-1 text-[11px] font-semibold text-slate-600">
      {value} {value === 1 ? 'track' : 'tracks'}
    </span>
    {/* No upper bound: how many streams a team runs is a fact about the team, not ours to cap. */}
    <button
      type="button"
      className={stepButton}
      title="Add a parallel work track for this team."
      aria-label="Add a parallel work track for this team"
      onClick={() => onChange(value + 1)}
    >
      +
    </button>
  </span>
);
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/react/reports/AutoScheduler/components/TeamCapacityControls/
```

Expected: PASS, 11 tests.

- [ ] **Step 6: Typecheck, format, commit**

```bash
npx prettier --write src/react/reports/AutoScheduler/components/TeamCapacityControls/
npm run typecheck
git add src/react/reports/AutoScheduler/components/TeamCapacityControls/
git commit -m "feat(autoscheduler): add capacity field and track stepper"
```

---

### Task 5: Commit-to-settings hook

**Files:**

- Create: `src/react/reports/AutoScheduler/components/TeamCapacityControls/useTeamCommit.ts`
- Test: `src/react/reports/AutoScheduler/components/TeamCapacityControls/useTeamCommit.test.tsx`

**Interfaces:**

- Consumes: `useSaveTeamData`, `useAllTeamData`, `createEmptyConfiguration` from `services/team-configuration`; `useJiraIssueFields` from `services/jira`.
- Produces: `useTeamCommit(): { commit(team: string, values: { velocityPerSprint?: number; tracks?: number }): void; isSaving: boolean }`

- [ ] **Step 1: Write the failing test**

Create `src/react/reports/AutoScheduler/components/TeamCapacityControls/useTeamCommit.test.tsx`:

```tsx
import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const save = vi.fn();
const useSaveTeamData = vi.fn(() => ({ save, isSaving: false }));

vi.mock(
  '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration',
  () => ({
    useSaveTeamData: (...args: unknown[]) => useSaveTeamData(...(args as [])),
    useAllTeamData: () => ({
      savedUserAllTeamData: {
        ORDER: { defaults: { sprintLength: 10, velocityPerSprint: 21, tracks: 1, estimateField: 'Story points' } },
      },
    }),
    createEmptyConfiguration: () => ({
      sprintLength: null,
      velocityPerSprint: null,
      tracks: null,
      estimateField: null,
      confidenceField: null,
      startDateField: null,
      dueDateField: null,
      statusSummaryField: null,
      spreadEffortAcrossDates: null,
    }),
  }),
);

vi.mock('../../../../services/jira', () => ({ useJiraIssueFields: () => [] }));

import { useTeamCommit } from './useTeamCommit';

const Probe = ({ team }: { team: string }) => {
  const { commit } = useTeamCommit();
  return <button onClick={() => commit(team, { velocityPerSprint: 35, tracks: 2 })}>commit</button>;
};

const renderProbe = (team = 'ORDER') =>
  render(
    <Suspense fallback="loading">
      <Probe team={team} />
    </Suspense>,
  );

beforeEach(() => {
  save.mockClear();
  useSaveTeamData.mockClear();
});

describe('useTeamCommit', () => {
  it("targets the team's defaults level", async () => {
    renderProbe();
    await userEvent.click(screen.getByText('commit'));

    expect(useSaveTeamData).toHaveBeenCalledWith(
      expect.objectContaining({ teamName: 'ORDER', hierarchyLevel: 'defaults' }),
    );
  });

  it('merges the new values onto the saved configuration', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('commit'));

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        sprintLength: 10,
        estimateField: 'Story points',
        velocityPerSprint: 35,
        tracks: 2,
      }),
    );
  });

  it('falls back to an empty configuration for a team with nothing saved', async () => {
    renderProbe('STORE');
    await userEvent.click(screen.getByText('commit'));

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ sprintLength: null, velocityPerSprint: 35 }));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/react/reports/AutoScheduler/components/TeamCapacityControls/useTeamCommit.test.tsx
```

Expected: FAIL — `Failed to resolve import "./useTeamCommit"`.

- [ ] **Step 3: Write the hook**

Create `src/react/reports/AutoScheduler/components/TeamCapacityControls/useTeamCommit.ts`:

```ts
import type { TeamCapacityOverride } from '../../../../services/capacity-overrides';

import { useCallback, useState } from 'react';

import { useJiraIssueFields } from '../../../../services/jira';
import {
  createEmptyConfiguration,
  useAllTeamData,
  useSaveTeamData,
} from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration';

/**
 * Writes a team's what-if capacity and tracks through to saved team settings, using the same
 * mutation the Teams sidebar uses.
 *
 * Targets the team's `defaults` rather than a specific hierarchy level: the Auto-Scheduler shows one
 * capacity per team, and `applyInheritance` propagates `defaults` down to every level.
 */
export const useTeamCommit = () => {
  const jiraFields = useJiraIssueFields();
  const { savedUserAllTeamData } = useAllTeamData(jiraFields);
  const [teamName, setTeamName] = useState('');

  const { save, isSaving } = useSaveTeamData({ teamName, hierarchyLevel: 'defaults' });

  const commit = useCallback(
    (team: string, values: TeamCapacityOverride) => {
      // `useSaveTeamData` closes over `teamName`, so the row must claim the hook before saving.
      setTeamName(team);

      const saved = savedUserAllTeamData[team]?.defaults ?? createEmptyConfiguration();

      save({
        ...saved,
        ...(values.velocityPerSprint !== undefined ? { velocityPerSprint: values.velocityPerSprint } : {}),
        ...(values.tracks !== undefined ? { tracks: values.tracks } : {}),
      });
    },
    [save, savedUserAllTeamData],
  );

  return { commit, isSaving };
};
```

> **Known wrinkle to verify in Step 4:** `useSaveTeamData` captures `teamName` at render time, so calling `setTeamName` and `save` in the same tick uses the _previous_ team. The tests above pin the contract; if they fail on the team name, change `useTeamCommit` to call `useSaveAllTeamData` + `sanitizeAllTeamData(savedUserAllTeamData, team, 'defaults', config)` directly, which takes the team as an argument instead of closing over it. Prefer that form if it is cleaner — it removes the `useState` entirely.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/react/reports/AutoScheduler/components/TeamCapacityControls/useTeamCommit.test.tsx
```

Expected: PASS, 3 tests. If the first test fails with a stale/empty `teamName`, switch to the `useSaveAllTeamData` + `sanitizeAllTeamData` form described above and re-run.

- [ ] **Step 5: Typecheck, format, commit**

```bash
npx prettier --write src/react/reports/AutoScheduler/components/TeamCapacityControls/
npm run typecheck
git add src/react/reports/AutoScheduler/components/TeamCapacityControls/
git commit -m "feat(autoscheduler): add commit-to-team-settings hook"
```

---

### Task 6: `TeamCapacityControls` — the composed row controls

**Files:**

- Create: `src/react/reports/AutoScheduler/components/TeamCapacityControls/TeamCapacityControls.tsx`
- Create: `src/react/reports/AutoScheduler/components/TeamCapacityControls/index.ts`
- Create: `src/react/reports/AutoScheduler/components/TeamCapacityControls/TeamCapacityControls.stories.tsx`
- Test: `src/react/reports/AutoScheduler/components/TeamCapacityControls/TeamCapacityControls.test.tsx`

**Interfaces:**

- Consumes: `CapacityField`, `TrackStepper` (Task 4), `useTeamCommit` (Task 5), `useCapacityOverrides` (Task 2).
- Produces:

  - `<TeamCapacityInputs teamName={string} savedVelocityPerSprint={number} savedTracks={number} />`
  - `<TeamCapacityOutputs pointsPerDay={number} totalWorkingDays={number} />`
  - `useTeamIsDirty(teamName: string): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/react/reports/AutoScheduler/components/TeamCapacityControls/TeamCapacityControls.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const commit = vi.fn();
vi.mock('./useTeamCommit', () => ({ useTeamCommit: () => ({ commit, isSaving: false }) }));

import { CapacityOverridesProvider } from '../../../../services/capacity-overrides';
import { TeamCapacityInputs } from './TeamCapacityControls';

const renderInputs = () =>
  render(
    <CapacityOverridesProvider>
      <TeamCapacityInputs teamName="ORDER" savedVelocityPerSprint={21} savedTracks={1} />
    </CapacityOverridesProvider>,
  );

beforeEach(() => commit.mockClear());

describe('TeamCapacityInputs', () => {
  it('shows the saved values with no commit controls at rest', () => {
    renderInputs();

    expect(screen.getByRole('button', { name: /21 points per sprint/i })).toBeInTheDocument();
    expect(screen.getByText('1 track')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Commit' })).not.toBeInTheDocument();
  });

  it('reveals Reset and Commit once tracks change', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));

    expect(screen.getByText('2 tracks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Commit' })).toBeInTheDocument();
  });

  it('reveals Reset and Commit once capacity changes', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /21 points per sprint/i }));
    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '35{Enter}');

    expect(screen.getByRole('button', { name: /35 points per sprint/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });

  it('puts the saved values back on Reset', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByText('1 track')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
  });

  it('sends the overridden values to the commit hook', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(commit).toHaveBeenCalledWith('ORDER', { tracks: 2 });
  });

  it('clears the override after a commit, so the row stops reading as dirty', async () => {
    renderInputs();

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(screen.queryByRole('button', { name: 'Commit' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/react/reports/AutoScheduler/components/TeamCapacityControls/TeamCapacityControls.test.tsx
```

Expected: FAIL — `Failed to resolve import "./TeamCapacityControls"`.

- [ ] **Step 3: Write the component**

Create `src/react/reports/AutoScheduler/components/TeamCapacityControls/TeamCapacityControls.tsx`:

```tsx
import type { FC } from 'react';

import React from 'react';
import Tooltip from '@atlaskit/tooltip';

import { useCapacityOverrides } from '../../../../services/capacity-overrides';
import { roundTo } from '../../../../../utils/number/number';
import { CapacityField } from './CapacityField';
import { TrackStepper } from './TrackStepper';
import { useTeamCommit } from './useTeamCommit';

/** A team reads as dirty when anything on its row is uncommitted — capacity or tracks, alike. */
export const useTeamIsDirty = (teamName: string) => {
  const { overrides } = useCapacityOverrides();
  const override = overrides[teamName];

  return !!override && (override.velocityPerSprint !== undefined || override.tracks !== undefined);
};

interface TeamCapacityInputsProps {
  teamName: string;
  savedVelocityPerSprint: number;
  savedTracks: number;
}

const buttonClasses =
  'rounded-[3px] border border-neutral-40 bg-white px-2.5 py-[3px] text-xs font-semibold text-slate-600 ' +
  'hover:bg-neutral-20';

/**
 * The left, editable half of a team header row: tracks, capacity, and — only while the team is
 * dirty — Reset and Commit. The buttons live at the end of the input group so the row grows leftward
 * and the output columns never shift.
 */
export const TeamCapacityInputs: FC<TeamCapacityInputsProps> = ({ teamName, savedVelocityPerSprint, savedTracks }) => {
  const { overrides, setTeamOverride, clearTeamOverride } = useCapacityOverrides();
  const { commit, isSaving } = useTeamCommit();

  const override = overrides[teamName] ?? {};
  const isDirty = useTeamIsDirty(teamName);

  const velocityPerSprint = override.velocityPerSprint ?? savedVelocityPerSprint;
  const tracks = override.tracks ?? savedTracks;

  return (
    <span className="inline-flex min-w-0 items-center gap-3.5">
      <Tooltip content={trackTooltip(tracks, velocityPerSprint)}>
        <TrackStepper value={tracks} onChange={(next) => setTeamOverride(teamName, { tracks: next })} />
      </Tooltip>

      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-neutral-500">Capacity</span>
        <CapacityField
          value={velocityPerSprint}
          onChange={(next) => setTeamOverride(teamName, { velocityPerSprint: next })}
        />
        <span className="text-[11px] text-neutral-500">pts / sprint</span>
      </span>

      {isDirty && (
        <span className="inline-flex gap-1.5">
          <button type="button" className={buttonClasses} onClick={() => clearTeamOverride(teamName)}>
            Reset
          </button>
          <button
            type="button"
            className="rounded-[3px] border border-blue-600 bg-blue-600 px-2.5 py-[3px] text-xs font-semibold text-white hover:bg-blue-700"
            disabled={isSaving}
            onClick={() => {
              commit(teamName, override);
              clearTeamOverride(teamName);
            }}
          >
            Commit
          </button>
        </span>
      )}
    </span>
  );
};

interface TeamCapacityOutputsProps {
  pointsPerDay: number;
  totalWorkingDays: number;
}

/** The right, read-only half: a unit conversion of capacity, and a result of the simulation. */
export const TeamCapacityOutputs: FC<TeamCapacityOutputsProps> = ({ pointsPerDay, totalWorkingDays }) => (
  <span className="inline-flex items-center gap-3.5">
    <Tooltip content="Capacity ÷ sprint length. Change capacity to move this — it is a readout, not a setting.">
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap" tabIndex={0}>
        <span className="text-neutral-500">Points / Day</span>
        <span className="font-semibold tabular-nums">{roundTo(pointsPerDay, 2)}</span>
      </span>
    </Tooltip>
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-neutral-500">Total Working Days</span>
      <span className="font-semibold tabular-nums">{roundTo(totalWorkingDays, 0)}</span>
    </span>
  </span>
);

function trackTooltip(tracks: number, velocityPerSprint: number) {
  return (
    <div className="grid gap-1.5">
      <div className="font-semibold">Tracks — {tracks}</div>
      <div>Parallel work streams inside this team. Each track works one epic at a time.</div>
      <div>
        Adding a track does <strong>not</strong> add capacity. The team still delivers {velocityPerSprint} points per
        sprint; each track gets a share of it, so every epic takes proportionally longer and more run at once.
      </div>
      <div>Epics with no estimate also shrink — their default estimate is capacity ÷ tracks.</div>
    </div>
  );
}
```

- [ ] **Step 4: Write the barrel**

Create `src/react/reports/AutoScheduler/components/TeamCapacityControls/index.ts`:

```ts
export { TeamCapacityInputs, TeamCapacityOutputs, useTeamIsDirty } from './TeamCapacityControls';
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/react/reports/AutoScheduler/components/TeamCapacityControls/
```

Expected: PASS, 20 tests across all four files.

- [ ] **Step 6: Write the story**

Create `src/react/reports/AutoScheduler/components/TeamCapacityControls/TeamCapacityControls.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';

import React from 'react';

import { CapacityOverridesProvider } from '../../../../services/capacity-overrides';
import { TeamCapacityInputs, TeamCapacityOutputs } from './TeamCapacityControls';

const Row = () => (
  <div className="flex max-w-[1080px] items-center justify-between bg-neutral-20 px-2 py-1.5 text-xs text-slate-600">
    <span className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
      ORDER
      <TeamCapacityInputs teamName="ORDER" savedVelocityPerSprint={21} savedTracks={1} />
    </span>
    <TeamCapacityOutputs pointsPerDay={2.1} totalWorkingDays={38} />
  </div>
);

const meta: Meta<typeof Row> = {
  title: 'reports/AutoScheduler/TeamCapacityControls',
  component: Row,
  decorators: [
    (Story) => (
      <CapacityOverridesProvider>
        <Story />
      </CapacityOverridesProvider>
    ),
  ],
};

export default meta;

/** At rest: no commit controls, capacity reads as plain text until hovered. */
export const Clean: StoryObj<typeof Row> = {};
```

- [ ] **Step 7: Typecheck, format, commit**

```bash
npx prettier --write src/react/reports/AutoScheduler/components/TeamCapacityControls/
npm run typecheck
git add src/react/reports/AutoScheduler/components/TeamCapacityControls/
git commit -m "feat(autoscheduler): compose team capacity controls with reset and commit"
```

---

### Task 7: Wire the controls into the Auto-Scheduler header row

**Files:**

- Modify: `src/react/reports/AutoScheduler/AutoScheduler.tsx`
- Test: `src/react/reports/AutoScheduler/AutoScheduler.test.tsx`

**Interfaces:**

- Consumes: `TeamCapacityInputs`, `TeamCapacityOutputs`, `useTeamIsDirty` (Task 6); `StorageProvider` from `services/storage`.
- Produces: the finished feature.

**Layout contract:** the header row becomes two groups in a `justify-between` flex — inputs (stepper, capacity, Reset/Commit) left, outputs (Points / Day, Total Working Days) right. The team-name cell keeps only the team name; the stepper moves into the input group so the two stay adjacent.

- [ ] **Step 1: Write the failing test**

Append to `src/react/reports/AutoScheduler/AutoScheduler.test.tsx`, after the existing `describe('AutoScheduler critical-path rail', …)` block:

```tsx
describe('AutoScheduler team capacity row', () => {
  it('renders capacity as an editable read view and the outputs as text', () => {
    renderScheduler();

    expect(screen.getByRole('button', { name: /21 points per sprint/i })).toBeInTheDocument();
    expect(screen.getByText('Points / Day')).toBeInTheDocument();
    expect(screen.getByText('Total Working Days')).toBeInTheDocument();
  });

  it('shows the track stepper for the team', () => {
    renderScheduler();

    expect(screen.getByText('1 track')).toBeInTheDocument();
  });

  it('has no commit controls until something changes', () => {
    renderScheduler();

    expect(screen.queryByRole('button', { name: 'Commit' })).not.toBeInTheDocument();
  });

  it('marks the row dirty and offers Reset once a track is added', async () => {
    renderScheduler();

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));

    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    expect(document.querySelector('[data-team-row="ORDER"][data-dirty="true"]')).toBeInTheDocument();
  });
});
```

Update the test file's `UI_DATA` so the team carries the fields the row now reads — replace the `teams` entry with:

```tsx
  teams: [
    {
      team: 'ORDER',
      teamData: { parallelWorkLimit: 1, pointsPerDayPerTrack: 1, totalPointsPerDay: 1, velocity: 21, daysPerSprint: 10 },
      tracks: [EPICS.map((key, i) => issueResult(key, 10 - i))],
    },
  ],
```

Add these mocks next to the existing ones at the top of the file:

```tsx
vi.mock('./components/TeamCapacityControls/useTeamCommit', () => ({
  useTeamCommit: () => ({ commit: vi.fn(), isSaving: false }),
}));
vi.mock('../../services/storage', () => ({ StorageProvider: ({ children }: any) => children }));
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/react/reports/AutoScheduler/AutoScheduler.test.tsx
```

Expected: FAIL — `Unable to find an accessible element with the role "button" and name /21 points per sprint/i`.

- [ ] **Step 3: Add the imports and the StorageProvider**

In `src/react/reports/AutoScheduler/AutoScheduler.tsx`, add after the `import { roundTo } …` line:

```tsx
import { StorageProvider } from '../../services/storage';
import { TeamCapacityInputs, TeamCapacityOutputs, useTeamIsDirty } from './components/TeamCapacityControls';
```

Replace `AutoSchedulerWrapper` (currently around line 444) with:

```tsx
export default function AutoSchedulerWrapper(props: AutoSchedulerProps) {
  return (
    <FlagsProvider>
      <JiraProvider jira={routeData.jiraHelpers}>
        {/* `useTeamCommit` reaches the same team-configuration store the Teams sidebar writes. */}
        <StorageProvider storage={routeData.storage}>
          <QueryClientProvider client={queryClient}>
            <AutoScheduler {...props} />
          </QueryClientProvider>
        </StorageProvider>
      </JiraProvider>
    </FlagsProvider>
  );
}
```

- [ ] **Step 4: Extract the header row into its own component**

Still in `AutoScheduler.tsx`, add above `function totalWorkingDays(` near the bottom:

```tsx
/**
 * A team's header row. Split out because the dirty treatment needs `useTeamIsDirty`, and a hook
 * cannot be called inside the `gridifiedTeams.map` in `AutoScheduler`'s body.
 */
const TeamHeaderRow: FC<{ team: GridifiedStatsTeam; gridNumberOfDays: number }> = ({ team, gridNumberOfDays }) => {
  const isDirty = useTeamIsDirty(team.team);

  return (
    <>
      <div
        data-team-row={team.team}
        data-dirty={isDirty}
        className={`pt-2 pb-1 ${isDirty ? 'bg-[#fff3eb] shadow-[inset_3px_0_0_#b65c02]' : 'bg-neutral-20'}`}
        style={{
          gridRow: `${team.style.gridRowStart} / span 1`,
          gridColumn: `1 / span ${gridNumberOfDays + 1}`,
        }}
      />

      <div
        className={`pl-2 pt-2 pb-1 pr-1 flex sticky top-0 ${isDirty ? 'bg-[#fff3eb]' : 'bg-neutral-20'}`}
        style={{ gridRow: team.style.gridRowStart, gridColumnStart: 'what' }}
      >
        <div className="text-base grow font-semibold">{team.team}</div>
      </div>

      {/* `relative z-30` lifts the row above `#dependencies`, which would otherwise swallow every
          click on the capacity read view and the stepper. */}
      <div
        className="pl-0 pt-1.5 pb-1 pr-3 text-xs flex items-center justify-between gap-4 relative z-30"
        style={{
          gridRow: `${team.style.gridRowStart} / span 1`,
          gridColumn: `2 / span ${gridNumberOfDays}`,
        }}
      >
        <TeamCapacityInputs
          teamName={team.team}
          savedVelocityPerSprint={team.teamData.velocity}
          savedTracks={team.teamData.parallelWorkLimit}
        />
        <TeamCapacityOutputs
          pointsPerDay={team.teamData.totalPointsPerDay}
          totalWorkingDays={totalWorkingDays(team) / team.teamData.parallelWorkLimit}
        />
      </div>
    </>
  );
};
```

- [ ] **Step 5: Use it in the grid**

In `AutoScheduler`'s body, find the team stripe / name / metrics markup inside `gridData.gridifiedTeams.map(...)` — the three `<div>`s starting with `{/* The stripe background for the team*/}` and ending with the `Total Working Days:` div. Replace all three with:

```tsx
<TeamHeaderRow team={team} gridNumberOfDays={gridData.gridNumberOfDays} />
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npx vitest run src/react/reports/AutoScheduler/
```

Expected: PASS — the four new tests plus every existing AutoScheduler test.

- [ ] **Step 7: Verify in the browser**

```bash
npm run dev
```

Open `http://localhost:5173/?jql=issue+in+(IMP-99,+IMP-100,+IMP-123)&loadChildren=true&selectedIssueType=Epic&primaryReportType=auto-scheduler` and confirm, against [../mockups/capacity-controls.html](../mockups/capacity-controls.html):

1. The team row reads `ORDER ⟨− 1 track +⟩ Capacity 21 pts / sprint` on the left, `Points / Day … Total Working Days …` on the right.
2. Hovering capacity shows a subtle grey fill — no pencil, no border.
3. Clicking capacity opens a field; typing a new number and pressing Enter re-runs the simulation and moves Points / Day and the bars.
4. The row turns amber and `Reset` / `Commit` appear.
5. `Reset` restores the original capacity and the amber clears.
6. `+` adds a track, the grid grows a `Track 2` row, and the dependency arrows redraw correctly.
7. Clicking `+` three times quickly produces **one** simulation restart, not three — watch the
   progress bar at the top of the report.
8. `Commit` clears the amber; reloading the page keeps the new capacity, and Settings → Teams shows it.

- [ ] **Step 8: Full suite, typecheck, format, commit**

```bash
npx prettier --write src/react/reports/AutoScheduler/
npm run typecheck
npm run test
git add src/react/reports/AutoScheduler/
git commit -m "feat(autoscheduler): editable capacity and tracks on the team header row"
```

---

## Definition of done

- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes with no new failures.
- [ ] `npx prettier --check src/react/services/capacity-overrides src/react/reports/AutoScheduler src/react/TimelineReport` passes.
- [ ] All eight browser checks in Task 7 Step 7 pass.
- [ ] No override appears in the URL after editing capacity or tracks.
- [ ] `git grep -n "capacityOverrides\|CapacityOverrides" src/canjs` returns nothing — no CanJS UI was added.

## Deliberately out of scope

- Sprint length is not editable from this row (open question 1 in the spec).
- No global "reset all / commit all" bar.
- No before → after text on the row (`was 21`, `1.75 / track`).
- No maximum track count.
- No new loading/re-simulation UI — the report's existing progress bar covers the re-run.
- Overrides are not persisted to the URL or to saved reports.
