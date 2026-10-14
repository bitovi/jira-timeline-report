import { beforeEach, describe, expect, it, vi } from 'vitest';

import { kvs } from '@forge/kvs';

import { handler } from './index';

vi.mock('@forge/kvs', () => ({
  kvs: { get: vi.fn(), set: vi.fn() },
}));

/**
 * Drives the real `@forge/resolver` definitions rather than the handler functions directly, so a
 * `functionKey` that does not match the string the frontend sends fails here instead of in Jira.
 * Only `@forge/kvs` is mocked — it has no local runtime.
 */
const call = (functionKey: string, payload: unknown) =>
  handler({ call: { functionKey, payload }, context: {} as never });

beforeEach(() => {
  vi.mocked(kvs.get).mockReset();
  vi.mocked(kvs.set).mockReset();
});

describe('storage.get', () => {
  it('returns the value KVS holds for the key', async () => {
    vi.mocked(kvs.get).mockResolvedValueOnce({ tableReport: true });

    await expect(call('storage.get', { key: 'features' })).resolves.toEqual({
      value: { tableReport: true },
    });
  });

  it('reads the key it was given', async () => {
    vi.mocked(kvs.get).mockResolvedValueOnce([]);

    await call('storage.get', { key: 'theme' });

    expect(vi.mocked(kvs.get)).toHaveBeenCalledWith('theme');
  });

  // The frontend turns this into its `defaultShape`. It must be distinguishable from a failure.
  it('answers with an empty envelope for a key that was never written', async () => {
    vi.mocked(kvs.get).mockResolvedValueOnce(undefined);

    await expect(call('storage.get', { key: 'saved-reports' })).resolves.toEqual({ value: undefined });
  });

  // Must reach the frontend as a rejection. Swallowing it here is what would hand the user an
  // empty app whose next save overwrites their reports.
  it('lets a KVS failure propagate instead of answering empty', async () => {
    vi.mocked(kvs.get).mockRejectedValueOnce(new Error('kvs unavailable'));

    await expect(call('storage.get', { key: 'saved-reports' })).rejects.toThrow(/kvs unavailable/);
  });

  it('rejects a payload with no key rather than reading undefined', async () => {
    await expect(call('storage.get', {})).rejects.toThrow(/key/i);

    expect(vi.mocked(kvs.get)).not.toHaveBeenCalled();
  });
});

describe('storage.set', () => {
  it('writes the value to KVS under the key', async () => {
    vi.mocked(kvs.set).mockResolvedValueOnce(undefined as never);

    await call('storage.set', { key: 'theme', value: [{ name: 'dark' }] });

    expect(vi.mocked(kvs.set)).toHaveBeenCalledWith('theme', [{ name: 'dark' }]);
  });

  it('lets a KVS write failure propagate', async () => {
    vi.mocked(kvs.set).mockRejectedValueOnce(new Error('write refused'));

    await expect(call('storage.set', { key: 'theme', value: [] })).rejects.toThrow(/write refused/);
  });

  it('rejects a payload with no key rather than writing to undefined', async () => {
    await expect(call('storage.set', { value: [] })).rejects.toThrow(/key/i);

    expect(vi.mocked(kvs.set)).not.toHaveBeenCalled();
  });
});

describe('stars', () => {
  // `@forge/resolver` takes `context.accountId` from the runtime's `principal`, not from the call —
  // so that is where a test has to put the user, and it is also why a browser can't forge one.
  const callAs = (functionKey: string, payload: unknown, principal: { accountId?: string }) =>
    (handler as (...args: unknown[]) => Promise<unknown>)(
      { call: { functionKey, payload }, context: {} },
      { principal },
    );

  const alice = { accountId: '557058:f58131cb-b67d-43c7-b30d-6b58d40bd077' };

  it('ignores an account id in the call context; only the runtime principal counts', async () => {
    vi.mocked(kvs.get).mockResolvedValueOnce(undefined);

    await (handler as (...args: unknown[]) => Promise<unknown>)(
      { call: { functionKey: 'stars.get', payload: {} }, context: { accountId: 'someone-else' } },
      { principal: alice },
    );

    expect(vi.mocked(kvs.get)).toHaveBeenCalledWith(`starred-reports:${alice.accountId}`);
  });

  describe('stars.get', () => {
    it("reads the caller's own key, built from the context", async () => {
      vi.mocked(kvs.get).mockResolvedValueOnce(['r1']);

      await expect(callAs('stars.get', undefined, alice)).resolves.toEqual({ value: ['r1'] });

      expect(vi.mocked(kvs.get)).toHaveBeenCalledWith(`starred-reports:${alice.accountId}`);
    });

    // Otherwise anyone could read anyone's stars by naming a key.
    it('ignores any key in the payload', async () => {
      vi.mocked(kvs.get).mockResolvedValueOnce(undefined);

      await callAs('stars.get', { key: 'starred-reports:someone-else' }, alice);

      expect(vi.mocked(kvs.get)).toHaveBeenCalledWith(`starred-reports:${alice.accountId}`);
    });

    it('rejects a call with no user rather than reading a shared key', async () => {
      await expect(callAs('stars.get', undefined, {})).rejects.toThrow(/user/);

      expect(vi.mocked(kvs.get)).not.toHaveBeenCalled();
    });

    it('rejects an account id that is not a valid storage key', async () => {
      await expect(callAs('stars.get', undefined, { accountId: 'bad/id' })).rejects.toThrow(/storage key/);

      expect(vi.mocked(kvs.get)).not.toHaveBeenCalled();
    });
  });

  describe('stars.set', () => {
    it("writes the ids to the caller's own key", async () => {
      vi.mocked(kvs.set).mockResolvedValueOnce(undefined as never);

      await callAs('stars.set', { ids: ['r1', 'r2'] }, alice);

      expect(vi.mocked(kvs.set)).toHaveBeenCalledWith(`starred-reports:${alice.accountId}`, ['r1', 'r2']);
    });

    it('ignores any key in the payload', async () => {
      vi.mocked(kvs.set).mockResolvedValueOnce(undefined as never);

      await callAs('stars.set', { key: 'starred-reports:someone-else', ids: [] }, alice);

      expect(vi.mocked(kvs.set)).toHaveBeenCalledWith(`starred-reports:${alice.accountId}`, []);
    });

    it.each([[{}], [{ ids: 'r1' }], [{ ids: ['r1', 2] }], [{ ids: [{ id: 'r1' }] }]])(
      'rejects %j, which is not a list of report ids',
      async (payload) => {
        await expect(callAs('stars.set', payload, alice)).rejects.toThrow(/list of report ids/);

        expect(vi.mocked(kvs.set)).not.toHaveBeenCalled();
      },
    );

    it('caps the number of stars', async () => {
      const ids = Array.from({ length: 1001 }, (_, i) => `r${i}`);

      await expect(callAs('stars.set', { ids }, alice)).rejects.toThrow(/more than 1000/);

      expect(vi.mocked(kvs.set)).not.toHaveBeenCalled();
    });
  });
});
