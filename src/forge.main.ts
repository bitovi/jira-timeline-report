import { router, view } from '@forge/bridge';

import mainHelper from './shared/main-helper.js';
import { createForgeStorage } from './jira/storage/index.web';
import { createForgeLinkBuilder, createForgeRouting } from './routing/index.forge';
import { getForgeRequestHelper } from './request-helpers/forge-request-helper';
import { interceptExternalLinkClicks, setExternalOpener } from './shared/open-external';

import type { RoutingConfiguration } from './routing/common';

interface LicensingInformation {
  active: boolean;
  evaluation: boolean;
}

/**
 * Forge reports licensing on the view context rather than over REST.
 *
 * `license` is absent for free apps and for anything running in the development or staging
 * environments, so **an absent license means allowed** — the same bypass `plugin.main.ts:17` makes
 * for Connect staging/local builds. A context read that fails is treated the same way: locking a
 * free app out because a bridge call hiccuped is a worse failure than briefly under-enforcing.
 */
const getLicensing = async (): Promise<LicensingInformation> => {
  try {
    const { license } = await view.getContext();

    if (!license) {
      return { active: true, evaluation: false };
    }

    return { active: license.active, evaluation: license.isEvaluation };
  } catch (err) {
    console.error('Error reading Forge licensing information', err);

    return { active: true, evaluation: false };
  }
};

/**
 * The URL mirror, or `null` if the bridge could not give us one.
 *
 * Degrading rather than throwing is deliberate: without the mirror the app still boots, reads and
 * writes — it just loses state on refresh. Letting a failed `view.createHistory()` reject would
 * take the whole app down over the one feature that is only a convenience.
 */
const getRouting = async (): Promise<RoutingConfiguration | null> => {
  try {
    return await createForgeRouting();
  } catch (err) {
    console.error('Could not create the Forge history mirror; URL state will not survive a refresh', err);

    return null;
  }
};

/**
 * The Forge sandbox has no `allow-popups`, so every `target="_blank"` link in a report — which is
 * how a user gets from a chart to the underlying work item — silently does nothing. `router.open`
 * asks the container to open it instead.
 *
 * Installed before `mainHelper` so it is in place ahead of the first render, and fire-and-forget
 * because `router.open` returns a promise no caller waits on.
 */
const installExternalOpener = (): void => {
  setExternalOpener((url) => {
    void router.open(url).catch((err) => {
      console.error(`Could not open ${url} outside the app`, err);
    });
  });

  interceptExternalLinkClicks();
};

export default async function main() {
  installExternalOpener();

  // Awaited before `mainHelper`, not inside `configureRouting`: `view.createHistory()` is async and
  // `AP.history` is not, so this is the one place the Forge bootstrap genuinely differs in shape
  // from the Connect one. `configureRouting` is called synchronously by `mainHelper`, so the
  // history object has to already exist by then.
  const routing = await getRouting();

  return mainHelper(
    {
      JIRA_CLIENT_ID: import.meta.env.VITE_JIRA_CLIENT_ID,
      JIRA_SCOPE: import.meta.env.VITE_JIRA_SCOPE,
      JIRA_CALLBACK_URL: import.meta.env.VITE_JIRA_CALLBACK_URL,
      JIRA_API_URL: import.meta.env.VITE_JIRA_API_URL,
      JIRA_APP_KEY: import.meta.env.VITE_JIRA_APP_KEY,
      COMMIT_SHA: import.meta.env.VITE_COMMIT_SHA,
      STATUS_REPORTS_ENV: import.meta.env.VITE_STATUS_REPORTS_ENV,
      // Deliberately left unset for the Forge build: `initSentry` sets `enabled:
      // !!FRONTEND_SENTRY_DSN` (shared/sentry.js:14), so Sentry disables itself and the app needs
      // no egress declaration — which would otherwise be a permission customers see at install.
      FRONTEND_SENTRY_DSN: import.meta.env.VITE_FRONTEND_SENTRY_DSN,
    },
    {
      host: 'forge',
      createRequestHelper: getForgeRequestHelper,
      createStorage: createForgeStorage,
      configureRouting: (
        route: {
          start: () => void;
          _onStartComplete: unknown;
        },
        { beforeRouteStart }: { beforeRouteStart: () => void },
      ) => {
        // Three ordering constraints, all of them load-bearing — the same set documented at
        // plugin.main.ts:58 and in jira/reports/migrations/url.ts. Getting any of them wrong loses
        // state silently rather than failing.
        //
        // 1. `reconcileRoutingState()` first: it replaces the *entire* search string with the
        //    container's params, so anything written before it is discarded.
        routing?.reconcileRoutingState();

        // 2. The legacy-param rewrite after that reconcile but before `route.start()` — after the
        //    start it would be invisible to `pushStateObservable`.
        beforeRouteStart();

        // 3. `syncRouters` after start, via `_onStartComplete`: it patches `history.pushState` to
        //    echo into the container, and there is nothing to echo until the router is running.
        if (routing) {
          route._onStartComplete = routing.syncRouters;
        }

        route.start();
      },
      createLinkBuilder: createForgeLinkBuilder,
      showSidebarBranding: true,
      isAlwaysLoggedIn: true,
      licensingPromise: getLicensing(),
    },
  );
}

main();
