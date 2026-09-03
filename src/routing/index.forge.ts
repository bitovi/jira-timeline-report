import { view } from '@forge/bridge';

import { defineFeatureFlag } from '../shared/feature-flag';

import type { LinkBuilderFactory, RoutingConfiguration } from './common';

const logRouting = defineFeatureFlag('logForgeRouting', 'enables logging within Forge router reconciliation');

/**
 * The history object `view.createHistory()` hands back — a `history` package `History`.
 *
 * Typed off the bridge rather than by importing `history` directly: it is a transitive dependency
 * of `@forge/bridge`, not one this repo declares, so naming it in an import would be a dependency
 * we do not control.
 */
type ForgeHistory = Awaited<ReturnType<typeof view.createHistory>>;

/**
 * The two-way URL mirror for the Forge host.
 *
 * Same shape as the Connect mirror in `index.plugin.ts`, for the same reason: CanJS owns the URL
 * (`route.urlData = pushStateObservable`) and every report's configuration is query-string state,
 * but an embedded iframe cannot write the parent's address bar. So the app keeps its own
 * `window.history` and mirrors it to the container.
 *
 * `view.createHistory()` replaces `AP.history`. The one structural difference from Connect: it is
 * **async**, so the await has to happen before `configureRouting` runs — which is why this is a
 * factory rather than a module-level object. See `forge.main.ts`.
 */
export const createForgeRouting = async (): Promise<RoutingConfiguration> => {
  const forgeHistory: ForgeHistory = await view.createHistory();

  return {
    /**
     * Container → app, once at boot.
     *
     * Load-bearing on Forge even when the container carries no state of ours: the iframe's own
     * `src` arrives with Forge's `?platformFeatureFlags=…` on it, and `route.start()` would
     * otherwise parse those as app state. Replacing the whole search string clears them.
     */
    reconcileRoutingState: () => {
      const search = forgeHistory.location.search ?? '';

      if (logRouting()) {
        console.log('forge routing info', {
          forgeLocation: forgeHistory.location,
          iframeSearch: window.location.search,
        });
        console.log('status reports routing (replace state with)', search);
      }

      // Falls back to the pathname when there is nothing to write, so the URL does not pick up a
      // bare `?` — same reasoning as `directlyReplaceUrlSearch` in canjs/routing/state-storage.js.
      history.replaceState(null, '', search || window.location.pathname);
    },

    /**
     * App → container, for the rest of the session.
     *
     * Patches `history.pushState` so every CanJS route change echoes into the container's URL,
     * which is what lets a refresh come back to the same report. Attached as
     * `route._onStartComplete`, so it must run *after* `route.start()`.
     *
     * `replace`, not `push`, matching Connect: an SPA that rewrites the query string on nearly
     * every interaction would otherwise bury the user's real page history under our own entries.
     * The cost is that browser Back does not step through report states at the container level.
     */
    syncRouters: () => {
      const originalPushState = history.pushState;

      history.pushState = function (...args) {
        originalPushState.apply(this, args);

        // Explicit pathname rather than passing the bare search string: `history.replace('?a=b')`
        // goes through `parsePath`, which yields no pathname and would reset the container's.
        forgeHistory.replace({
          pathname: forgeHistory.location.pathname,
          search: window.location.search,
        });
      };
    },
  };
};

/**
 * Links inside the Forge app.
 *
 * Returns the query string unchanged, like `createWebLinkBuilder`. The Connect builder has to
 * prefix every param with `ac.${appKey}.` and re-attach `project.id`/`project.key` because it
 * builds a *container* URL to navigate the whole page to. Forge does not need that: `Link` is
 * rendered with `interceptLinkClicks`, so a click becomes `history.pushState(href)` — which the
 * mirror above already echoes to the container.
 */
export const createForgeLinkBuilder: LinkBuilderFactory = () => {
  return (queryParams) => queryParams;
};
