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
      throw err;
    });
  }
  return response.json();
}
