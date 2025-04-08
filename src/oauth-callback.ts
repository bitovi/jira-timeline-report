import jiraOIDCHelpers from "./jira-oidc-helpers";

export default function oauthCallback() {
  const environment = {
    JIRA_CLIENT_ID: import.meta.env.VITE_JIRA_CLIENT_ID,
    JIRA_SCOPE: import.meta.env.VITE_JIRA_SCOPE,
    JIRA_CALLBACK_URL: import.meta.env.VITE_JIRA_CALLBACK_URL,
    JIRA_API_URL: import.meta.env.VITE_JIRA_API_URL,
    JIRA_APP_KEY: import.meta.env.VITE_JIRA_APP_KEY,
  };

  console.log({ environment });

  //@ts-expect-error
  const jiraHelpers = jiraOIDCHelpers(environment);

  const queryParams = new URLSearchParams(window.location.search);
  const queryCode = queryParams.get("code");
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
