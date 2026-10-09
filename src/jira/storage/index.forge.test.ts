import { beforeEach, describe, expect, it, vi } from 'vitest';

import { invoke, requestJira } from '@forge/bridge';

import { createForgeConnectStorage, createForgeKvsStorage, peekConnectProperty } from './index.forge';

import type { StorageFactory } from './common';

vi.mock('@forge/bridge', () => ({
  requestJira: vi.fn(),
  invoke: vi.fn(),
}));

const APP_KEY = 'bitovi.status-report';

const propertyPath = (key: string) => `/rest/atlassian-connect/1/addons/${APP_KEY}/properties/${key}`;

/** The factory only reads `appKey` off the helpers, so the rest of that object is irrelevant here. */
const storage = () => createForgeConnectStorage({ appKey: APP_KEY } as Parameters<StorageFactory>[number]);

const respondWith = (...responses: Response[]) => {
  const mocked = vi.mocked(requestJira);

  for (const response of responses) {
    mocked.mockResolvedValueOnce(response);
  }
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const notFound = () => json(404, { statusCode: 404, message: 'Property with key not found.' });

beforeEach(() => {
  vi.mocked(requestJira).mockReset();
});

describe('createForgeConnectStorage', () => {
  describe('get', () => {
    // Connect wraps the payload as `{key, value, self}` — callers want `value`, not the envelope.
    it('unwraps the value from the app-property envelope', async () => {
      respondWith(json(200, { key: 'features', value: { tableReport: true }, self: 'https://x' }));

      await expect(storage().get('features')).resolves.toEqual({ tableReport: true });
    });

    it('reads from the Connect app-property path for the app key', async () => {
      respondWith(json(200, { key: 'theme', value: [] }));

      await storage().get('theme');

      expect(vi.mocked(requestJira).mock.calls[0][0]).toBe(propertyPath('theme'));
    });

    // A site that has never saved anything has no property at all. The Connect store seeds the
    // default shape on first read (index.plugin.ts:57-64) so callers never see a null; this has to
    // match, or a fresh Forge install behaves differently from the same site on Connect.
    it('seeds the default shape when the property does not exist yet', async () => {
      respondWith(notFound(), json(201, { statusCode: 201, message: 'Property created.' }));

      await expect(storage().get('saved-reports', {})).resolves.toEqual({});
    });

    it('writes the seeded default back so the next read finds it', async () => {
      respondWith(notFound(), json(201, {}));

      await storage().get('saved-reports', { seeded: true });

      const [path, init] = vi.mocked(requestJira).mock.calls[1];
      expect(path).toBe(propertyPath('saved-reports'));
      expect(init).toMatchObject({ method: 'PUT', body: JSON.stringify({ seeded: true }) });
    });

    // Anything that isn't 200-or-404 is a real failure — permissions, an outage, a bad key. Swallowing
    // it would look identical to "no reports yet" and silently hand the user an empty app.
    it('throws when the read fails for a reason other than a missing property', async () => {
      respondWith(json(403, { statusCode: 403, message: 'Forbidden' }));

      await expect(storage().get('saved-reports')).rejects.toThrow(/403/);
    });
  });

  describe('update', () => {
    it('puts the JSON-encoded value to the app-property path', async () => {
      respondWith(json(200, { statusCode: 200, message: 'Property updated.' }));

      await storage().update('theme', [{ name: 'dark' }]);

      const [path, init] = vi.mocked(requestJira).mock.calls[0];
      expect(path).toBe(propertyPath('theme'));
      expect(init).toMatchObject({ method: 'PUT', body: JSON.stringify([{ name: 'dark' }]) });
    });

    it('throws when the write is rejected', async () => {
      respondWith(json(403, { statusCode: 403, message: 'Forbidden' }));

      await expect(storage().update('theme', [])).rejects.toThrow(/403/);
    });
  });

  // The Connect store is always ready — there is no container to provision, unlike the web host's
  // configuration issue. Forge inherits that.
  describe('storageInitialized', () => {
    it('is always true', async () => {
      await expect(storage().storageInitialized()).resolves.toBe(true);
    });
  });
});

describe('createForgeKvsStorage', () => {
  const kvs = () => createForgeKvsStorage({} as Parameters<StorageFactory>[number]);

  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  describe('get', () => {
    it('returns the value the resolver holds for the key', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ value: { tableReport: true } });

      await expect(kvs().get('features')).resolves.toEqual({ tableReport: true });
    });

    it('asks the resolver for that key', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ value: [] });

      await kvs().get('theme');

      expect(vi.mocked(invoke)).toHaveBeenCalledWith('storage.get', { key: 'theme' });
    });

    // KVS has no envelope and no 404 — a key that was never written simply resolves to nothing.
    it('returns the default shape when the key has never been written', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ value: undefined });

      await expect(kvs().get('saved-reports', {})).resolves.toEqual({});
    });

    // Deliberately unlike createForgeConnectStorage, which seeds the store on a 404. A write is the
    // expensive KVS operation and there is nothing to provision — see the plan, § Behaviour.
    it('writes nothing when the key has never been written', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ value: undefined });

      await kvs().get('saved-reports', { seeded: true });

      expect(vi.mocked(invoke)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(invoke)).not.toHaveBeenCalledWith('storage.set', expect.anything());
    });

    // The load-bearing one. A failure that reads as "no reports yet" hands the user an empty app,
    // and the next save overwrites reports that were there all along.
    it('throws when the resolver fails rather than returning the default shape', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('resolver exploded'));

      await expect(kvs().get('saved-reports', {})).rejects.toThrow(/resolver exploded/);
    });
  });

  describe('update', () => {
    it('sends the key and value to the resolver', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await kvs().update('theme', [{ name: 'dark' }]);

      expect(vi.mocked(invoke)).toHaveBeenCalledWith('storage.set', {
        key: 'theme',
        value: [{ name: 'dark' }],
      });
    });

    it('throws when the write is rejected', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('write refused'));

      await expect(kvs().update('theme', [])).rejects.toThrow(/write refused/);
    });
  });

  describe('storageInitialized', () => {
    it('is always true without calling the resolver', async () => {
      await expect(kvs().storageInitialized()).resolves.toBe(true);

      expect(vi.mocked(invoke)).not.toHaveBeenCalled();
    });
  });
});

describe('peekConnectProperty', () => {
  it('unwraps the value from the app-property envelope', async () => {
    respondWith(json(200, { key: 'theme', value: { primary: '#000' }, self: 'https://x' }));

    await expect(peekConnectProperty(APP_KEY, 'theme')).resolves.toEqual({ primary: '#000' });
    expect(vi.mocked(requestJira).mock.calls[0][0]).toBe(propertyPath('theme'));
  });

  // The whole reason this exists instead of `get()`: probing with a seeding read would create the
  // property, and every fresh install would be offered a migration of the defaults it just wrote.
  it('returns undefined on a 404 and writes nothing', async () => {
    respondWith(notFound());

    await expect(peekConnectProperty(APP_KEY, 'saved-reports')).resolves.toBeUndefined();

    expect(requestJira).toHaveBeenCalledTimes(1);
    expect(vi.mocked(requestJira).mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  // A missing app key 404s on `/addons/undefined/...`, which would read as an empty install.
  it('refuses to read without an app key', async () => {
    await expect(peekConnectProperty('', 'saved-reports')).rejects.toThrow(/without an app key/);
    expect(requestJira).not.toHaveBeenCalled();
  });

  it('throws on any other failure, so an outage cannot pass for "nothing to migrate"', async () => {
    respondWith(json(403, { message: 'Forbidden' }));

    await expect(peekConnectProperty(APP_KEY, 'features')).rejects.toThrow(/403/);
  });
});
