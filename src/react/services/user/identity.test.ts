import { createForgeAccountIdReader, createWebAccountIdReader, readSubFromJwt } from './identity';

/** An unsigned JWT with the given payload — the reader never checks the signature. */
const jwt = (payload: object) => {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${encode({ alg: 'none' })}.${encode(payload)}.signature`;
};

describe('readSubFromJwt', () => {
  it('returns the sub claim', () => {
    expect(readSubFromJwt(jwt({ sub: '557058:abc-123' }))).toBe('557058:abc-123');
  });

  it('decodes base64url payloads', () => {
    // `?>` encodes to characters that differ between base64 and base64url.
    expect(readSubFromJwt(jwt({ sub: 'id', pad: '??>>' }))).toBe('id');
  });

  it.each([[null], [undefined], [''], ['not-a-jwt'], ['a.b'], ['a.%%%.c'], [jwt({ notSub: 1 })], [jwt({ sub: 42 })]])(
    'returns null for %j',
    (token) => {
      expect(readSubFromJwt(token as string)).toBeNull();
    },
  );
});

describe('createWebAccountIdReader', () => {
  it("reads the account id from the stored access token's sub", async () => {
    const storage = { getItem: vi.fn(() => jwt({ sub: 'acct-1' })) };

    await expect(createWebAccountIdReader(storage)()).resolves.toBe('acct-1');
    expect(storage.getItem).toHaveBeenCalledWith('accessToken');
  });

  it('is null when signed out', async () => {
    await expect(createWebAccountIdReader({ getItem: () => null })()).resolves.toBeNull();
  });
});

describe('createForgeAccountIdReader', () => {
  it('returns the view context accountId', async () => {
    const view = { getContext: vi.fn(async () => ({ accountId: 'forge-acct' })) };

    await expect(createForgeAccountIdReader(view)()).resolves.toBe('forge-acct');
  });

  it('is null when the context has no user', async () => {
    await expect(createForgeAccountIdReader({ getContext: async () => ({}) })()).resolves.toBeNull();
  });
});
