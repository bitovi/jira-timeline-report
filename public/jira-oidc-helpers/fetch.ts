/**
 * this module contains helper functions for requesting json over http. 
 */
import {responseToJSON} from "../shared/response-to-json";
import { JsonResponse } from "../shared/types";

export function nativeFetchJSON<T>(url: string, options?: RequestInit): Promise<JsonResponse<T>> {
  return fetch(url, options).then(responseToJSON<T>);
}

export default async function fetchJSON<T extends object>(
  url: string,
  options?: RequestInit & { useCache?: boolean },
): Promise<JsonResponse<T>> {
  let useCache = options?.useCache;
  if (useCache) {
    // Add a TTL or only keep in a variable so it clears on page refresh
    const cachedData = window.localStorage.getItem(url);
    if (cachedData !== null) {
      return JSON.parse(cachedData);
    }
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const payload = await response.json();
    const err = new Error("HTTP status code: " + response.status);
    Object.assign(err, payload);
    Object.assign(err, response as any);
    throw err;
  }

  if (useCache) {
    const result = await responseToJSON<T>(response);
    try {
      window.localStorage.setItem(url, JSON.stringify(result.data));
    } catch (e) {
      console.log("can't save");
    }
    return result;
  }

  return responseToJSON(response);
}