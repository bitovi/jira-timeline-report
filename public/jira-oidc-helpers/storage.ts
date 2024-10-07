
import { FetchJiraIssuesParams } from "./types";

export function saveInformationToLocalStorage(
    parameters: Record<string, string | number | string[]>,
) {
    const objectKeys = Object.keys(parameters) as Array<
        keyof FetchJiraIssuesParams
    >;
    for (let key of objectKeys) {
        const value = parameters[key];
        if (value) {
            // TODO: This is a hack to get around the fact that we can't store arrays in local storage, should everything JSON.stringify? Are arrays real?
            window.localStorage.setItem(
                key,
                Array.isArray(value) ? "" : value.toString(),
            );
        } else {
            window.localStorage.removeItem(key);
        }
    }
}

export function clearAuthFromLocalStorage() {
    window.localStorage.removeItem("accessToken");
    window.localStorage.removeItem("refreshToken");
    window.localStorage.removeItem("expiryTimestamp");
}

export function fetchFromLocalStorage(key: string) {
    return window.localStorage.getItem(key);
}
