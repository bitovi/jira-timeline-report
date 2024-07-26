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

export default async function requestHelper(
  {
    JIRA_API_URL
  },
  storageHelpers,
  {
    urlFragment,
    requestData = null
  }
) {
  return new Promise((resolve, reject) => {
    const scopeIdForJira = storageHelpers.fetchFromLocalStorage('scopeId');
    const accessToken = storageHelpers.fetchFromLocalStorage('accessToken');

    const requestUrl = `${JIRA_API_URL}/${scopeIdForJira}`+urlFragment;

    const requestObj = {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    }
    if(requestData !== null) {
      requestObj.data = requestData;
    }
    console.log('JIRA_API_URL: ', JIRA_API_URL);
    console.log('scopeIdForJira ', scopeIdForJira);
    console.log('Request URL: ', requestUrl);
    console.log('Request Obj: ', requestObj);
    try {
      resolve(fetchJSON(requestUrl, requestObj));
    }
    catch(ex) {
      reject(ex);
    }
  })
}
