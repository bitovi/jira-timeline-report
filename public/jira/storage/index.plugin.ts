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

export const jiraPluginStorage: StorageFactory = (jiraHelpers) => {
  return {
    async canUseStorage() {
      return true;
    },
    async get<TData>(key: string): Promise<TData> {
      if (!AP) {
        throw new Error("[Storage Error]: get (plugin) can only be used when connected with jira.");
      }

      // todo add catch and rethrow for custom 404
      return AP.request<{ body: string }>(
        `/rest/atlassian-connect/1/addons/${jiraHelpers.appKey}/properties/${key}`
      ).then((res) => {
        const parsed = JSON.parse(res.body) as AppPropertyResponse<TData>;

        return parsed.value;
      });
    },
    async update<TData>(key: string, value: TData): Promise<void> {
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
    },
  };
};
