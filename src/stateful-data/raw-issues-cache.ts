/**
 * Singleflight for `getRawIssues` — spec/016-report-of-reports/005-optimize/001-request-dedupe,
 * Phase 2.
 *
 * A document builds one `ChildReportConfig` per embedded report and each runs its own complete fetch
 * cascade, so N reports over one JQL issue N identical cascades at once. With `loadChildren` that is
 * N × (count + search + changelog bulkfetch + ~25 recursive child batches, each with its own three
 * calls) — which is what puts the app into Jira's 429s. This collapses byte-identical requests onto
 * one in-flight load and fans its progress out to every caller.
 *
 * Entries live in a `WeakMap` keyed by `jiraHelpers`, so a different Jira site physically cannot reach
 * another site's entries and the whole map is collected with the helpers it belongs to.
 */

/** The mutable progress object both loaders expect: a callback carrying a `.data` they own. */
export interface ProgressCallback {
  (data: unknown): void;
  data?: unknown;
}

type Subscriber = (data: unknown) => void;

interface Entry {
  /** The shared load. Every caller receives this exact promise, hence the same resolved array. */
  promise: Promise<unknown> | null;
  progress: ProgressCallback;
  /**
   * Keyed, not appended. `rawIssuesPromise` builds a NEW arrow closure on every recompute, and a
   * config can legitimately recompute onto the same key, so appending would register a second
   * callback for one observable — every tick would write it twice and re-render twice.
   */
  subscribers: Map<unknown, Subscriber>;
  /** `null` while in flight; a timestamp once fulfilled. See `TTL_MS`. */
  expiresAt: number | null;
  settled: boolean;
}

/**
 * How long a *settled* result stays reusable, timed from settle rather than from call.
 *
 * Singleflight already covers requests overlapping in time, which is the whole mount cascade. This
 * covers what that misses: a report added to an open document, or one remounted by an ancestor
 * re-render. 30 s comfortably spans that, sits far below any human "I changed something in Jira, let
 * me look again" loop (which goes through a page reload today, clearing this entirely), and bounds
 * the one genuine staleness case — jql A → B → A inside 30 s serves the cached A.
 *
 * `makeCacheable`'s 1 s is right for `getServerInfo` and wrong here; it also times from *call*, so a
 * 40 s deep-children load would expire while still in flight.
 */
const TTL_MS = 30_000;

let caches = new WeakMap<object, Map<string, Entry>>();

function cacheFor(jiraHelpers: object): Map<string, Entry> {
  let cache = caches.get(jiraHelpers);

  if (!cache) {
    cache = new Map();
    caches.set(jiraHelpers, cache);
  }

  return cache;
}

/** The entry for `key`, if there is one and it hasn't aged out. Expired entries are evicted here. */
function liveEntry(cache: Map<string, Entry>, key: string): Entry | undefined {
  const entry = cache.get(key);

  if (!entry) return undefined;

  if (entry.expiresAt !== null && Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }

  return entry;
}

/**
 * Register `subscriber` under `owner`, and hand it the progress so far.
 *
 * A report joining mid-flight must not wait for the next tick — under `loadChildren` those can be
 * seconds apart, so its bar would sit empty. Delivery is on a **microtask**, not synchronous:
 * `getRawIssues` runs inside a `value.returnedBy` recompute that has just set `progressData.value =
 * null`, and re-entering that recompute's own observable is avoidable risk for no gain.
 */
function join(entry: Entry, owner: unknown, subscriber: Subscriber): void {
  entry.subscribers.set(owner, subscriber);

  const snapshot = entry.progress.data;

  // No snapshot yet means this caller has missed nothing — deliberately no phantom tick.
  if (snapshot === undefined || entry.settled) return;

  queueMicrotask(() => {
    if (entry.settled) return;
    if (entry.subscribers.get(owner) !== subscriber) return;

    subscriber(entry.progress.data);
  });
}

export interface SharedRawIssuesRequest {
  /** Cache scope. A `WeakMap` key, so it must be an object. */
  jiraHelpers: object;
  key: string;
  /**
   * A stable per-caller token. `state-helpers` passes the config's `progressData` observable: it is
   * the only thing in scope that is one-per-config *and* survives a recompute, and it is what the
   * subscriber writes to anyway.
   */
  owner?: unknown;
  progressUpdate?: Subscriber;
}

/**
 * Run `startLoad` at most once per `key`, or join the load already running for it.
 *
 * `startLoad` receives the shared progress object and must return the load's promise. Callers get
 * back the *same* promise — and therefore the same resolved array — which is what lets the follow-up
 * derived-array cache key off array identity.
 */
export function withSharedRawIssues(
  { jiraHelpers, key, owner, progressUpdate }: SharedRawIssuesRequest,
  startLoad: (progress: ProgressCallback) => Promise<unknown>,
): Promise<unknown> {
  const cache = cacheFor(jiraHelpers);
  // A caller with no `progressUpdate` still needs a distinct identity, or two of them would evict
  // each other; `owner ?? progressUpdate ?? {}` gives every caller a key of its own.
  const ownerKey = owner ?? progressUpdate ?? {};

  const existing = liveEntry(cache, key);

  if (existing) {
    if (progressUpdate) join(existing, ownerKey, progressUpdate);

    // Non-null once the entry is in the map: `startLoad` cannot re-enter this function.
    return existing.promise as Promise<unknown>;
  }

  const subscribers = new Map<unknown, Subscriber>();

  // One progress object per fetch, discarded when it settles. Never reused across keys or across a
  // second load of the same key: it carries `keysWhoseChildrenWeAreAlreadyLoading`, and a retained
  // Set would make the next deep walk skip parents it genuinely needs to expand, silently returning
  // fewer children. One shared request is still exactly one walk, hence one Set scoped to that walk.
  const progress: ProgressCallback = (data: unknown) => {
    for (const subscriber of subscribers.values()) subscriber(data);
  };

  const entry: Entry = { promise: null, progress, subscribers, expiresAt: null, settled: false };

  if (progressUpdate) join(entry, ownerKey, progressUpdate);

  // In the map BEFORE the load starts: the loader runs synchronously to its first `await` and may
  // already touch `progress`.
  cache.set(key, entry);

  const settle = (expiresAt: number | null) => {
    entry.settled = true;
    entry.subscribers.clear();

    if (cache.get(key) !== entry) return;

    if (expiresAt === null) {
      cache.delete(key);
    } else {
      entry.expiresAt = expiresAt;
    }
  };

  let promise: Promise<unknown>;

  try {
    promise = startLoad(progress);
  } catch (error) {
    settle(null);
    throw error;
  }

  entry.promise = promise;

  // Bookkeeping only. Subscribers get `entry.promise` itself, so this handler must not rethrow —
  // that would be a second, genuinely unhandled rejection. Attaching a rejection handler here also
  // means the shared promise is never reported as unhandled while a subscriber is slow to bind.
  promise.then(
    () => settle(Date.now() + TTL_MS),
    // A failure is never cached: the next mount retries. One rejected fetch does reject every report
    // that joined it, where today it would break one — sibling plan 2 (queue + Retry-After) is what
    // makes that recoverable rather than merely rarer.
    () => settle(null),
  );

  return promise;
}

/**
 * Drop every cached entry, for every site.
 *
 * Nothing in production calls this. Tests do — and it is the hook a Refresh button must call, because
 * there is no way to force a data reload today (the only refetch triggers are the four observables
 * `rawIssuesRequestData` listens to, and switching sites does a hard page reload). Whoever adds that
 * button will not think to look here.
 */
export function __clearRawIssuesCache(): void {
  // A `WeakMap` can't be enumerated, so swap the whole thing out: every live `jiraHelpers` gets a
  // fresh, empty cache on its next lookup. Loads already in flight keep running and keep their own
  // subscribers — this drops the sharing, it doesn't cancel anything.
  caches = new WeakMap<object, Map<string, Entry>>();
}
