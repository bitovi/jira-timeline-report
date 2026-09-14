import { describe, test, expect, vi, beforeEach } from 'vitest';

const { createJiraHelpers } = vi.hoisted(() => ({ createJiraHelpers: vi.fn() }));

vi.mock('./jira-oidc-helpers', () => ({ default: createJiraHelpers }));

/**
 * The callback page builds its own helpers rather than going through `main-helper`, so it is the
 * one caller that has to name its host explicitly. Leaving it `undefined` used to be harmless
 * because `makeFieldsRequest` asked `host === 'jira'`; once that became `host !== 'hosted'`
 * (to let Forge through) an absent host started passing the check and the page crashed on
 * `config.requestHelper is not a function` before it could ever exchange the auth code.
 */
describe('oauthCallback', () => {
  beforeEach(() => {
    vi.resetModules();
    createJiraHelpers.mockReset();
    createJiraHelpers.mockReturnValue({ fetchAccessTokenWithAuthCode: vi.fn() });
    window.history.replaceState({}, '', '/oauth-callback?code=test-auth-code');
  });

  test("names 'hosted' as its host so makeFieldsRequest skips the request it has no requestHelper for", async () => {
    await import('./oauth-callback');

    expect(createJiraHelpers).toHaveBeenCalledTimes(1);
    expect(createJiraHelpers.mock.calls[0][2]).toBe('hosted');
  });

  test('exchanges the auth code from the query string', async () => {
    const fetchAccessTokenWithAuthCode = vi.fn();
    createJiraHelpers.mockReturnValue({ fetchAccessTokenWithAuthCode });

    await import('./oauth-callback');

    expect(fetchAccessTokenWithAuthCode).toHaveBeenCalledWith('test-auth-code');
  });
});
