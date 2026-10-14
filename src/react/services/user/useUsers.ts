import type { RequestHelper } from '../../../jira-oidc-helpers/types';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useJira } from '../jira';
import { userKeys } from './key-factory';

/** What the saved-reports UI shows for one account. Read at render time, never stored. */
export interface JiraUser {
  accountId: string;
  displayName?: string;
  avatarUrl?: string;
  /** `false` for a deactivated or deleted account — rendered "Former user". */
  active?: boolean;
  accountType?: string;
}

export interface UseUsersResult {
  /** Keyed by account id. An id missing here has no name to show (yet, or at all). */
  users: Record<string, JiraUser>;
  /**
   * Jira answered 401/403: on the web, a token issued before `read:jira-user` was added. Refreshing
   * never re-asks for scopes, so only signing in again fixes it. See the sign-in banner on the
   * Saved Reports page.
   */
  needsReauth: boolean;
}

/** `/user/bulk`'s page size cap. */
export const USERS_BATCH_SIZE = 200;

interface BulkUserResponse {
  values?: Array<{
    accountId: string;
    displayName?: string;
    active?: boolean;
    accountType?: string;
    avatarUrls?: Record<string, string>;
  }>;
}

const isAuthError = (error: unknown): boolean => {
  const status = (error as { status?: unknown } | null)?.status;

  return status === 401 || status === 403;
};

/**
 * `GET /rest/api/3/user/bulk` for every id, in batches of 200. Only `displayName`, `avatarUrls`,
 * `active` and `accountType` are read — email, time zone and locale depend on each user's privacy
 * settings.
 */
export const fetchUsersBulk = async (request: RequestHelper, accountIds: string[]): Promise<JiraUser[]> => {
  const users: JiraUser[] = [];

  for (let start = 0; start < accountIds.length; start += USERS_BATCH_SIZE) {
    const batch = accountIds.slice(start, start + USERS_BATCH_SIZE);
    const params = new URLSearchParams(batch.map((id) => ['accountId', id]));
    params.set('maxResults', String(USERS_BATCH_SIZE));

    const response = (await request(`api/3/user/bulk?${params.toString()}`)) as unknown as BulkUserResponse;

    for (const user of response?.values ?? []) {
      users.push({
        accountId: user.accountId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrls?.['24x24'],
        active: user.active,
        accountType: user.accountType,
      });
    }
  }

  return users;
};

const EMPTY: UseUsersResult = { users: {}, needsReauth: false };

/**
 * Names and avatars for a set of account ids. **Non-suspending**: names are decoration, so the page
 * renders straight away and fills them in. Never throws: a failure leaves the names out.
 *
 * Cached per id, so ids already looked up (by this page or another) aren't fetched again.
 */
export const useUsers = (accountIds: Iterable<string>): UseUsersResult => {
  const jira = useJira();
  const queryClient = useQueryClient();

  const ids = useMemo(() => [...new Set(accountIds)].filter(Boolean).sort(), [accountIds]);

  const { data } = useQuery({
    queryKey: userKeys.users(ids),
    enabled: ids.length > 0,
    staleTime: Infinity,
    // A 401/403 is answered rather than thrown (below), so this only retries real outages.
    retry: 1,
    queryFn: async (): Promise<UseUsersResult> => {
      const users: Record<string, JiraUser> = {};
      const missing: string[] = [];

      for (const id of ids) {
        const cached = queryClient.getQueryData<JiraUser>(userKeys.user(id));

        if (cached) {
          users[id] = cached;
        } else {
          missing.push(id);
        }
      }

      try {
        for (const user of await fetchUsersBulk(jira.requester, missing)) {
          users[user.accountId] = user;
          queryClient.setQueryData(userKeys.user(user.accountId), user);
        }
      } catch (error) {
        if (isAuthError(error)) {
          return { users, needsReauth: true };
        }

        throw error;
      }

      return { users, needsReauth: false };
    },
  });

  return data ?? EMPTY;
};
