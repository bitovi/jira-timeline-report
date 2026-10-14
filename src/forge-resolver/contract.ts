/**
 * The function keys the frontend and the resolver agree on.
 *
 * Shared rather than written out twice because a typo on either side is invisible until the app is
 * running in Jira: `invoke()` would reject with "function not found" and the user would see a
 * storage error. Deliberately dependency-free — the frontend bundle and the Forge function bundle
 * both import this file, so anything it pulled in would end up in both.
 */
export const STORAGE_GET = 'storage.get';
export const STORAGE_SET = 'storage.set';

/**
 * The current user's starred saved reports. Per user: the resolver keys them by the invocation
 * context's account id, never by anything in the payload. See spec/041-saved-reports-redesign.
 */
export const STARS_GET = 'stars.get';
export const STARS_SET = 'stars.set';
