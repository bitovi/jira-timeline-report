export const userKeys = {
  currentAccountId: ['current-account-id'] as const,
  /** One cache entry per account id, so a name fetched for one page is reused by the next. */
  user: (accountId: string) => ['jira-user', accountId] as const,
  /** The set of ids a component asked for, sorted so the same set always hits the same entry. */
  users: (accountIds: string[]) => ['jira-users', ...accountIds] as const,
};
