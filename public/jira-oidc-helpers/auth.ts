/**
 * this module contains a collection of helper functions for authentication. 
 */
import fetchJSON from "./fetch";
import { Config } from "./types";
import {
  saveInformationToLocalStorage,
  clearAuthFromLocalStorage,
  fetchFromLocalStorage
} from "./storage";

export const fetchAuthorizationCode = (config: Config) => () => {
  const url = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${config.env.JIRA_CLIENT_ID}&scope=${config.env.JIRA_SCOPE}&redirect_uri=${config.env.JIRA_CALLBACK_URL}&response_type=code&prompt=consent&state=${encodeURIComponent(encodeURIComponent(window.location.search))}`;
  window.location.href = url;
};

export const refreshAccessToken = (config: Config) =>
  async (accessCode?: string): Promise<string | undefined> => {
    try {
      const response = await fetchJSON(
        `${config.env.JIRA_API_URL}/?code=${accessCode}`
      );

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
    const { accessToken, expiryTimestamp, refreshToken, scopeId } = await fetchJSON(`./access-token?code=${authCode}`);

    saveInformationToLocalStorage({
      accessToken,
      refreshToken,
      expiryTimestamp,
      //scopeId,
    });
    //redirect to data page
    const addOnQuery = new URL(
      window.location as unknown as string | URL
    ).searchParams.get("state");
    // const decoded = decodeURIComponent(addOnQuery as string);
    location.href = "/" + (addOnQuery ?? "");
  } catch (error) {
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

