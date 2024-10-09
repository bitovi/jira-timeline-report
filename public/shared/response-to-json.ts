/**
 * this module is for getting a json object from an http response.
 */
import { JsonResponse } from './types';

export function responseToJSON(response: Response): Promise<JsonResponse> {
	if (!response.ok) {
		return response.json().then((payload) => {
			const err = new Error("HTTP status code: " + response.status);
			Object.assign(err, payload);
			Object.assign(err, response);
			throw err;
		})
	}
	return response.json();
}
