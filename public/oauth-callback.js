import jiraOIDCHelpers from "./jira-oidc-helpers";

export default function oauthCallback(environment) {
  const jiraHelpers = jiraOIDCHelpers(environment);

  const queryParams = new URLSearchParams(window.location.search);
  const queryCode = queryParams.get("code");
  if (!queryCode) {
    //handle error properly to ensure good feedback
    mainElement.innerHTML = `<p>Invalid code provided. <a href="/" class="link">Click here to return to the Timeline Report</a></p>`;
    // Todo
  } else {
    jiraHelpers.fetchAccessTokenWithAuthCode(queryCode);
  }
}
