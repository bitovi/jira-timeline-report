# Option A — Signals engine behind the existing interface

**Shape:** keep `{ value, on, off, get, set }` and `useCanObservable` exactly as they are. Replace
what produces them: `@preact/signals-core` (~2 KB gzipped) plus a ~350-line adapter that reimplements
the two CanJS APIs this app uses — `value.*` and `ObservableObject`'s `static props`.

**Consumer churn: zero.** All ~57 `useCanObservable` files, ~43 `useRouteData` files, and every
report's `*Obs` prop bag keep compiling untouched. Roughly 12 files change.

## 1. Why signals specifically

CanJS's `Observation` and a signals `computed` are the same primitive with different names, and the
match is not approximate:

| CanJS                               | `@preact/signals-core`                        |
| ----------------------------------- | --------------------------------------------- |
| `Observation` / `value.returnedBy`  | `computed`                                    |
| `SimpleObservable` / `value.with`   | `signal`                                      |
| lazy — computes nothing until bound | lazy — computes nothing until read/subscribed |
| glitch-free, topologically ordered  | glitch-free, topologically ordered            |
| `queues.batch.start()/stop()`       | `batch(fn)`                                   |
| `listenTo(obs, fn)`                 | `effect(fn)`                                  |

That matters because `route-data.js` leans on all four properties. A store that recomputes eagerly,
or that can show a derived value built from half-updated inputs, would surface as intermittent
double-fetches and flicker — the exact class of bug the comments at `route-data.js:410-421` and
`useCanObservable.ts:26-40` were written to fix.

## 2. `src/observable/value.ts` — the `value.*` adapter

```ts
import { signal, computed, effect, untracked, batch, type Signal } from '@preact/signals-core';

export interface Observable<T> {
  value: T;
  get(): T;
  set(value: T): void;
  getData(): T;
  on(handler: () => void): void;
  off(handler: () => void): void;
}

/** Run `handler` on every change AFTER the first evaluation — CanJS `listenTo` semantics. */
function onChange<T>(read: () => T, handler: (value: T) => void): () => void {
  let first = true;
  return effect(() => {
    const value = read();
    if (first) {
      first = false;
      return;
    }
    untracked(() => handler(value));
  });
}

function wrap<T>(read: () => T, write?: (value: T) => void): Observable<T> {
  const disposers = new Map<Function, () => void>();
  return {
    get value() {
      return read();
    },
    set value(v: T) {
      write?.(v);
    },
    get: read,
    getData: read,
    set: (v) => write?.(v),
    on(handler) {
      disposers.set(handler, onChange(read, handler as () => void));
    },
    off(handler) {
      disposers.get(handler)?.();
      disposers.delete(handler);
    },
  };
}

const readKeyPath = (root: any, path: string) => path.split('.').reduce((o, seg) => (o == null ? o : o[seg]), root);

export const value = {
  /** One-way read of `obj[keyPath]`, or of `obj.value` when no path is given. */
  from: <T>(obj: any, keyPath?: string): Observable<T> => wrap(() => (keyPath ? readKeyPath(obj, keyPath) : obj.value)),

  /** Two-way: reads like `from`, writes straight back through the key path's last segment. */
  bind: <T>(obj: any, keyPath?: string): Observable<T> =>
    wrap(
      () => (keyPath ? readKeyPath(obj, keyPath) : obj.value),
      (v) => {
        if (!keyPath) {
          obj.value = v;
          return;
        }
        const segments = keyPath.split('.');
        const last = segments.pop()!;
        (segments.length ? readKeyPath(obj, segments.join('.')) : obj)[last] = v;
      },
    ),

  /** A settable standalone observable. */
  with: <T>(initial: T): Observable<T> => {
    const s = signal(initial);
    return wrap(
      () => s.value,
      (v) => {
        s.value = v;
      },
    );
  },

  /** A derived observable — recomputes when anything read inside `getter` changes. */
  returnedBy: <T>(getter: () => T, context?: unknown): Observable<T> => {
    const c = computed(getter.bind(context ?? null) as () => T);
    return wrap(() => c.value);
  },
};

export { batch };
export const isObservable = (v: any): v is Observable<unknown> =>
  !!v && typeof v.on === 'function' && typeof v.off === 'function';
```

Deep key paths (`'derivedIssuesRequestData.progressData.value.issuesRequested'`,
`useReportLoadingState.ts:59`) work without special handling: each segment that is signal-backed
registers as a dependency when the `computed` reads it, and plain segments simply don't.

## 3. `src/observable/define-props.ts` — the `static props` adapter

This is the real work. All five prop forms from
[`surface-area.md`](./surface-area.md) §4 and all three `listenTo` forms have to survive.

```ts
type Resolver<T> = (ctx: {
  resolve(value: T): void;
  lastSet: Channel<T>;
  listenTo(source: string | Observable<any> | Channel<any>, handler: (payload?: any) => void): void;
}) => void;

export type PropSpec<T> =
  | { default?: T | (() => T); enumerable?: boolean; type?: unknown }
  | { get(): T; enumerable?: boolean }
  | { async(resolve: (v: T) => void): Promise<T> | void }
  | { value: Resolver<T>; enumerable?: boolean; serialize?(v: T): string };

const CELLS = new WeakMap<object, Map<string, Cell>>();

export function defineProps<C extends new (...a: any[]) => any>(Class: C, props: Record<string, PropSpec<any>>) {
  for (const [key, spec] of Object.entries(props)) {
    Object.defineProperty(Class.prototype, key, {
      configurable: true,
      enumerable: (spec as any).enumerable ?? true,
      get() {
        return cell(this, key, spec).read();
      },
      set(v) {
        cell(this, key, spec).write(v);
      },
    });
  }
  Object.defineProperty(Class, '__props', { value: props });
}
```

The four cell kinds:

```ts
function makeCell(host: any, key: string, spec: any): Cell {
  // 3a. computed getter
  if (typeof spec.get === 'function' && !('default' in spec)) {
    const c = computed(() => spec.get.call(host));
    return { read: () => c.value, write: noop };
  }

  // 3b. async
  if (typeof spec.async === 'function') {
    const out = signal<any>(undefined);
    let started = false;
    return {
      read() {
        if (!started) {
          started = true;
          untracked(() =>
            Promise.resolve(spec.async.call(host, (v: any) => (out.value = v))).then((v) => {
              if (v !== undefined) out.value = v;
            }),
          );
        }
        return out.value;
      },
      write: (v) => {
        out.value = v;
      },
    };
  }

  // 3c. imperative resolver — the workhorse
  if (typeof spec.value === 'function') return resolverCell(host, spec.value);

  // 3d. plain default (incl. `get default()`)
  const initial =
    typeof spec.default === 'function'
      ? spec.default.call(host)
      : (Object.getOwnPropertyDescriptor(spec, 'default')?.get?.call(host) ?? spec.default);
  const s = signal(initial);
  return {
    read: () => s.value,
    write: (v) => {
      s.value = v;
    },
  };
}

function resolverCell(host: any, setup: Resolver<any>): Cell {
  const out = signal<any>(undefined);
  const lastSet = channel();
  let started = false;

  // Deferred out of any surrounding computed: `setup` creates effects that fire
  // synchronously and call `resolve()`, i.e. it WRITES while we are being READ.
  const start = () => {
    if (started) return;
    started = true;
    untracked(() =>
      setup.call(host, {
        resolve: (v: any) => {
          out.value = v;
        },
        lastSet,
        listenTo(source, handler) {
          if (typeof source === 'string') {
            onChange(
              () => host[source],
              (v) => handler({ value: v }),
            ); // form 1
          } else if (isChannel(source)) {
            source.subscribe(handler); // form 3: lastSet
          } else {
            onChange(() => source.value, handler); // form 2
          }
        },
      }),
    );
  };

  return {
    read() {
      start();
      return out.value;
    },
    write(v) {
      start();
      lastSet.emit(v);
    },
  };
}

/** `lastSet` — an event channel, not a value. Only `listenTo` consumes it. */
function channel<T>() {
  const subs = new Set<(v: T) => void>();
  return {
    __channel: true as const,
    value: undefined as T | undefined,
    subscribe(fn: (v: T) => void) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    emit(v: T) {
      this.value = v;
      for (const fn of [...subs]) fn(v);
    },
  };
}
```

Plus the small change: `assign()`, `serialize()`, `on(key, handler)` as a base class or mixin (~40
lines), and `diff.list` / `diff.map` as ~30 lines of shallow comparison — both are only ever used as
`diff.x(a, b).length` meaning "did it change".

## 4. Worked example — `allFieldsToRequest`

The gated-emission field union at `route-data.js:422-448`. Today:

```js
allFieldsToRequest: {
  value({ resolve, listenTo }) {
    let current, resolved = false;
    const recompute = () => {
      const baseFields = this.fieldsToRequest;
      const next = baseFields ? [...new Set([...baseFields, ...this.tableColumnFields])] : undefined;
      let changed;
      if (!resolved || (next === undefined) !== (current === undefined)) changed = true;
      else if (next && current) changed = !sameRequestedFields(next, current, CORE_FIELDS, this.fieldMaps);
      else changed = false;
      if (changed) { current = next; resolved = true; resolve(current); }
    };
    listenTo('fieldsToRequest', recompute);
    listenTo('tableColumnFields', recompute);
    listenTo('fieldMaps', recompute);
    recompute();
  },
},
```

Under Option A this compiles **unchanged** — `defineProps` implements the same protocol. That is the
whole point: `route-data.js` can be ported mechanically, one prop at a time, with the diff limited to
the import line.

But it _can_ also be simplified, because the three explicit `listenTo`s are exactly the three reads
`recompute` already does:

```ts
allFieldsToRequest: derived(function () {
  const base = this.fieldsToRequest;
  return base ? [...new Set([...base, ...this.tableColumnFields])] : undefined;
}, {
  // Emit only when the CANONICAL id set changes, so adding a column whose field is
  // already always-loaded doesn't trigger a refetch. Same guard, expressed as equality
  // rather than as a manual `resolved`/`current` ledger.
  equals: (a, b) =>
    a === b || (!!a && !!b && sameRequestedFields(a, b, CORE_FIELDS, this.fieldMaps)),
}),
```

Nine lines instead of twenty-five, and the dependency list can no longer drift from the reads. That
is the upgrade path Option A unlocks: mechanical port first, simplify per-prop afterwards, both
behind an unchanged public interface.

## 5. What changes

| File                                                                | Change                                                                        |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/can.js`, `src/can.d.ts`                                        | **deleted** (1.47 MB)                                                         |
| `src/observable/{value,define-props,diff,index}.ts`                 | **new**, ~350 lines, fully typed and unit-tested                              |
| `src/routing/url-store.ts`                                          | **new** — see [`routing.md`](./routing.md)                                    |
| `src/canjs/routing/state-storage.js`                                | → `src/routing/params.ts` + deleted (~200 of its 468 lines are dead comments) |
| `src/canjs/routing/route-data/route-data.js`                        | → `src/state/route-data.ts`; import swap + per-prop simplification            |
| `ChildReportConfig.js`, `login.js`, `timeline-report-view-model.js` | import swap; `extends ObservableObject` → `defineProps(Class, {...})`         |
| `main-helper.js`, `plugin.main.ts`, `web.main.ts`                   | `route` → `urlStore`; delete the dead `domEvents` line                        |
| `TimelineReport.tsx:132-135`                                        | `queues.batch.start()/stop()` → `batch(() => {...})`                          |
| ~100 consumer files                                                 | **none**                                                                      |
| 9 test fakes                                                        | `extends ObservableObject` → `defineProps`                                    |

## 6. Risks

**The `start()`-during-read hazard is the one real unknown.** A resolver cell starts lazily on first
read, and `setup` immediately creates effects that call `resolve()` — a signal write during a signal
read. `untracked()` should contain it, but preact-signals throws "Cycle detected" for some
write-during-compute shapes. **Prototype `resolverCell` against the five gnarliest props
(`selectedIssueType`, `toIssueType`, `timingCalculations`, `fieldsToRequest`, `allFieldsToRequest`)
before committing to this option.** If it doesn't hold, the fallback is eager start on construction,
which costs the laziness that `useCanObservable.ts:26-40` currently depends on — survivable, but it
changes that hook.

**Effect timing is not identical.** CanJS runs handlers through `queues` (deriveQueue → domQueue →
mutateQueue); signals flush at the end of the enclosing `batch` or synchronously otherwise. Ordering
between two handlers on the same change may differ. Most likely to show up in the self-healing
`selectedIssueType`/`toIssueType` pair, which write to the URL from inside a resolve.

**We still own an adapter.** ~350 lines of reactive glue is much less than 1.47 MB, but it is not
zero, and it is the kind of code that is subtle to debug.

## 7. Sequencing

1. Build `src/observable/*` + `src/routing/url-store.ts` with their own unit tests. Nothing else
   imports them yet. **Includes the `resolverCell` spike above.**
2. Port `Login` (4 booleans) and `TimelineReportViewModel` (pure getters) — the two easy classes.
   Run the suite.
3. Swap the URL layer: `state-storage.js` → `url-store.ts` + `params.ts`, collapsing `CHILD_PARAMS`
   and `route-data.js`'s schema into one registry. Delete the drift test.
4. Port `RouteData` and `ChildReportConfig` onto `defineProps`, prop by prop, mechanically.
5. Delete `src/can.js`, `src/can.d.ts`, `src/canjs/`. Verify the bundle.
6. _(Optional, later, incremental.)_ Simplify individual props to `derived(...)`; migrate individual
   consumers off `useCanObservable` toward `useSyncExternalStore` — the destination
   [Option C](./option-c-react-idiomatic.md) describes, reached without a big-bang rewrite.

**Rough size:** steps 1–5 are the deliverable. Step 6 has no deadline and can be done by anyone,
one file at a time.
