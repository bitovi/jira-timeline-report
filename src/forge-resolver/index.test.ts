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
