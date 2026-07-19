---
name: react-dependency-injection
description: Use when a React component or hook hard-imports a module singleton, global store, fetcher, router, or other side-effectful source and you need to test, reuse, or decouple it — before reaching for vi.mock or a Context provider.
---

# React Dependency Injection (default-valued props/params)

## Overview

When a component or hook is hard to test, the culprit is usually a **hard-wired module import** (a singleton store, fetcher, router). Make that dependency a **parameter or prop that defaults to the real thing**. Production callers pass nothing (unchanged); tests pass a fake.

**Core principle:** default = real, override in tests. Reach for this lightweight seam _before_ `vi.mock` or a Context provider.

## When to Use

- A hook/component imports a singleton/global/side-effectful module and you want to unit-test it, drive it with controlled data, or reuse it elsewhere.
- You want to decouple from a global (e.g. ahead of migrating that global away).

**Not for:** pure functions (just call them), or dependencies already passed in as props.

## The Pattern

Two dominant forms, plus one advanced form.

### 1. Inject the dependency (value / object / fn) via a default

```ts
// hook — default is the real singleton
import { store as defaultStore } from './store';
export function useThing(store = defaultStore) {
  /* reads store */
}
```

```tsx
// component — default is the real implementation
import defaultFetcher from './fetcher';
export function Panel({ fetcher = defaultFetcher }) {
  /* uses fetcher */
}
```

Tests: `renderHook(() => useThing(fakeStore))` / `<Panel fetcher={fakeFetcher} />`. No `vi.mock`.

### 2. Split a component into a pure view + a thin container

Test rendering with plain props; test the logic via the hook.

```tsx
export function PanelView(props: ViewModel) {
  /* pure — props only, no store/effects */
}
export function Panel() {
  return <PanelView {...useThing()} />;
}
```

`<PanelView status="pending" received={7} total={22} />` reaches every visual state with no store, no async, no mocking.

### 3. (Advanced) Inject a hook via a default prop

```tsx
export function Panel({ useThing = useRealThing }) {
  const vm = useThing(); // call UNCONDITIONALLY at the top level
}
```

**Rules-of-hooks caveat:** put the default on the _prop_ and call the hook unconditionally. **Never** call the hook in a default-parameter slot — `function Panel({ vm = useRealThing() })` invokes a hook conditionally (only when the prop is omitted), which violates the rules of hooks. Prefer form 2 unless the dependency genuinely is a hook.

## Two Levels of Leverage

- **Inject the store into the hook** → the real observation/derivation code runs against controlled data, so read/path bugs surface (a mocked hook would hide them).
- **Split the view** (or inject the hook) → render every state from plain props.

## Anti-Patterns

| Instead of…                                    | Do this                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `vi.mock('./store')` / `vi.mock('./useThing')` | inject the dependency (form 1) or split the view (form 2)                                                     |
| A Context provider added _just_ for tests      | use a default param/prop; reach for Context only when the dependency must cross many layers you don't control |

**Why not `vi.mock`:** brittle (hoisting, per-test reset), can't easily _emit_ streaming updates, and mocking the hook replaces the very logic you want under test.

**Why not Context-by-default:** more ceremony (provider, wrapper in every test) for the same result a defaulted param/prop gives directly.

## Gotcha: Stable Observable/Object Identity

If the injected source hands back a _fresh_ observable/object per call, memoize it so subscriptions/effects don't churn (hooks like `useCanObservable`/`useEffect` key on identity):

```ts
const obs = useMemo(() => store.observe(path), [store]);
```

## Worked Example (this repo)

- `src/react/TimelineReport/hooks/useReportLoadingState.ts` — `useReportLoadingState(rd = routeData)` (form 1).
- `src/react/TimelineReport/components/ReportArea.tsx` — pure view (form 2).
- Tests: `hooks/useReportLoadingState.test.tsx` builds a fake `rd` store and streams progress through the real read path; `components/ReportArea.test.tsx` renders every state from props. Neither uses `vi.mock`.

## Migration Bonus

Defaulting a dependency to its singleton decouples callers from the global — the same seam a later migration _away_ from that global needs. Testability now, migration groundwork for free.
