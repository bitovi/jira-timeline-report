import type { FC, ReactNode } from 'react';
import type { Jira } from '../../../jira-oidc-helpers';

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { JiraProvider } from '../jira';
import { fetchUsersBulk, useUsers } from './useUsers';

const user = (accountId: string, overrides: object = {}) => ({
  accountId,
  displayName: `Name ${accountId}`,
  active: true,
  accountType: 'atlassian',
  avatarUrls: { '24x24': `https://avatar/${accountId}` },
  ...overrides,
});

/** Answers `/user/bulk` from the ids in the URL, like Jira does. */
const bulkRequester = (overrides: Record<string, object> = {}) =>
  vi.fn(async (url: string) => {
    const ids = new URLSearchParams(url.split('?')[1]).getAll('accountId');

    return { values: ids.map((id) => user(id, overrides[id])) };
  });

const authError = (status: number) => Object.assign(new Error(`HTTP status code: ${status}`), { status });

const renderUsers = (requester: (url: string) => Promise<unknown>, ids: string[]) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <JiraProvider jira={{ requester } as unknown as Jira}>{children}</JiraProvider>
    </QueryClientProvider>
  );

  return { ...renderHook(() => useUsers(ids), { wrapper }), queryClient };
};

describe('fetchUsersBulk', () => {
  it('batches at 200 ids per request', async () => {
    const requester = bulkRequester();
    const ids = Array.from({ length: 450 }, (_, i) => `id-${i}`);

    const users = await fetchUsersBulk(requester as never, ids);

    expect(requester).toHaveBeenCalledTimes(3);
    expect(
      requester.mock.calls.map(([url]) => new URLSearchParams(url.split('?')[1]).getAll('accountId').length),
    ).toEqual([200, 200, 50]);
    expect(requester.mock.calls[0][0]).toMatch(/^api\/3\/user\/bulk\?/);
    expect(users).toHaveLength(450);
  });

  it('keeps only the fields the UI uses', async () => {
    const [ada] = await fetchUsersBulk(bulkRequester() as never, ['ada']);

    expect(ada).toEqual({
      accountId: 'ada',
      displayName: 'Name ada',
      avatarUrl: 'https://avatar/ada',
      active: true,
      accountType: 'atlassian',
    });
  });
});

describe('useUsers', () => {
  it('returns names by account id', async () => {
    const { result } = renderUsers(bulkRequester(), ['a', 'b']);

    await waitFor(() => expect(result.current.users.a?.displayName).toBe('Name a'));
    expect(result.current.users.b?.displayName).toBe('Name b');
    expect(result.current.needsReauth).toBe(false);
  });

  it('passes active: false through', async () => {
    const { result } = renderUsers(bulkRequester({ gone: { active: false } }), ['gone']);

    await waitFor(() => expect(result.current.users.gone).toBeDefined());
    expect(result.current.users.gone.active).toBe(false);
  });

  it('makes no request with no ids', () => {
    const requester = bulkRequester();
    renderUsers(requester, []);

    expect(requester).not.toHaveBeenCalled();
  });

  it.each([401, 403])('on a %s gives no names, asks for sign-in, and does not retry', async (status) => {
    const requester = vi.fn(async () => {
      throw authError(status);
    });
    const { result } = renderUsers(requester, ['a']);

    await waitFor(() => expect(result.current.needsReauth).toBe(true));
    expect(result.current.users).toEqual({});
    expect(requester).toHaveBeenCalledTimes(1);
  });

  it('gives no names, and no sign-in prompt, on any other failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const requester = vi.fn(async () => {
      throw authError(500);
    });
    const { result, queryClient } = renderUsers(requester, ['a']);

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    await waitFor(() => expect(requester).toHaveBeenCalledTimes(2));
    expect(result.current).toEqual({ users: {}, needsReauth: false });
  });

  it('reuses names already looked up', async () => {
    const requester = bulkRequester();
    const { result, queryClient } = renderUsers(requester, ['a']);
    await waitFor(() => expect(result.current.users.a).toBeDefined());

    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <JiraProvider jira={{ requester } as unknown as Jira}>{children}</JiraProvider>
      </QueryClientProvider>
    );
    const second = renderHook(() => useUsers(['a', 'b']), { wrapper });

    await waitFor(() => expect(second.result.current.users.b).toBeDefined());
    expect(second.result.current.users.a?.displayName).toBe('Name a');
    expect(new URLSearchParams(requester.mock.calls[1][0].split('?')[1]).getAll('accountId')).toEqual(['b']);
  });
});
