import responseToJSON from "./responseToJson";
import { JsonResponse } from "../shared/types";

export default async function fetchJSON<T extends object>(
  url: string,
  options?: RequestInit & { useCache?: boolean },
): Promise<JsonResponse> {
  if (options?.useCache) {
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

  if (options?.useCache) {
    const result = await responseToJSON(response);
    try {
      window.localStorage.setItem(url, JSON.stringify(result.data));
    } catch (e) {
      console.log("can't save");
    }
    return result;
  }

  return responseToJSON(response);
}