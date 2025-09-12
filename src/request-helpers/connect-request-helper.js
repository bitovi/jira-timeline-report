import { responseToJSON } from '../utils/fetch/response-to-json';

async function fetchJSON(url, options) {
  return fetch(url, options).then(responseToJSON);
}

export function getConnectRequestHelper() {
  return function (requestUrl, options = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        let result;

        if (requestUrl.startsWith('https://')) {
          // For full URLs, use fetch with options
          const fetchOptions = {
            method: options.method || 'GET',
            headers: options.headers || {},
          };
          if (options.body) {
            fetchOptions.body = options.body;
          }
          result = await fetchJSON(requestUrl, fetchOptions);
        } else {
          // For relative URLs, use AP.request with options
          const apOptions = {
            type: options.method || 'GET',
            headers: options.headers || {},
          };
          if (options.body) {
            apOptions.data = options.body;
          }
          result = JSON.parse((await AP.request(`/rest/${requestUrl}`, apOptions)).body);
        }
        resolve(result);
      } catch (ex) {
        reject(ex);
      }
    });
  };
}
