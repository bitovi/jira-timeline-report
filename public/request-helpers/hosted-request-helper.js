async function fetchJSON(url, options) {
	return fetch(url, options).then(responseToJSON)
}

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

export default function requestHelper(
  {
    JIRA_API_URL
  },
  storageHelpers,
  {
    requestUrl,
    requestData = null
  }
) {
  return function() {
    return new Promise((resolve, reject) => {
      const scopeIdForJira = storageHelpers.fetchFromLocalStorage('scopeId');
      const accessToken = storageHelpers.fetchFromLocalStorage('accessToken');

      const requestUrl = `${JIRA_API_URL}/${scopeIdForJira}`+urlFragment;

      const requestObj = {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
      if(data !== null) {
        requestObj.data = data;
      }

      console.log('Request URL: ', requestUrl);
      console.log('Request Obj: ', requestObj);
      return fetchJSON(requestUrl, requestObj)
    })
  }
}
