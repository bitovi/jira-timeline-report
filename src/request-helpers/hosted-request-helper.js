import {
  fetchAuthorizationCode,
  timeRemainingBeforeAccessTokenExpiresInSeconds,
  refreshAccessToken,
} from '../jira-oidc-helpers/auth';
import { responseToJSON } from '../utils/fetch/response-to-json';

function fetchFromLocalStorage(key) {
  return window.localStorage.getItem(key);
}

async function fetchJSON(url, options) {
  return fetch(url, options).then(responseToJSON);
}

let refreshPromise = null;

function getOrStartRefresh(config) {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(config)().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function getHostedRequestHelper(config) {
  const { JIRA_API_URL } = config;

  return function (urlFragment, options = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        const scopeIdForJira = fetchFromLocalStorage('scopeId');
        let accessToken = fetchFromLocalStorage('accessToken');

        if (accessToken) {
          const timeLeft = timeRemainingBeforeAccessTokenExpiresInSeconds();
          const FIVE_SECONDS = 5;

          if (timeLeft < FIVE_SECONDS) {
            const newToken = await getOrStartRefresh(config);
            if (!newToken) {
              // refreshAccessToken redirected to Atlassian for re-auth; hang this request
              return;
            }
            accessToken = newToken;
          }
        }

        let requestUrl;
        if (urlFragment.startsWith('https://')) {
          requestUrl = urlFragment;
        } else {
          requestUrl = `${JIRA_API_URL}/${scopeIdForJira}/rest/${urlFragment}`;
        }

        const fetchOptions = {
          method: options.method || 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...options.headers,
          },
        };

        if (options.body) {
          fetchOptions.body = options.body;
        }

        const result = await fetchJSON(requestUrl, fetchOptions);
        resolve(result);
      } catch (ex) {
        reject(ex);
      }
    });
  };
}
