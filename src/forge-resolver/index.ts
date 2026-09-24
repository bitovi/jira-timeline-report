import { kvs } from '@forge/kvs';
import Resolver from '@forge/resolver';

import { STORAGE_GET, STORAGE_SET } from './contract';

/**
 * This app's only backend.
 *
 * It exists for one reason: `@forge/kvs` runs server-side only, and `@forge/bridge` — the sole
 * Forge package a Custom UI frontend can import — exports no key-value API. So reaching Forge's
 * Key-Value Store and having a resolver are the same decision. See
 * spec/021-forge/resolver-storage/plan.md.
 *
 * Deliberately thin. Everything else in this app still talks to Jira straight from the iframe
 * through `requestJira`, which is what keeps it off the Forge invocation quota and what makes
 * `asApp()` unreachable — the app cannot escalate beyond the current user's permissions. Do not
 * grow this file into a general-purpose backend without revisiting that.
 *
 * KVS is namespaced per app installation, so these keys are already scoped to one site. There is no
 * tenant id to thread through and no cross-site read to guard against.
 */
const resolver = new Resolver();

/**
 * The payload crosses `invoke()` from the browser, so it is untrusted input rather than a typed
 * call. A missing key would otherwise reach `kvs.get(undefined)` and fail somewhere less obvious.
 */
const requireKey = (payload: unknown): string => {
  const key = (payload as { key?: unknown } | undefined)?.key;

  if (typeof key !== 'string' || !key) {
    throw new Error('[Storage Error]: the resolver was called without a key');
  }

  return key;
};

/**
 * Answers in an envelope rather than returning the value bare, so the frontend can tell "this key
 * was never written" (`{ value: undefined }` → its `defaultShape`) from a failure, which arrives as
 * a rejection instead. Collapsing those two is what would show a user an empty app and let the next
 * save overwrite reports that were there all along.
 */
resolver.define(STORAGE_GET, async ({ payload }) => ({
  value: await kvs.get(requireKey(payload)),
}));

resolver.define(STORAGE_SET, async ({ payload }) => {
  await kvs.set(requireKey(payload), (payload as { value: unknown }).value);
});

export const handler = resolver.getDefinitions();
