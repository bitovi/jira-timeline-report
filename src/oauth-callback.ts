/**
 * The OAuth callback page. Its only job is to trade the `code` query param for tokens and bounce
 * back to the app.
 *
 * It deliberately does NOT build the full jiraHelpers object. That factory needs a `requestHelper`
 * and a `host`, neither of which this page has, and it eagerly kicks off a fields request
 * (makeFieldsRequest) before returning. Calling it with just the env threw
 * "requestHelper is not a function" *before* the token exchange could run, stranding anyone whose
 * localStorage still held an accessToken when they re-authed. `fetchAccessTokenWithAuthCode` is a
 * standalone export that takes no config, so import it directly.
 */
import { fetchAccessTokenWithAuthCode } from './jira-oidc-helpers/auth';

export default function oauthCallback() {
  const queryCode = new URLSearchParams(window.location.search).get('code');

  if (!queryCode) {
    const mainElement = document.getElementById('mainElement');

    if (mainElement) {
      mainElement.innerHTML = `<p>Invalid code provided. <a href="/" class="link">Click here to return to the Timeline Report</a></p>`;
    }

    return;
  }

  fetchAccessTokenWithAuthCode(queryCode);
}

oauthCallback();
