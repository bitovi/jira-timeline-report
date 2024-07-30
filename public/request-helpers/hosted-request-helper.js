function fetchFromLocalStorage(key) {
  return window.localStorage.getItem(key);
};

function responseToJSON(response) {
	if(!response.ok) {
		return response.json().then((payload) => {
			const err = new Error("HTTP status code: " + response.status);
			Object.assign(err, payload);
			Object.assign(err, response);
			throw err;
		})
	}
	return response.json();
}

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
        console.error(ex);
        reject(ex);
      }
    })
  }

}
