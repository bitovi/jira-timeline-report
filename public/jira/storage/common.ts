import jiraHelpers from "../../jira-oidc-helpers";

export type StorageFactory = (jiraHelper: ReturnType<typeof jiraHelpers>) => {
  get: <TData>(key: string) => Promise<TData | null>;
  update: <TData>(key: string, value: TData) => Promise<void>;
  storageInitialized: () => Promise<boolean>;
};

export type AppStorage = ReturnType<StorageFactory>;
