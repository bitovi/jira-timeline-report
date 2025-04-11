import {responseToJSON} from "../utils/fetch/response-to-json";

function fetchFromLocalStorage(key) {
  return window.localStorage.getItem(key);
};

async function fetchJSON(url, options) {
	return fetch(url, options).then(responseToJSON)
}

export function getHostedRequestHelper({ JIRA_API_URL }) {
  return function(urlFragment) {
    return new Promise(async(resolve, reject) => {
      try {
        const scopeIdForJira = fetchFromLocalStorage('scopeId');
        const accessToken = fetchFromLocalStorage('accessToken');
  
        let requestUrl;
        if(urlFragment.startsWith('https://')) {
          requestUrl = urlFragment;
        } else {
          requestUrl = `${JIRA_API_URL}/${scopeIdForJira}/rest/${urlFragment}`;
        }
        const result = await fetchJSON(
          requestUrl,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            }
          }
        );
        resolve(result);
      }
      catch(ex) {
        reject(ex);
      }
    })
  }

}
