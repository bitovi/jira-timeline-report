import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestJira } from '@forge/bridge';

import { createForgeConnectStorage } from './index.forge';

import type { StorageFactory } from './common';

vi.mock('@forge/bridge', () => ({
  requestJira: vi.fn(),
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
