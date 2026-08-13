export const reportsStorageKeys = {
  all: ['reports-storage'] as const,
  config: () => [...reportsStorageKeys.all, 'config'] as const,
  spaceIssueTypes: (spaceName: string) => [...reportsStorageKeys.all, 'space-issue-types', spaceName] as const,
};
