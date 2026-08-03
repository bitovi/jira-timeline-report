# Option B — Write the reactive core ourselves

**Shape:** identical to [Option A](./option-a-signals-adapter.md) from the outside — same
`Observable` interface, same `value.*`, same `defineProps`, same zero consumer churn. The difference
is the ~150 lines underneath: instead of `@preact/signals-core`, we write `Signal` / `Computed` /
`Effect` / `batch`.

Read Option A first. Everything in its §2 (`value.ts`), §3 (`define-props.ts`), §4 (worked example)
and §5 (files changed) applies verbatim. This document covers only what differs.

## 1. Why you'd choose this

- **No new dependency.** The app runs in an Atlassian Connect iframe and a Forge context; the fewer
  third-party runtime deps in that bundle, the fewer questions at review time.
- **It removes Option A's two named risks by construction.** A §6 flags (a) preact-signals throwing
  "Cycle detected" on the write-during-read shape `resolverCell` needs, and (b) effect-flush timing
  differing from CanJS's `queues`. Both are _our_ semantics here. If a resolver needs to write while
  being read, we allow it, deliberately and with a test. If CanJS's derive→dom→mutate queue ordering
  turns out to be load-bearing for the self-healing `selectedIssueType`/`toIssueType` pair, we
  reproduce it.
- **Debuggability.** A stack trace goes through code in this repo rather than a minified dependency
  — which is the single biggest day-to-day complaint about the current `src/can.js`.

## 2. `src/observable/core.ts`

The standard lazy-pull algorithm: computeds recompute on read when dirty; effects are deferred to the
end of the batch. That combination is glitch-free _without_ a topological sort, because by the time
anything pulls, every write in the batch has already landed.

```ts
type Node = Computed<any> | Effect;

let active: Node | null = null;
let batchDepth = 0;
const queued = new Set<Effect>();

export class Signal<T> {
  #value: T;
  #subs = new Set<Node>();

  constructor(value: T) {
    this.#value = value;
  }

  get value(): T {
    active?.dependOn(this, this.#subs);
    return this.#value;
  }

  set value(next: T) {
    if (Object.is(next, this.#value)) return;
    this.#value = next;
    // Copy: invalidation can mutate the set.
    for (const sub of [...this.#subs]) sub.invalidate();
    flush();
  }

  /** Called by dependents when they drop us. */
  unsubscribe(node: Node) {
    this.#subs.delete(node);
  }
}

abstract class Reactive {
  protected deps = new Map<{ unsubscribe(n: Node): void }, Set<Node>>();

  dependOn(source: any, subs: Set<Node>) {
    subs.add(this as unknown as Node);
    this.deps.set(source, subs);
  }

  /** Deps change between runs; drop the stale ones or we leak and over-fire. */
  protected releaseDeps() {
    for (const [, subs] of this.deps) subs.delete(this as unknown as Node);
    this.deps.clear();
  }

  protected run<T>(fn: () => T): T {
    const previous = active;
    active = this as unknown as Node;
    this.releaseDeps();
    try {
      return fn();
    } finally {
      active = previous;
    }
  }

  abstract invalidate(): void;
}

export class Computed<T> extends Reactive {
  #value!: T;
  #dirty = true;
  #subs = new Set<Node>();

  constructor(
    private fn: () => T,
    private equals = Object.is,
  ) {
    super();
  }

  get value(): T {
    active?.dependOn(this, this.#subs);
    if (this.#dirty) {
      const next = this.run(this.fn);
      this.#dirty = false;
      // Equality gate: a recompute to the same value must NOT wake dependents. This is
      // what makes route-data's "don't refetch when the field set didn't really change"
      // guard (route-data.js:422-448) expressible as `equals` instead of a manual ledger.
      if (!this.equals(next, this.#value)) this.#value = next;
    }
    return this.#value;
  }

  invalidate() {
    if (this.#dirty) return; // already marked; don't re-walk the graph
    this.#dirty = true;
    for (const sub of [...this.#subs]) sub.invalidate();
  }

  unsubscribe(node: Node) {
    this.#subs.delete(node);
  }
}

export class Effect extends Reactive {
  #disposed = false;
  constructor(private fn: () => void) {
    super();
    this.execute();
  }

  execute() {
    if (!this.#disposed) this.run(this.fn);
  }
  invalidate() {
    queued.add(this);
    if (batchDepth === 0) flush();
  }
  dispose() {
    this.#disposed = true;
    this.releaseDeps();
    queued.delete(this);
  }
}

function flush() {
  if (batchDepth > 0 || queued.size === 0) return;
  batchDepth++; // reentrancy guard
  try {
    // Effects scheduled BY an effect run in the same flush — matches CanJS's queues,
    // which drain to empty rather than snapshotting.
    while (queued.size) {
      const next = queued.values().next().value as Effect;
      queued.delete(next);
      next.execute();
    }
  } finally {
    batchDepth--;
  }
}

export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    flush();
  }
}

export function untracked<T>(fn: () => T): T {
  const previous = active;
  active = null;
  try {
    return fn();
  } finally {
    active = previous;
  }
}

export const signal = <T>(v: T) => new Signal(v);
export const computed = <T>(fn: () => T, equals?: (a: T, b: T) => boolean) => new Computed(fn, equals);
export const effect = (fn: () => void) => {
  const e = new Effect(fn);
  return () => e.dispose();
};
```

That is the whole core. `value.ts` and `define-props.ts` from Option A sit on top of it with their
imports repointed from `@preact/signals-core` to `./core`.

## 3. Be honest about what the last 10% costs

The 150 lines above are _correct for this app's graph_, but a maintained signals library earns its
2 KB on cases this doesn't cover. Each is a decision to make explicitly, not discover in production:

| Gap                             | What happens                                                                                                                                                                                      | Fix                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Un-batched diamond writes**   | Two writes outside a `batch()` flush effects twice; an effect can observe the graph mid-update.                                                                                                   | Auto-batch to a microtask, or require `batch()` at every write boundary (the URL store already is one).                    |
| **Cycle detection**             | A computed that reads itself recurses until the stack blows, with a useless trace.                                                                                                                | A `computing` flag + a thrown error naming the prop. ~10 lines, worth it.                                                  |
| **Orphaned computeds**          | A `Computed` nobody subscribes to keeps its deps registered forever. With ~85 props on a singleton that lives for the session, this is bounded — but `ChildReportConfig` is per-child and churns. | Refcount subs; release deps at zero. ~20 lines. **Do not skip this one** — report-of-reports creates and destroys configs. |
| **Async resolve after dispose** | A promise resolving into a disposed cell writes a dead signal.                                                                                                                                    | Disposal check in `resolve`.                                                                                               |
| **Dev ergonomics**              | No `name`, no dependency inspector, no "why did this recompute".                                                                                                                                  | A `__DEV__` label on each node + a `window.__signals` dump. Cheap and pays for itself.                                     |

Budget realistically: ~150 lines for the core, another ~100 for the gaps above, plus a genuinely
thorough test suite for the core itself — this is code where a subtle bug looks like a UI flicker
three layers away, so it needs a higher test standard than app code.

## 4. Versus Option A

|                                    | A — signals lib                  | B — in-house                      |
| ---------------------------------- | -------------------------------- | --------------------------------- |
| New runtime dependency             | yes (~2 KB gz)                   | no                                |
| Lines we maintain                  | ~350 adapter                     | ~600 (adapter + core + gap fixes) |
| Scheduling semantics               | theirs; may differ from `queues` | ours; can match `queues` exactly  |
| Write-during-read (`resolverCell`) | **needs a spike** — may throw    | allowed by construction           |
| Correctness of the core            | battle-tested by many apps       | tested by us only                 |
| Debugging a reactivity bug         | into a dependency                | into this repo                    |
| Consumer churn                     | zero                             | zero                              |

**They are the same option with a different build-vs-buy answer**, and the choice is reversible: the
`value.ts` / `define-props.ts` boundary means swapping the core later is a ~20-line import change.
A defensible sequence is to start with A, and if the `resolverCell` spike in A §6 fails, drop in this
core rather than redesigning.

## 5. Sequencing

Identical to Option A §7, with step 1 expanded: build and test `core.ts` on its own — diamond
dependencies, equality gating, disposal, batch reentrancy, un-batched writes — before anything in
`src/` imports it.
