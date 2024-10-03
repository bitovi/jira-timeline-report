import type { StorageFactory } from "./common";

declare global {
  const AP: AP | undefined;

  interface AP {
    request: <T = unknown>(
      url: string,
      config?: {
        type?: "GET" | "PUT";
        headers: Record<string, string>;
        data: any;
      }
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
      throw new Error("[Storage Error]: update (plugin) can only be used when connected with jira.");
    }

    return AP.request<void>(`/rest/atlassian-connect/1/addons/${jiraHelpers.appKey}/properties/${key}`, {
      type: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: JSON.stringify(value),
    });
  };
};

export const createJiraPluginStorage: StorageFactory = (jiraHelpers) => {
  return {
    storageContainerExists: async function (key) {
      if (!AP) {
        throw new Error("[Storage Error]: canUseStorage (plugin) can only be used when connected with jira.");
      }

      return AP.request<{ body: string }>(`/rest/atlassian-connect/1/addons/${jiraHelpers.appKey}/properties`).then(
        (res) => {
          const parsed = JSON.parse(res.body) as { keys: Array<{ key: string; self: string }> };

          return !!parsed.keys.find((keyData) => keyData.key === key);
        }
      );
    },
    get: async function <TData>(key: string): Promise<TData> {
      if (!AP) {
        throw new Error("[Storage Error]: get (plugin) can only be used when connected with jira.");
      }

      return AP.request<{ body: string }>(
        `/rest/atlassian-connect/1/addons/${jiraHelpers.appKey}/properties/${key}`
      ).then((res) => {
        const parsed = JSON.parse(res.body) as AppPropertyResponse<TData>;

        return parsed.value;
      });
    },
    update: createUpdate(jiraHelpers),
    createStorageContainer: createUpdate(jiraHelpers),
  };
};
