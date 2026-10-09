import { responseToJSON } from '../utils/fetch/response-to-json';

async function fetchJSON(url, options) {
  return fetch(url, options).then(responseToJSON);
}

/**
 * `AP.request` rejects with `{err}` — a JSON *string*, not an `Error` — so an unwrapped bridge
 * failure reaches the UI as a bare "Something went wrong".
 *
 * Worth unwrapping for writes in particular: a Connect app's `DELETE` scope is **separate from
 * `write`**, so deleting a work item fails on a descriptor asking only for `["read", "write"]`, and
 * "you don't have permission" is a very different message from "something went wrong".
 *
 * This lives here rather than at the call site so every Connect request gets it. The hosted and
 * Forge helpers already reject with an `Error` (via `responseToJSON`); this is what makes Connect
 * agree with them.
 */
function toError(requestUrl, error) {
  const raw = error?.err;

  if (typeof raw === 'string') {
    try {
      const { statusCode, message } = JSON.parse(raw);

      return new Error(`${requestUrl} failed${statusCode ? ` (HTTP ${statusCode})` : ''}: ${message ?? raw}`);
    } catch {
      return new Error(`${requestUrl} failed: ${raw}`);
    }
  }

  return error instanceof Error ? error : new Error(`${requestUrl} failed`);
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
            // AP.request requires contentType property for POST requests
            apOptions.contentType = 'application/json';
            apOptions.data = options.body;
          }
          let response;
          try {
            response = await AP.request(`/rest/${requestUrl}`, apOptions);
          } catch (error) {
            throw toError(requestUrl, error);
          }

          result = JSON.parse(response.body);
        }
        resolve(result);
      } catch (ex) {
        reject(ex);
      }
    });
  };
}
