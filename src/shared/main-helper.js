import TimelineReport from '../react/TimelineReport';

import { initSentry } from './sentry';

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';

import { Login } from '../stateful-data/login.js';
import LoginButton from '../react/LoginButton';
import SelectCloudWrapper from '../react/SelectCloud';
import JiraOIDCHelpers from '../jira-oidc-helpers';

import { migrateUrlParams } from '../jira/reports/migrations/url';
import { route, value, domMutateDomEvents, domEvents } from '../can';
import routeData from '../canjs/routing/route-data';
import { getFeatures } from '../jira/features/fetcher';
import { featuresKeyFactory } from '../react/services/features/key-factory';
import { queryClient } from '../react/services/query/queryClient';
import { getAllReports } from '../jira/reports/fetcher';
import { getReportsBackend, initReportsStorage } from '../jira/reports/backend';
import { installSavedReportsDebugger } from '../jira/reports/debug';
import { reportKeys } from '../react/services/reports/key-factory';

domEvents.addEvent(domMutateDomEvents.inserted);

export default async function mainHelper(
  config,
  {
    host,
    createRequestHelper,
    createStorage,
    configureRouting,
    showSidebarBranding,
    isAlwaysLoggedIn,
    createLinkBuilder,
    licensingPromise,
  },
) {
  initSentry(config);

  // LEGACY URL SUPPORT — rewrites legacy params (e.g. `primaryReportType=breakdown`) from the shared
  // migration table. Handed to the host rather than called here because it has to land between the
  // Connect host's `reconcileRoutingState()` (which replaces the whole search string, discarding
  // anything written before it) and `route.start()` (after which the rewrite would be invisible to
  // `pushStateObservable`). See jira/reports/migrations/url.ts.
  configureRouting(route, { beforeRouteStart: migrateUrlParams });

  console.log('Loaded version of the Timeline Reporter: ' + config?.COMMIT_SHA);

  // Which helper to use is the host's own business — it used to be decided here by branching on
  // `host`, which meant every new host had to edit shared code to get its transport wired up.
  const requestHelper = createRequestHelper(config);

  const jiraHelpers = JiraOIDCHelpers(config, requestHelper, host);

  const storage = createStorage(jiraHelpers);
  const linkBuilder = createLinkBuilder(jiraHelpers.appKey);

  // Where saved reports live is a per-site setting (the legacy single record, or a work item per
  // report in a Reports Space) read once here. Deliberately not awaited: `getReportsBackend`
  // returns a facade that waits on this read itself, so nothing below has to be ordered after it
  // and boot doesn't grow a round trip. See spec/026-storage-saved-reports.
  void initReportsStorage({ storage, jiraHelpers });
  const reportsBackend = getReportsBackend(storage);

  // Console helper: `logSavedReports()` dumps every saved report with its data.
  installSavedReportsDebugger(reportsBackend);

  const props = isAlwaysLoggedIn
    ? {
        isLoggedIn: true,
      }
    : {};

  // Observable auth store — the single source of truth for login state. Feeds
  // both the remaining CanJS StacheElements (timeline-report view) and React
  // (LoginButton, SelectCloud). Auto-login runs in its constructor (may resolve
  // synchronously).
  const loginStore = new Login({ jiraHelpers, ...props });
  routeData.isLoggedInObservable = value.from(loginStore, 'isLoggedIn');
  routeData.jiraHelpers = jiraHelpers;
  routeData.storage = storage;
  routeData.licensingPromise = licensingPromise;

  const timelineReportNeedsMet = {
    loginResolved: false,
  };

  // if we have a report, we need to wait for reportData
  // otherwise, _every_ routeData property will suddenly have a "waiting" state ...
  // instead, we can just wait here while we are checking logged in
  const report = new URL(window.location).searchParams.get('report');
  if (report) {
    console.log('Loading report data ... ');
    timelineReportNeedsMet.reportData = false;
    getAllReports(reportsBackend).then((reports) => {
      queryClient.setQueryData(reportKeys.allReports, reports);

      timelineReportNeedsMet.reportData = true;
      checkForNeedsAndInsertTimelineReport();
    });
  }

  // Mount the React site picker. `routeData.isLoggedInObservable` (:77) and
  // `routeData.jiraHelpers` (:78) are set above, so the wrapper reads them at
  // mount. The Connect (`jira`) host has no #select-cloud div, so this stays a
  // no-op there — same as the old querySelector guard.
  const selectCloudEl = document.getElementById('select-cloud');
  if (selectCloudEl) {
    createRoot(selectCloudEl).render(createElement(SelectCloudWrapper));
  }

  function checkForNeedsAndInsertTimelineReport() {
    // if every need met, initialize
    if (Object.values(timelineReportNeedsMet).every((value) => value)) {
      // TODO: this is just to make sure things are bound so react can be cool
      routeData.on('timingCalculations', () => {});

      // Seed features into React Query. This was previously passed to the shell as
      // `featuresPromise`, but the seeding is a side effect of the promise chain (reports read
      // features via React Query, not the shell), so it runs here independent of the mount.
      getFeatures(storage).then((features) => {
        queryClient.setQueryData(featuresKeyFactory.features(), features);

        return features;
      });

      // The shell is now a React tree. Mount it into a flex container appended to #mainContent
      // (the class carries the layout the StacheElement's host element used to provide).
      const container = document.createElement('div');
      container.className = 'flex flex-1 overflow-hidden';
      mainContent.append(container);

      createRoot(container).render(
        createElement(TimelineReport, {
          loginComponent: loginStore,
          storage,
          linkBuilder,
          // Embedded hosts build *container* URLs, so following one would navigate the whole page
          // out from under the iframe; the click has to become an SPA route change instead.
          interceptLinkClicks: host !== 'hosted',
          showSidebarBranding,
        }),
      );
    }
  }

  // Bootstrap gate. Await the store's `resolved` promise rather than
  // subscribing to the `isResolved` change event — the store's auto-login can
  // settle *synchronously* in its constructor (valid token / seed), and a plain
  // `.on()` only delivers future changes, so the app would never mount. The
  // promise is immune to that ordering (see stateful-data/login.js).
  loginStore.resolved.then(() => {
    loadingJira.style.display = 'none';
    timelineReportNeedsMet.loginResolved = true;
    checkForNeedsAndInsertTimelineReport();
  });

  // Render the thin React login button into <div id="login">.
  createRoot(login).render(
    createElement(LoginButton, {
      store: loginStore,
      isLoggedInObservable: value.from(loginStore, 'isLoggedIn'),
      isPendingObservable: value.from(loginStore, 'isPending'),
    }),
  );
  // The embedded hosts (Connect, Forge) are authenticated by their container, so there is nothing
  // for a login button to do. Only the standalone website has a session the user can start.
  if (host !== 'hosted') {
    login.style.display = 'none';
  }

  return loginStore;
}
