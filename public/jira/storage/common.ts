import jiraHelpers from "../../jira-oidc-helpers";

export type StorageFactory = (jiraHelper: ReturnType<typeof jiraHelpers>) => {
  get: <TData>(key: string) => Promise<TData>;
  update: <TData>(key: string, value: TData) => Promise<void>;
  storageContainerExists: (key: string) => Promise<Boolean>;
  createStorageContainer: <TData>(key: string, value: TData) => Promise<void>;
};

export type AppStorage = ReturnType<StorageFactory>;
