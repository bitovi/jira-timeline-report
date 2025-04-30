import {
  fetchAuthorizationCode,
  timeRemainingBeforeAccessTokenExpiresInSeconds,
} from "../jira-oidc-helpers/auth";
import { responseToJSON } from "../utils/fetch/response-to-json";

function fetchFromLocalStorage(key) {
  return window.localStorage.getItem(key);
}

async function fetchJSON(url, options) {
  return fetch(url, options).then(responseToJSON);
}

export function getHostedRequestHelper(config) {
  const { JIRA_API_URL } = config;

  return function (urlFragment) {
    return new Promise(async (resolve, reject) => {
      try {
        const scopeIdForJira = fetchFromLocalStorage("scopeId");
        const accessToken = fetchFromLocalStorage("accessToken");

        if (accessToken) {
          const timeLeft = timeRemainingBeforeAccessTokenExpiresInSeconds();
          const FIVE_SECONDS = 5;

          if (timeLeft < FIVE_SECONDS) {
            alert(
              "Your access token needs to be refreshed. Taking you to Atlassian to reauthorize"
            );
            fetchAuthorizationCode(config);
            return new Promise(function () {});
          }
        }

        let requestUrl;
        if (urlFragment.startsWith("https://")) {
          requestUrl = urlFragment;
        } else {
          requestUrl = `${JIRA_API_URL}/${scopeIdForJira}/rest/${urlFragment}`;
        }
        const result = await fetchJSON(requestUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        resolve(result);
      } catch (ex) {
        reject(ex);
      }
    });
  };
}
