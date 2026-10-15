import { kvs } from '@forge/kvs';
import Resolver from '@forge/resolver';

import { STARS_GET, STARS_SET, STORAGE_GET, STORAGE_SET } from './contract';

/**
 * This app's only backend.
 *
 * It exists for one reason: `@forge/kvs` runs server-side only, and `@forge/bridge` — the sole
 * Forge package a Custom UI frontend can import — exports no key-value API. So reaching Forge's
 * Key-Value Store and having a resolver are the same decision. See
 * spec/021-forge/resolver-storage/plan.md.
 *
 * The second reason is per-user data. Starred reports (`stars.get` / `stars.set`) are keyed by the
 * invocation context's `accountId`, which only the resolver can be trusted to supply — a key built
 * from the browser's payload would let anyone read or write anyone's stars. See
 * spec/041-saved-reports-redesign/phase1/plan.md § 5.
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

/**
 * KVS key rule (https://developer.atlassian.com/platform/forge/limits-kvs-ce/). Account ids only use
 * letters, digits, `:` and `-`, so this never fails for one we know; it guards an id format we
 * haven't seen from turning into a KVS error somewhere less obvious.
 */
const KVS_KEY_PATTERN = /^(?!\s+$)[a-zA-Z0-9:._\s\-#]+$/;
const KVS_KEY_MAX_LENGTH = 500;

/** Report ids are UUIDs, so 1000 of them is ~39 KB of JSON — well inside KVS's 240 KiB per value. */
export const MAX_STARRED_REPORTS = 1000;

/**
 * `starred-reports:{accountId}`, from the invocation **context** — never the payload. One key per
 * user rather than a shared map: a shared map is a read-modify-write race between users (one user's
 * star silently erases another's), grows without bound, and turns deleting one user's data into an
 * edit of everyone's.
 *
 * Stores bare account ids only. Never put a name, email or avatar next to one — that would make it
 * personal data. See spec/041-saved-reports-redesign/phase1/plan.md § Decisions.
 */
const starsKey = (context: unknown): string => {
  const accountId = (context as { accountId?: unknown } | undefined)?.accountId;

  if (typeof accountId !== 'string' || !accountId) {
    throw new Error('[Stars Error]: the resolver was invoked without a user');
  }

  const key = `starred-reports:${accountId}`;

  if (key.length > KVS_KEY_MAX_LENGTH || !KVS_KEY_PATTERN.test(key)) {
    throw new Error('[Stars Error]: the account id cannot be used as a storage key');
  }

  return key;
};

/** Same envelope as `storage.get`, so "never starred anything" isn't confused with a failure. */
resolver.define(STARS_GET, async ({ context }) => ({
  value: await kvs.get(starsKey(context)),
}));

resolver.define(STARS_SET, async ({ payload, context }) => {
  const key = starsKey(context);
  const ids = (payload as { ids?: unknown } | undefined)?.ids;

  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) {
    throw new Error('[Stars Error]: starred reports must be a list of report ids');
  }

  if (ids.length > MAX_STARRED_REPORTS) {
    throw new Error(`[Stars Error]: cannot star more than ${MAX_STARRED_REPORTS} reports`);
  }

  await kvs.set(key, ids);
});

export const handler = resolver.getDefinitions();
