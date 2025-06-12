import type { StorageFactory } from './common';

declare global {
  const AP: AP | undefined;

  interface AP {
    request: <T = unknown>(
      url: string,
      config?: {
        contentType?: string;
        type?: 'GET' | 'PUT';
        headers?: Record<string, string>;
        data?: any;
      },
    ) => Promise<T>;
  }
}

interface AppPropertyResponse<TData = unknown> {
  key: string;
  value: TData;
  self: string;
}

const createUpdate = (jiraHelpers: Parameters<StorageFactory>[number]) => {
  return async function update<TData>(key: string, value: TData): Promise<void> {
    if (!AP) {
      throw new Error('[Storage Error]: update (plugin) can only be used when connected with jira.');
    }

    return AP.request<void>(`/rest/atlassian-connect/1/addons/${jiraHelpers.appKey}/properties/${key}`, {
      type: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      data: JSON.stringify(value),
    });
  };
};

export const createJiraPluginStorage: StorageFactory = (jiraHelpers) => {
  return {
    // if they're in the plugin app data gets initialized in the get
    storageInitialized: async () => true,
    get: async function <TData>(key: string, defaultShape: unknown = {}): Promise<TData | null> {
      if (!AP) {
        throw new Error('[Storage Error]: get (plugin) can only be used when connected with jira.');
      }

      return AP.request<{ body: string }>(`/rest/atlassian-connect/1/addons/${jiraHelpers.appKey}/properties/${key}`)
        .then((res) => {
          const parsed = JSON.parse(res.body) as AppPropertyResponse<TData>;

          return parsed.value;
        })
        .catch((error) => {
          if ('err' in error) {
            const parsed = JSON.parse(error.err) as { statusCode: number; message: string };

            if (parsed.statusCode === 404) {
              const createContainer = createUpdate(jiraHelpers);
              const newValue = defaultShape as TData;

              return createContainer(key, newValue).then(() => newValue);
            }
          }
          throw error;
        });
    },
    update: createUpdate(jiraHelpers),
  };
};
