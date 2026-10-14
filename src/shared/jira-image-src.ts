/**
 * Turning a Jira image URL (issue-type icons) into something an `<img>` on the current host can load.
 *
 * Exists because of Forge. Through `requestJira`, Jira hands back custom issue-type icons as
 * API-gateway URLs — `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/2/universal_avatar/...`
 * — and the gateway wants a bearer token a plain `<img>` never sends, so those icons 401 and render
 * blank (ECO-56). Web and Connect get site URLs the browser's own session cookie already covers.
 *
 * Same indirection as `open-external.ts` and `reload-app.ts`: the call sites are shared React code
 * that knows nothing about the host. A host installs its resolver at boot; every other host keeps
 * the default and renders the URL exactly as it does today. See spec/040-custom-issue-icons.
 */

/** A string when the answer is already known (so cached icons render on the first frame), else a promise. */
export type JiraImageResolver = (url: string) => string | Promise<string>;

const defaultResolver: JiraImageResolver = (url) => url;

let resolver: JiraImageResolver = defaultResolver;

/** Installed by the host entry (see `forge.main.ts`). Hosts whose `<img>` can load Jira URLs never call this. */
export const setJiraImageResolver = (next: JiraImageResolver): void => {
  resolver = next;
};

/** Test-only: module state has to be clearable between tests. */
export const resetJiraImageResolver = (): void => {
  resolver = defaultResolver;
};

/** The `src` to give an `<img>` for this Jira image URL, however the current host can load it. */
export const resolveJiraImageSrc = (url: string): string | Promise<string> => resolver(url);
