import TimelineReport from '../react/TimelineReport';

import { initSentry } from './sentry';

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';

import { Login } from '../stateful-data/login.js';
import LoginButton from '../react/LoginButton';
import SelectCloudWrapper from '../react/SelectCloud';
import JiraOIDCHelpers from '../jira-oidc-helpers';
import { getHostedRequestHelper } from '../request-helpers/hosted-request-helper';
import { getConnectRequestHelper } from '../request-helpers/connect-request-helper';

import { directlyReplaceUrlParam } from '../canjs/routing/state-storage';
import { route, value, domMutateDomEvents, domEvents } from '../can';
import routeData from '../canjs/routing/route-data';
import { getFeatures } from '../jira/features/fetcher';
import { featuresKeyFactory } from '../react/services/features/key-factory';
import { queryClient } from '../react/services/query/queryClient';
import { getAllReports } from '../jira/reports/fetcher';
import { reportKeys } from '../react/services/reports/key-factory';

domEvents.addEvent(domMutateDomEvents.inserted);

export default async function mainHelper(
  config,
  { host, createStorage, configureRouting, showSidebarBranding, isAlwaysLoggedIn, createLinkBuilder, licensingPromise },
) {
  initSentry(config);

  let fix = await legacyPrimaryReportingTypeRoutingFix();
  fix = await legacyPrimaryIssueTypeRoutingFix();

  configureRouting(route);

  console.log('Loaded version of the Timeline Reporter: ' + config?.COMMIT_SHA);

  let requestHelper;
  if (host === 'jira') {
    requestHelper = getConnectRequestHelper();
  } else {
    requestHelper = getHostedRequestHelper(config);
  }

  const jiraHelpers = JiraOIDCHelpers(config, requestHelper, host);

  // Temporary will be removed in two weeks
  if (host === 'hosted') {
    requestHelper('https://api.atlassian.com/oauth/token/accessible-resources')
      .then(([request]) => {
        return fetch(`${import.meta.env.VITE_AUTH_SERVER_URL}/domain`, {
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({ domain: request.url }),
        });
      })
      .catch(console.warn);
  }
  //

  const storage = createStorage(jiraHelpers);
  const linkBuilder = createLinkBuilder(jiraHelpers.appKey);

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
    getAllReports(storage).then((reports) => {
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
  if (host === 'jira') {
    login.style.display = 'none';
  }

  return loginStore;
}

// LEGACY URL SUPPORT
function legacyPrimaryReportingTypeRoutingFix() {
  const primaryIssueType = new URL(window.location).searchParams.get('primaryReportType');
  if (primaryIssueType === 'breakdown') {
    directlyReplaceUrlParam('primaryReportType', 'start-due');
    directlyReplaceUrlParam('primaryReportBreakdown', 'true');
    console.warn('fixing url');
  }
}

function legacyPrimaryIssueTypeRoutingFix() {
  const primaryIssueType = new URL(window.location).searchParams.get('primaryIssueType');
  if (primaryIssueType) {
    directlyReplaceUrlParam('primaryIssueType', '', '');
    directlyReplaceUrlParam('selectedIssueType', primaryIssueType, '');
    console.warn('fixing url');
  }
}
