import { invoke, requestJira } from '@forge/bridge';

import { STORAGE_GET, STORAGE_SET } from '../../forge-resolver/contract';

import type { StorageFactory } from './common';

/**
 * The Forge host's storage, backed by **Connect app properties**.
 *
 * Not the configuration-issue store the website uses. Every existing customer's saved reports live
 * in one Connect app property (`reports-config.ts` — `legacy` is what every install has today), and
 * a Forge app can reach those "as long as they are stored against the same `app.connect.key`"
 * — [Extending your app](https://developer.atlassian.com/platform/adopting-forge-from-connect/extending-your-app/).
 *
 * That is what makes the Connect→Forge cutover invisible: the Forge modules read and write the store
 * the Connect modules already used, so nobody has to migrate anything. Verified end to end on
 * 2 Sep 2026 against the `prodcheck` environment — see
 * spec/021-forge/next-steps/status-2026-09-02.md.
 *
 * **This only works while the manifest declares `app.connect.key`.** Dropping the key severs access;
 * the data has to be copied out first.
 */
interface AppPropertyResponse<TData = unknown> {
  key: string;
  value: TData;
  self: string;
}

const propertyPath = (appKey: string, key: string) => `/rest/atlassian-connect/1/addons/${appKey}/properties/${key}`;

const jsonHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' };

const createUpdate = (appKey: string) =>
  async function update<TData>(key: string, value: TData): Promise<void> {
    const response = await requestJira(propertyPath(appKey, key), {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(value),
    });

    if (!response.ok) {
      throw new Error(`[Storage Error]: could not write "${key}" to app properties (${response.status})`);
    }
  };

export const createForgeConnectStorage: StorageFactory = (jiraHelpers) => {
  const { appKey } = jiraHelpers;
  const update = createUpdate(appKey);

  return {
    // Nothing to provision: unlike the web host's configuration issue, the property store exists as
    // soon as something writes to it.
    storageInitialized: async () => true,

    get: async function <TData>(key: string, defaultShape: unknown = {}): Promise<TData | null> {
      const response = await requestJira(propertyPath(appKey, key));

      // A site that has never saved has no property at all. Seed it rather than returning null, so
      // callers see the same shape they would on Connect (index.plugin.ts:57-64).
      if (response.status === 404) {
        const seeded = defaultShape as TData;

        await update(key, seeded);

        return seeded;
      }

      // Distinguished from the 404 above on purpose: a permissions failure or an outage must not
      // look like "no reports yet", which would silently hand the user an empty app.
      if (!response.ok) {
        throw new Error(`[Storage Error]: could not read "${key}" from app properties (${response.status})`);
      }

      const parsed = (await response.json()) as AppPropertyResponse<TData>;

      return parsed.value;
    },

    update,
  };
};

/**
 * Reads one Connect app property **without seeding it** — `undefined` when it was never written.
 *
 * Standalone rather than a `StorageFactory` method, because only the one-time Connect→KVS migration
 * needs it (spec/021-forge/resolver-storage/migration-option.plan.md). It exists because
 * `createForgeConnectStorage().get()` PUTs `defaultShape` back on a 404: probing with that would
 * *create* the property, and every fresh install would be offered a migration of the defaults it
 * had just written.
 *
 * The same 404-vs-error split as `get()` above: only a missing property is "nothing there". Any
 * other failure throws, so an outage cannot pass for "nothing to migrate".
 */
export const peekConnectProperty = async <TData>(appKey: string, key: string): Promise<TData | undefined> => {
  // Without this, `/addons/undefined/...` 404s and reads as "never written" — a missing app key
  // would silently look like an install with nothing to migrate.
  if (!appKey) {
    throw new Error(`[Storage Error]: cannot read "${key}" from app properties without an app key`);
  }

  const response = await requestJira(propertyPath(appKey, key));

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`[Storage Error]: could not read "${key}" from app properties (${response.status})`);
  }

  const parsed = (await response.json()) as AppPropertyResponse<TData>;

  return parsed.value;
};

/**
 * The resolver answers in an envelope rather than returning the value bare, so that "the key holds
 * `undefined`" and "the key was never written" cannot be confused on the way back across `invoke`.
 */
interface KvsReadResponse<TData = unknown> {
  value: TData | undefined;
}

/**
 * The Forge host's storage, backed by **Forge's own Key-Value Store**.
 *
 * The alternative to `createForgeConnectStorage` above, and the reason both exist: that one reads
 * the Connect app properties existing customers' data already lives in (32 KB per value), this one
 * reads KVS (240 KiB per value, no Connect dependency). See
 * spec/021-forge/resolver-storage/plan.md.
 *
 * `@forge/kvs` only runs server-side and `@forge/bridge` exports no key-value API, so every call
 * here crosses `invoke()` to the resolver in `src/forge-resolver/index.ts`. That indirection is the
 * whole reason this app has a backend at all.
 *
 * Takes no `jiraHelpers`: unlike the Connect store there is no `appKey` to address, because KVS is
 * already namespaced to this app installation.
 */
export const createForgeKvsStorage: StorageFactory = () => {
  return {
    // Nothing to provision — KVS exists as soon as something writes to it, so a fresh install has
    // no setup step. This `true` is what the whole resolver exists to make possible.
    storageInitialized: async () => true,

    get: async function <TData>(key: string, defaultShape: unknown = {}): Promise<TData | null> {
      // `invoke` is declared `Promise<T | { body: T; metadata }>`. The second shape only happens
      // when a `metadata` argument is passed, which this never does — hence the narrowing cast
      // rather than a branch that could never run.
      const { value } = (await invoke<{ key: string }, KvsReadResponse<TData>>(STORAGE_GET, {
        key,
      })) as KvsReadResponse<TData>;

      // Deliberately unlike the Connect store, which PUTs the default back on a 404. There is no
      // container to create, and a write on every cold read is the expensive KVS operation.
      //
      // Note this only catches a *missing* key: a failed read rejects out of `invoke` and is left
      // to propagate. Collapsing the two would look like "no reports yet" and hand the user an
      // empty app, whose next save overwrites reports that were there all along.
      if (value === undefined) {
        return defaultShape as TData;
      }

      return value;
    },

    update: async function <TData>(key: string, value: TData): Promise<void> {
      await invoke(STORAGE_SET, { key, value });
    },
  };
};
