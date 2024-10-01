import jiraHelpers from "../../jira-oidc-helpers";

export type StorageFactory = (jiraHelper: ReturnType<typeof jiraHelpers>) => {
  get: <TData>(key: string) => Promise<TData>;
  update: <TData>(key: string, value: TData) => Promise<void>;
  canUseStorage: () => Promise<Boolean>;
};
