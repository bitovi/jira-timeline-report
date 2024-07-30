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

export function getConnectRequestHelper() {
  return function(requestUrl) {
    return new Promise(async(resolve, reject) => {
      try {
        const result = await fetchJSON(
          requestUrl
        );
        resolve(result);
      }
      catch(ex) {
        reject(ex);
      }
    })
  }

}