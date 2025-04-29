/**
 * this module contains a collection of helper functions for authentication.
 */
import fetchJSON from "./fetch";
import { Config } from "./types";
import {
  saveInformationToLocalStorage,
  clearAuthFromLocalStorage,
  fetchFromLocalStorage,
} from "./storage";

export const fetchAuthorizationCode = (config: Config) => () => {
  const url = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${
    config.env.JIRA_CLIENT_ID
  }&scope=${config.env.JIRA_SCOPE}&redirect_uri=${
    config.env.JIRA_CALLBACK_URL
  }&response_type=code&prompt=consent&state=${encodeURIComponent(
    encodeURIComponent(window.location.search)
  )}`;

  console.log({ config, url });
  window.location.href = url;
};

export const timeRemainingBeforeAccessTokenExpiresInSeconds = () => {
  const storageTimeStamp = localStorage.getItem("expiryTimestamp");

  if (!storageTimeStamp) {
    return 0;
  }

  const expiryTimestamp = parseInt(storageTimeStamp, 10);

  if (isNaN(expiryTimestamp)) {
    return 0;
  }

  // Atlassian time stamps are time since unix epoch
  // so we need to match that format
  const currentTimestamp = Math.floor(Date.now() / 1000);

  return -1 * (currentTimestamp - expiryTimestamp);
};

export const refreshAccessToken =
  (config: Config) =>
  async (accessCode?: string): Promise<string | undefined> => {
    try {
      const response = await fetchJSON(`${config.env.JIRA_API_URL}/?code=${accessCode}`);

      const { accessToken, expiryTimestamp, refreshToken } = response;
      saveInformationToLocalStorage({
        accessToken,
        refreshToken,
        expiryTimestamp,
      });
      return accessToken;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error("An unknown error occurred");
      }
      clearAuthFromLocalStorage();
      fetchAuthorizationCode(config)();
    }
  };

export async function fetchAccessTokenWithAuthCode(authCode: string): Promise<void> {
  try {
    const { accessToken, expiryTimestamp, refreshToken, scopeId } = await fetchJSON(
      `${import.meta.env.VITE_AUTH_SERVER_URL}/access-token?code=${authCode}`
    );

    saveInformationToLocalStorage({
      accessToken,
      refreshToken,
      expiryTimestamp,
      // Only include the scopeId if there wasn't one already set
      ...(fetchFromLocalStorage("scopeId") ? {} : { scopeId }),
    });
    //redirect to data page
    const addOnQuery = new URL(window.location as unknown as string | URL).searchParams.get(
      "state"
    );
    // const decoded = decodeURIComponent(addOnQuery as string);
    location.href = "/" + (addOnQuery ?? "");
  } catch (error) {
    console.warn(error);
    //handle error properly.
    console.error(error);
    // location.href = '/error.html';
  }
}

export const getAccessToken = (config: Config) => async () => {
  if (!hasValidAccessToken()) {
    const refreshToken = fetchFromLocalStorage("refreshToken");
    if (!refreshToken) {
      fetchAuthorizationCode(config)();
    } else {
      return refreshAccessToken(config)();
    }
  } else {
    return fetchFromLocalStorage("accessToken");
  }
};

export const hasAccessToken = (): boolean => {
  return !!fetchFromLocalStorage("accessToken");
};

export const hasValidAccessToken = (): boolean => {
  const accessToken = fetchFromLocalStorage("accessToken");
  let expiryTimestamp = Number(fetchFromLocalStorage("expiryTimestamp"));
  if (isNaN(expiryTimestamp)) {
    expiryTimestamp = 0;
  }
  const currentTimestamp = Math.floor(new Date().getTime() / 1000.0);
  return !(currentTimestamp > expiryTimestamp || !accessToken);
};
