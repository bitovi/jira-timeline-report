import jiraOIDCHelpers from './jira-oidc-helpers';
import { RequestHelper } from './jira-oidc-helpers/types';

/**
 * The callback page has no authenticated request helper — it exists precisely to obtain the token
 * that would make one possible, and the only helper it calls, `fetchAccessTokenWithAuthCode`, talks
 * to our own auth server rather than Jira. Anything that reaches for this is asking Jira for data
 * before the handshake has finished, so say so instead of failing as "not a function".
 */
const requestHelperUnavailable: RequestHelper = () => {
  throw new Error('The OAuth callback page has no Jira request helper; the access token is not exchanged yet.');
};

export default function oauthCallback() {
  const environment = {
    JIRA_CLIENT_ID: import.meta.env.VITE_JIRA_CLIENT_ID,
    JIRA_SCOPE: import.meta.env.VITE_JIRA_SCOPE,
    JIRA_CALLBACK_URL: import.meta.env.VITE_JIRA_CALLBACK_URL,
    JIRA_API_URL: import.meta.env.VITE_JIRA_API_URL,
    JIRA_APP_KEY: import.meta.env.VITE_JIRA_APP_KEY,
  };

  // `host` has to be named explicitly here: this is the one caller that builds its helpers directly
  // rather than through `main-helper`. Leaving it undefined made `makeFieldsRequest`'s
  // `host !== 'hosted'` check pass, firing a Jira request this page cannot make.
  const jiraHelpers = jiraOIDCHelpers(environment, requestHelperUnavailable, 'hosted');

  const queryParams = new URLSearchParams(window.location.search);
  const queryCode = queryParams.get('code');
  if (!queryCode) {
    // @ts-expect-error
    //handle error properly to ensure good feedback
    mainElement.innerHTML = `<p>Invalid code provided. <a href="/" class="link">Click here to return to the Timeline Report</a></p>`;
    // Todo
  } else {
    jiraHelpers.fetchAccessTokenWithAuthCode(queryCode);
  }
}

oauthCallback();
