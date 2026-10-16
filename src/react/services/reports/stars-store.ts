import { STARS_GET, STARS_SET } from '../../../forge-resolver/contract';

/**
 * Where the current user's starred saved-report ids live. One list per user, never shared: stars
 * are personal, and a shared map would be a read-modify-write race between users. See
 * spec/041-saved-reports-redesign/phase1/plan.md § 5.
 *
 * The value is report ids only. Ids of reports that were since deleted stay in the list and are
 * never shown, because every view intersects it with `useAllReports`.
 */
export interface StarsStore {
  read(): Promise<string[]>;
  write(ids: string[]): Promise<void>;
}

/**
 * Writes queued per store, so one store never has two writes in flight. Every write replaces the
 * whole list, and on Forge each is its own resolver call with no ordering guarantee — star A then B
 * sends `[A]` and `[A, B]`, and if `[A]` landed last, B would vanish on reload. One at a time, the
 * last write is always the latest list. Keyed by store rather than per hook, because home and the
 * Saved Reports page can both be mounted over the same store.
 */
const writeQueues = new WeakMap<StarsStore, Promise<void>>();

/** Writes `ids` after every write already queued on `store`, whether those succeed or fail. */
export const enqueueStarsWrite = (store: StarsStore, ids: string[]): Promise<void> => {
  const queued = (writeQueues.get(store) ?? Promise.resolve()).catch(() => {}).then(() => store.write(ids));

  writeQueues.set(store, queued);

  return queued;
};

/** Resolves once every write queued on `store` so far has settled. Never rejects. */
export const starsWritesSettled = (store: StarsStore): Promise<void> =>
  (writeQueues.get(store) ?? Promise.resolve()).catch(() => {});

/** Anything that isn't a `string[]` reads as no stars, rather than throwing over a corrupt value. */
export const toStarIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];

/** `${JIRA_APP_KEY ?? scopeId}-starred-reports[-${accountId}]`, mirroring `useRecentReports`. */
export const localStarsKey = (accountId: string | null): string => {
  const prefix = window.env?.JIRA_APP_KEY || window.localStorage.getItem('scopeId');
  const base = `${prefix}-starred-reports`;

  return accountId ? `${base}-${accountId}` : base;
};

/**
 * The website: localStorage, per account. Stars are per browser — the same trade-off recents make.
 *
 * Takes the account id lazily, because the store is built at boot and the id is only known once
 * the identity reader has answered.
 */
export const createLocalStarsStore = (
  readAccountId: () => Promise<string | null>,
  storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage,
): StarsStore => ({
  read: async () => {
    const raw = storage.getItem(localStarsKey(await readAccountId()));

    if (!raw) {
      return [];
    }

    try {
      return toStarIds(JSON.parse(raw));
    } catch {
      console.warn('Ran into an unexpected value deserializing starred reports', raw);

      return [];
    }
  },
  write: async (ids) => {
    storage.setItem(localStarsKey(await readAccountId()), JSON.stringify(ids));
  },
});

/** Just `@forge/bridge`'s `invoke`, so this module stays free of the bridge and tests can fake it. */
export type ForgeInvoke = (functionKey: string, payload?: Record<string, unknown>) => Promise<unknown>;

/**
 * Forge: KVS, through the resolver's `stars.get` / `stars.set`. The resolver builds the key from
 * the invocation context's account id, so nothing here names whose stars these are — that is what
 * stops one user reading or writing another's.
 */
export const createForgeStarsStore = (invoke: ForgeInvoke): StarsStore => ({
  read: async () => {
    const { value } = ((await invoke(STARS_GET)) ?? {}) as { value?: unknown };

    return toStarIds(value);
  },
  write: async (ids) => {
    await invoke(STARS_SET, { ids });
  },
});
