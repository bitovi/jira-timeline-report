import type { FC, ReactNode } from 'react';
import type { StarsStore } from './stars-store';

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlagsProvider } from '@atlaskit/flag';

import { UserServicesProvider } from '../user/UserServicesProvider';
import { useStarredReports } from './useStarredReports';
import { createForgeStarsStore, createLocalStarsStore, localStarsKey } from './stars-store';
import { STARS_GET, STARS_SET } from '../../../forge-resolver/contract';

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = { ...initial };

  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
};

/** A Forge `invoke` over an in-memory KVS holding one user's stars. */
const fakeInvoke = (initial: string[] = []) => {
  let stored: string[] | undefined = initial;

  return vi.fn(async (key: string, payload?: Record<string, unknown>) => {
    if (key === STARS_GET) {
      return { value: stored };
    }

    if (key === STARS_SET) {
      stored = payload?.ids as string[];

      return undefined;
    }

    throw new Error(`unexpected ${key}`);
  });
};

const renderStars = (starsStore: StarsStore) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <UserServicesProvider services={{ readCurrentAccountId: async () => 'me', starsStore }}>
      <FlagsProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </FlagsProvider>
    </UserServicesProvider>
  );

  return renderHook(() => useStarredReports(), { wrapper });
};

describe('localStarsKey', () => {
  beforeEach(() => {
    window.env = { ...(window.env ?? {}), JIRA_APP_KEY: 'app-key' } as typeof window.env;
  });

  it('is per account', () => {
    expect(localStarsKey('acct-1')).toBe('app-key-starred-reports-acct-1');
    expect(localStarsKey('acct-2')).toBe('app-key-starred-reports-acct-2');
  });

  it('drops the suffix with no account', () => {
    expect(localStarsKey(null)).toBe('app-key-starred-reports');
  });
});

describe.each([
  [
    'localStorage',
    (initial: string[]) => {
      window.env = { ...(window.env ?? {}), JIRA_APP_KEY: 'app-key' } as typeof window.env;
      const storage = memoryStorage({ 'app-key-starred-reports-me': JSON.stringify(initial) });

      return {
        store: createLocalStarsStore(async () => 'me', storage),
        stored: () => JSON.parse(storage.data['app-key-starred-reports-me']),
      };
    },
  ],
  [
    'Forge KVS',
    (initial: string[]) => {
      const invoke = fakeInvoke(initial);

      return {
        store: createForgeStarsStore(invoke),
        stored: () => invoke.mock.calls.filter(([key]) => key === STARS_SET).at(-1)?.[1]?.ids,
      };
    },
  ],
])('useStarredReports over %s', (_name, makeStore) => {
  it('reads the stored stars', async () => {
    const { store } = makeStore(['r1']);
    const { result } = renderStars(store);

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect([...result.current.starredIds]).toEqual(['r1']);
  });

  it('toggles a star on and off, writing the whole list', async () => {
    const { store, stored } = makeStore(['r1']);
    const { result } = renderStars(store);
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => result.current.toggleStar('r2'));
    await waitFor(() => expect(stored()).toEqual(['r1', 'r2']));
    expect(result.current.starredIds.has('r2')).toBe(true);

    act(() => result.current.toggleStar('r1'));
    await waitFor(() => expect(stored()).toEqual(['r2']));
    expect(result.current.starredIds.has('r1')).toBe(false);
  });

  it('removes a star', async () => {
    const { store, stored } = makeStore(['r1', 'r2']);
    const { result } = renderStars(store);
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => result.current.removeStar('r1'));

    await waitFor(() => expect(stored()).toEqual(['r2']));
  });
});

describe('useStarredReports when the read fails', () => {
  // Every write replaces the whole list, so writing now would erase the stars that failed to load.
  it('refuses to write', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = { read: vi.fn().mockRejectedValue(new Error('kvs down')), write: vi.fn() };
    const { result } = renderStars(store);
    // The hook retries a failed read once, after the default ~1s delay.
    await waitFor(() => expect(result.current.isLoaded).toBe(true), { timeout: 3000 });

    act(() => result.current.toggleStar('r1'));
    act(() => result.current.removeStar('r1'));

    expect(store.write).not.toHaveBeenCalled();
  });
});

describe('createForgeStarsStore', () => {
  it('treats a never-written key as no stars', async () => {
    const invoke = vi.fn(async () => ({ value: undefined }));

    await expect(createForgeStarsStore(invoke).read()).resolves.toEqual([]);
  });

  it('sends only the ids — the resolver decides whose they are', async () => {
    const invoke = vi.fn(async () => undefined);

    await createForgeStarsStore(invoke).write(['r1']);

    expect(invoke).toHaveBeenCalledWith(STARS_SET, { ids: ['r1'] });
  });
});
