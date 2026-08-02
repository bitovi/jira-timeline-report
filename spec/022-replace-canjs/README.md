# 022 — Remove CanJS entirely

CanJS is the last piece of the pre-React architecture still load-bearing. `spec/011-react-rewrite`
converted every view; what remains is the _state layer_: a 1.47 MB vendored bundle (`src/can.js`)
that supplies the reactive graph behind `routeData`, the URL observable behind every query param,
and the observable objects behind four classes.

This folder explores **how to get rid of it** and what each approach actually looks like in code.
Nothing here is decided yet — `plan.md` will be written once an approach is picked.

## Documents

| Doc                                                              | What it covers                                                                                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [`surface-area.md`](./surface-area.md)                           | Exhaustive, verified inventory of what CanJS does in this app. The contract any replacement must satisfy. Read this first.                     |
| [`routing.md`](./routing.md)                                     | **How routing works without CanJS.** Shared by every option below — the URL layer is the same design regardless of which reactive core wins.   |
| [`option-a-signals-adapter.md`](./option-a-signals-adapter.md)   | Keep the observable _interface_, swap the engine for `@preact/signals-core` behind a ~350-line adapter.                                        |
| [`option-b-in-house-runtime.md`](./option-b-in-house-runtime.md) | Same shape as A, but we write the ~150-line signal core ourselves instead of taking a dependency.                                              |
| [`option-c-react-idiomatic.md`](./option-c-react-idiomatic.md)   | No reactive library at all. `useSyncExternalStore` for URL state, React Query for async, `useMemo` for derived. Delete the observable concept. |
| [`comparison.md`](./comparison.md)                               | Side-by-side matrix, risk analysis, why MobX / Zustand / Valtio / TanStack Router don't get their own option, and a recommendation.            |

## Why do this

- **1.47 MB of vendored source** (`src/can.js`, checked in, unminified, undebuggable) for what
  amounts to ~500 lines of used behaviour. It carries `can-connect`, `can-stache`, `can-query-logic`,
  a DOM-mutation observer shim and a jQuery event bridge — none of which this app uses.
- **Two parallel implementations of the same param schema already exist** — `route-data.js` (shell)
  and `ChildReportConfig.js` (embedded children). They are kept in sync by a drift test. That
  duplication is a direct consequence of CanJS's prop-definition style not being reusable data.
- **The reactive model is invisible to TypeScript.** `src/can.d.ts` is a 36-line hand-written stub;
  `routeData`'s 88 properties are typed through a `typeof RouteData.props` mapped type that
  resolves to prop _descriptors_, not values. Most consumers `@ts-ignore` the import.
- **Onboarding cost.** `value({resolve, listenTo, lastSet})`, `lastSet` as an observable, lazy
  binding semantics, and `queues.batch` are concepts nobody arriving at this codebase in 2026 knows.

## Two independent decisions

They keep getting conflated. They are orthogonal, and the second one is where the churn lives.

**1. What replaces the reactive engine?** → Options A, B, C.

**2. Do the ~100 consumer files change in the same effort?**

Every option can be done either way:

- **Keep the interface.** Preserve `{ value, on, off, get, set }` and `useCanObservable`. All ~57
  files using `useCanObservable`, all ~43 using `useRouteData`, and every report's `*Obs` prop bag
  (`src/react/reports/reportProps.ts`) stay byte-identical. Only ~12 engine files change. CanJS
  leaves in one reviewable PR; consumers modernize later, incrementally, with no deadline.
- **Rewrite consumers too.** No compatibility layer survives, but ~100 files churn and every report
  component's signature changes in the same diff.

Options A and B are written assuming _keep the interface_ (that is most of their appeal). Option C
requires _rewrite consumers_ by construction — that is what makes it Option C.

## The shape of the problem, in numbers

Verified against the tree at `9093c94d`. Details and file:line references in
[`surface-area.md`](./surface-area.md).

|                                                                             |                                                                                                                                                             |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/can.js`                                                                | 1,473,377 bytes, vendored                                                                                                                                   |
| CanJS APIs actually imported                                                | 11 (`ObservableObject`, `value`, `diff`, `type`, `route`, `RoutePushstate`, `queues`, `Reflect`, `domEvents`, `domMutateDomEvents`, + the `can.d.ts` stubs) |
| `value.from` / `.bind` / `.with` / `.returnedBy`                            | ~59 / ~32 / ~25 / 5 call sites                                                                                                                              |
| `ObservableObject` subclasses                                               | **4 in production** (`RouteData`, `ChildReportConfig`, `Login`, `TimelineReportViewModel`) + 9 test fakes                                                   |
| `diff.list` / `diff.map` / `type.Any` / `queues.batch` / `Reflect.getValue` | 6 / 2 / 6 / 2 / 1                                                                                                                                           |
| Distinct `listenTo(...)` forms                                              | **3** (by prop name, by observable, by `lastSet`)                                                                                                           |
| Registered routes                                                           | **0** — `route.register('')` and nothing else                                                                                                               |
| `route` API used outside `can.js`                                           | `route.start()`, `route._onStartComplete`, `route.urlData`                                                                                                  |

## The headline finding

**There is no router to replace.** `src/canjs/routing/state-storage.js:23` registers exactly one
empty rule and every piece of application state lives in the query string. `route.start()`'s only
observable effects are a `popstate` listener, a `history.pushState`/`replaceState` monkeypatch, and
an anchor-click delegate. That is ~130 lines of plain DOM code — see [`routing.md`](./routing.md).

The genuinely hard part is `src/canjs/routing/route-data/route-data.js`: 1,099 lines declaring **88
properties** — 19 computed getters, the rest URL-backed params, async resolvers and injected values —
as one lazily-evaluated, glitch-free dependency graph, including properties that are simultaneously
derived _and_ settable. That is a state-management problem wearing a routing costume, and it is what
Options A/B/C actually differ on.
