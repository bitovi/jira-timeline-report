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

/**
 * A store whose writes stay open until the test settles them, like slow Forge resolver calls. Each
 * settled write updates what a later read returns, so the test can check the screen matches it.
 */
const controllableStore = (initial: string[] = []) => {
  let stored = [...initial];
  let inFlight = 0;
  let maxInFlight = 0;
  const writes: Array<{ ids: string[]; succeed: () => void; fail: () => void }> = [];

  const store: StarsStore = {
    read: vi.fn(async () => [...stored]),
    write: vi.fn(
      (ids: string[]) =>
        new Promise<void>((resolve, reject) => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          writes.push({
            ids,
            succeed: () => {
              inFlight -= 1;
              stored = [...ids];
              resolve();
            },
            fail: () => {
              inFlight -= 1;
              reject(new Error('write failed'));
            },
          });
        }),
    ),
  };

  return { store, writes, stored: () => stored, maxInFlight: () => maxInFlight };
};

describe('useStarredReports with overlapping writes', () => {
  // Star A then B quickly. Concurrent whole-list writes could land `[A]` after `[A, B]` and lose B.
  it('writes one at a time, so the last write holds every star', async () => {
    const fake = controllableStore();
    const { result } = renderStars(fake.store);
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => result.current.toggleStar('a'));
    act(() => result.current.toggleStar('b'));

    await waitFor(() => expect(fake.writes).toHaveLength(1));
    expect(fake.writes[0].ids).toEqual(['a']);

    await act(async () => fake.writes[0].succeed());
    await waitFor(() => expect(fake.writes).toHaveLength(2));
    await act(async () => fake.writes[1].succeed());

    expect(fake.maxInFlight()).toBe(1);
    expect(fake.stored()).toEqual(['a', 'b']);
    expect([...result.current.starredIds]).toEqual(['a', 'b']);
  });

  // A per-click rollback would put back the list from before the first click, dropping B — which
  // the second write saved.
  it('keeps a later saved change when an earlier write fails', async () => {
    const fake = controllableStore();
    const { result } = renderStars(fake.store);
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    act(() => result.current.toggleStar('a'));
    act(() => result.current.toggleStar('b'));

    await waitFor(() => expect(fake.writes).toHaveLength(1));
    await act(async () => fake.writes[0].fail());
    await waitFor(() => expect(fake.writes).toHaveLength(2));
    await act(async () => fake.writes[1].succeed());

    await waitFor(() => expect(fake.store.read).toHaveBeenCalledTimes(2));
    expect(fake.stored()).toEqual(['a', 'b']);
    await waitFor(() => expect([...result.current.starredIds]).toEqual(['a', 'b']));
  });

  it('re-syncs with what was saved when a write fails', async () => {
    const fake = controllableStore(['x']);
    const { result } = renderStars(fake.store);
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    act(() => result.current.toggleStar('a'));
    // Shown straight away, before the write settles. (React Query notifies on a later tick.)
    await waitFor(() => expect([...result.current.starredIds]).toEqual(['x', 'a']));

    await waitFor(() => expect(fake.writes).toHaveLength(1));
    await act(async () => fake.writes[0].fail());

    await waitFor(() => expect([...result.current.starredIds]).toEqual(['x']));
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
