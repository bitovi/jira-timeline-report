import { requestJira } from '@forge/bridge';

import type { JiraImageResolver } from '../shared/jira-image-src';

/**
 * The `/rest/…` path `requestJira` wants for an absolute Jira image URL, or `null` when it has none.
 *
 * Custom issue-type icons arrive as `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/2/...`.
 * `requestJira` adds that gateway prefix itself, so passing anything before `/rest/` double-prefixes
 * the request and it fails.
 */
export const toJiraRestPath = (url: string): string | null => {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const restIndex = parsed.pathname.indexOf('/rest/');

  return restIndex < 0 ? null : `${parsed.pathname.slice(restIndex)}${parsed.search}`;
};

/**
 * Only avatar images go through the bridge. Anything else (a site-hosted `/images/icons/...` path, a
 * data URL) is left as-is — the gateway is not known to proxy non-REST paths, and an image that
 * already renders should not cost a bridge round trip.
 */
const isJiraAvatar = (url: string): boolean => url.includes('/universal_avatar/');

/**
 * Forge's image resolver: fetches each avatar once through `requestJira` — which carries the
 * viewing user's auth, unlike `<img>` — and hands back a `blob:` URL, which Forge's default
 * `img-src` already allows. No manifest change, and no resolver invocation: this stays in the iframe
 * like every other Jira call (see the note under `function:` in manifest.yml).
 *
 * `read:jira-work` covers `universal_avatar` per Jira's OpenAPI spec (spec/040-custom-issue-icons).
 *
 * Best-effort: a failed fetch falls back to the raw URL — no worse than before — and is cached too,
 * so a broken icon is not refetched on every render. Blob URLs are never revoked; there is one per
 * distinct issue type, so they live for the session.
 */
export function createForgeImageResolver(request: typeof requestJira = requestJira): JiraImageResolver {
  const cache = new Map<string, string | Promise<string>>();

  return (url) => {
    const cached = cache.get(url);
    if (cached !== undefined) return cached;

    const path = isJiraAvatar(url) ? toJiraRestPath(url) : null;

    if (!path) {
      cache.set(url, url);
      return url;
    }

    const pending = request(path)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        return URL.createObjectURL(await response.blob());
      })
      .catch((err) => {
        console.warn(`Could not load Jira image ${path}; falling back to its URL`, err);

        return url;
      })
      .then((src) => {
        cache.set(url, src);

        return src;
      });

    cache.set(url, pending);

    return pending;
  };
}
