/**
 * Who is using the app, as a Jira `accountId` — the only user identifier this app ever stores (see
 * spec/041-saved-reports-redesign/phase1.md § Decisions). Never stored next to a name, email or
 * avatar — that would make it personal data.
 *
 * Each host has its own way of knowing, so the reader is chosen by the host entry point
 * (`forge.main.ts` / `web.main.ts`) and handed down through `UserServicesProvider` rather than
 * branched on here. That keeps this module free of `@forge/bridge`, whose calls hang outside a
 * Forge iframe (see shared/reload-app.ts), and testable without `vi.mock`.
 */
export type ReadCurrentAccountId = () => Promise<string | null>;

/** No host, no user: sample data, tests and Storybook. */
export const readNoAccountId: ReadCurrentAccountId = async () => null;

/**
 * The `sub` claim of a JWT, or `null` for anything that isn't one.
 *
 * Decodes the payload only — no signature check. The result is a hint about who is signed in, used
 * to tag reports and pick "My reports"; the Jira API still authorizes every request on the real
 * token. Never logs the token.
 */
export const readSubFromJwt = (token: string | null | undefined): string | null => {
  if (!token) {
    return null;
  }

  const parts = token.split('.');

  if (parts.length !== 3 || !parts[1]) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { sub?: unknown };

    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
};

/**
 * The website: Atlassian 3LO access tokens are JWTs whose `sub` is the account id.
 *
 * Preferred over `/myself` because it needs no scope (`/myself` needs `read:jira-user`), so
 * `ownerId` and "My reports" work with the scopes every signed-in user already has. Atlassian
 * documents the token as opaque, so this is observed behavior (verified 2026-10-14), not a contract.
 */
export const createWebAccountIdReader =
  (storage: Pick<Storage, 'getItem'> = window.localStorage): ReadCurrentAccountId =>
  async () =>
    readSubFromJwt(storage.getItem('accessToken'));

/** Just the part of `@forge/bridge`'s `view` this needs, so tests can pass a plain object. */
export type ForgeViewContextReader = {
  getContext: () => Promise<{ accountId?: string }>;
};

/** Forge: the view context carries the viewing user's account id. No scope, no Jira call. */
export const createForgeAccountIdReader =
  (view: ForgeViewContextReader): ReadCurrentAccountId =>
  async () => {
    const { accountId } = await view.getContext();

    return accountId || null;
  };
