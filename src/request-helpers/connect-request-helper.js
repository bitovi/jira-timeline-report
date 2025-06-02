import { responseToJSON } from '../utils/fetch/response-to-json';

async function fetchJSON(url, options) {
  return fetch(url, options).then(responseToJSON);
}

export function getConnectRequestHelper() {
  return function (requestUrl) {
    return new Promise(async (resolve, reject) => {
      try {
        let result;
        if (requestUrl.startsWith('https://')) {
          result = await fetchJSON(requestUrl, {});
        } else {
          result = JSON.parse((await AP.request(`/rest/${requestUrl}`)).body);
        }
        resolve(result);
      } catch (ex) {
        reject(ex);
      }
    });
  };
}
