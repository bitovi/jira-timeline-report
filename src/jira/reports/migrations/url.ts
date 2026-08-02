import { directlyReplaceUrlSearch } from '../../../canjs/routing/state-storage';
import { migrateQueryParams } from './index';

/**
 * Applies the migration table to the current URL — the legacy-link/bookmark consumer, replacing
 * `legacyPrimaryReportingTypeRoutingFix` and `legacyPrimaryIssueTypeRoutingFix`.
 *
 * `directlyReplaceUrlSearch` deliberately does not publish to `pushStateObservable`, so this must run
 * *before* `route.start()` — otherwise the observable would keep serving the pre-migration search
 * string. In the Connect host it must also run *after* `reconcileRoutingState()`, which replaces the
 * whole search string with the container's params and would discard anything written before it.
 * `main-helper.js` threads it between the two via `configureRouting`'s `beforeRouteStart`.
 *
 * Connect caveat: nothing mirrors this rewrite back into `AP.history` (`syncRouters` patches only
 * `pushState`), so the container URL keeps its legacy param and this runs again on the next load.
 * Harmless — no storage is written here and the runner is idempotent.
 *
 * Returns the ids that applied, for logging and tests.
 * See spec/018-card-report/saved-report-migrations/plan.md § Wiring.
 */
export const migrateUrlParams = (): string[] => {
  const { params, changed, applied } = migrateQueryParams(window.location.search);

  if (!changed) {
    return applied;
  }

  // One write of the whole query string rather than a key-by-key diff: `params` started as a copy of
  // the current search, so untouched params are carried through, removals (primaryIssueType) actually
  // take effect, and the URL never passes through a half-migrated state. Values are re-encoded by
  // `URLSearchParams` in the process — equivalent for every reader in the app, all of which parse the
  // search the same way.
  directlyReplaceUrlSearch(params.toString());

  console.warn(`[reports/migrations] rewrote legacy URL params: ${applied.join(', ')}`);

  return applied;
};
