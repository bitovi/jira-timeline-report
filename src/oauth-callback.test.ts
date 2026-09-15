import { describe, test, expect, vi, beforeEach } from 'vitest';

// The page must reach the token exchange without building the full jiraHelpers object — see the
// comment at the top of oauth-callback.ts. Mocking only this one export is the point: if the page
// starts depending on more of the auth/helpers surface again, this mock stops satisfying it.
vi.mock('./jira-oidc-helpers/auth', () => ({
  fetchAccessTokenWithAuthCode: vi.fn(async () => {}),
}));

import oauthCallback from './oauth-callback';
import { fetchAccessTokenWithAuthCode } from './jira-oidc-helpers/auth';

describe('oauthCallback', () => {
  beforeEach(() => {
    vi.mocked(fetchAccessTokenWithAuthCode).mockClear();
    window.localStorage.clear();
    document.body.innerHTML = '<div id="mainElement"></div>';
  });

  test('exchanges the code from the query string for tokens', () => {
    window.history.replaceState({}, '', '/oauth-callback?code=abc123');

    oauthCallback();

    expect(fetchAccessTokenWithAuthCode).toHaveBeenCalledWith('abc123');
  });

  // Regression: a leftover accessToken used to make the page throw
  // "requestHelper is not a function" before it could exchange the code, so re-auth never
  // completed and the user was stranded on the callback page.
  test('still exchanges the code when a stale accessToken is in localStorage', () => {
    window.localStorage.setItem('accessToken', 'expired-token');
    window.history.replaceState({}, '', '/oauth-callback?code=abc123');

    expect(() => oauthCallback()).not.toThrow();
    expect(fetchAccessTokenWithAuthCode).toHaveBeenCalledWith('abc123');
  });

  test('shows a link back to the report when no code is provided', () => {
    window.history.replaceState({}, '', '/oauth-callback');

    oauthCallback();

    expect(fetchAccessTokenWithAuthCode).not.toHaveBeenCalled();
    expect(document.getElementById('mainElement')?.textContent).toContain('Invalid code provided');
  });
});
