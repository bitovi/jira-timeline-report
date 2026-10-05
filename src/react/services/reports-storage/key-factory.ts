export const reportsStorageKeys = {
  all: ['reports-storage'] as const,
  config: () => [...reportsStorageKeys.all, 'config'] as const,
  /** The Connect→KVS migration's flag-then-probe answer. See connect-migration.ts. */
  connectMigration: () => [...reportsStorageKeys.all, 'connect-migration'] as const,
  spaceIssueTypes: (spaceName: string) => [...reportsStorageKeys.all, 'space-issue-types', spaceName] as const,
};
