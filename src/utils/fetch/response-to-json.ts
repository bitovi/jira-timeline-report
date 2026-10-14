/**
 * this module is for getting a json object from an http response.
 */
import { JsonResponse } from '../../shared/types';

export function responseToJSON<TData = object>(response: Response): Promise<JsonResponse<TData>> {
  if (!response.ok) {
    return response.json().then((payload) => {
      const err = new Error('HTTP status code: ' + response.status);
      Object.assign(err, payload);
      Object.assign(err, response);
      // `status` is a getter on `Response.prototype`, so the assign above never copies it. Set it
      // explicitly so callers can branch on it (e.g. useUsers telling a 401/403 from an outage).
      Object.assign(err, { status: response.status });
      throw err;
    });
  }
  return response.json();
}
