import { requestJira } from '@forge/bridge';

import { responseToJSON } from '../utils/fetch/response-to-json';

import type { RequestHelper } from '../jira-oidc-helpers/types';
import type { RequestHelperResponse } from '../shared/types';

type RequestOptions = {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
};

/**
 * Turns the app's URL fragments into the `/rest/…` path `requestJira` expects.
 *
 * Call sites are inconsistent about the leading slash — `'/api/3/serverInfo'` (serverInfo.ts:8) vs
 * `'api/3/search/approximate-count'` (fetchAllJiraIssuesWithJQLAndFetchAllChangelog.ts:58) — so
 * this normalizes rather than making twelve call sites agree.
 */
const toRestPath = (urlFragment: string): string => {
  if (/^https?:\/\//i.test(urlFragment)) {
    // The only absolute URL the app issues is
    // `api.atlassian.com/oauth/token/accessible-resources`, which exists to turn an OAuth token
    // into a cloud id. Forge is handed its site by the container, so reaching this is a bug in a
    // host branch somewhere rather than something to paper over with a passthrough `fetch`.
    throw new Error(`[forge] Absolute URLs are not routable from a Forge app: ${urlFragment}`);
  }

  return `/rest/${urlFragment.replace(/^\/+/, '')}`;
};

/**
 * The Forge host's request helper.
 *
 * Modelled on the *hosted* helper rather than the Connect one: `requestJira` resolves to a WHATWG
 * `Response`, so `responseToJSON` — the same error-carrying parse the website uses — drops
 * straight in. Connect is the odd host out; it resolves `{body: string}` and rejects with `{err}`
 * holding a JSON *string*, which is why `connect-request-helper.js` hand-rolls its parsing.
 *
 * Auth is the container's problem: the iframe is already authenticated as the viewing user, scoped
 * to whatever `permissions.scopes` in manifest.yml declares. There is no token to attach and
 * nothing to refresh.
 */
export function getForgeRequestHelper(): RequestHelper {
  return <TValues = any[], TIssues = unknown>(urlFragment: string, options: RequestOptions = {}) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    };

    return requestJira(toRestPath(urlFragment), {
      method: options.method || 'GET',
      headers,
      ...(options.body ? { body: options.body } : {}),
    }).then(responseToJSON) as unknown as Promise<RequestHelperResponse<TValues, TIssues>>;
  };
}
