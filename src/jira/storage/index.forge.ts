import { requestJira } from '@forge/bridge';

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
