import { TimelineReport } from '../timeline-report';

import '../shared/select-cloud';
import { initSentry } from './sentry';

import JiraLogin from '../shared/jira-login';
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

// Import React components for login page
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import LoginPageWrapper from '../react/components/LoginPage/LoginPageWrapper';

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

  // Check if we should show the login page
  const shouldShowLoginPage = !isAlwaysLoggedIn && !jiraHelpers.hasValidAccessToken() && host !== 'jira';

  if (shouldShowLoginPage) {
    return showLoginPageAndWaitForAuth(config, {
      host,
      createStorage,
      configureRouting,
      showSidebarBranding,
      isAlwaysLoggedIn,
      createLinkBuilder,
      licensingPromise,
    });
  }

  // Continue with existing logic for already authenticated users
  return initializeMainApplication(config, {
    host,
    createStorage,
    configureRouting,
    showSidebarBranding,
    isAlwaysLoggedIn,
    createLinkBuilder,
    licensingPromise,
  });
}

async function showLoginPageAndWaitForAuth(config, options) {
  const mainContent = document.getElementById('mainContent');
  const loadingJira = document.getElementById('loadingJira');

  if (loadingJira) {
    loadingJira.style.display = 'none';
  }

  // Clear main content and show login page
  mainContent.innerHTML = '';
  const loginContainer = document.createElement('div');
  loginContainer.id = 'login-page-container';
  mainContent.appendChild(loginContainer);

  const root = createRoot(loginContainer);

  return new Promise((resolve) => {
    const jiraHelpers = JiraOIDCHelpers(config, getHostedRequestHelper(config), options.host);

    root.render(
      createElement(LoginPageWrapper, {
        jiraHelpers,
        onLoginSuccess: () => {
          root.unmount();
          loginContainer.remove();

          // Restore the original structure and continue with main app
          restoreMainContentStructure();
          resolve(initializeMainApplication(config, options));
        },
        onGuestAccess: () => {
          root.unmount();
          loginContainer.remove();

          // Set up guest mode
          routeData.isGuestMode = true;

          // Restore the original structure and continue with main app
          restoreMainContentStructure();
          resolve(initializeMainApplication(config, { ...options, isGuestMode: true }));
        },
      }),
    );
  });
}

function restoreMainContentStructure() {
  const mainContent = document.getElementById('mainContent');
  mainContent.innerHTML = `
    <div class="color-bg-white px-4 top-0 z-50 border-b border-neutral-301">
      <nav class="mx-auto py-2 place-center">
        <div class="flex gap-4" style="align-items: center">
          <ul class="flex gap-3 grow items-baseline">
            <li>
              <a
                href="https://github.com/bitovi/jira-timeline-report"
                class="color-gray-900 font-3xl underline-on-hover bitovi-font-poppins font-bold"
              >
                Status Reports for Jira
              </a>
            </li>
            <li>
              <a
                href="https://www.bitovi.com/services/agile-project-management-consulting"
                class="bitovi-poppins color-text-bitovi-red-orange"
                style="line-height: 37px; font-size: 14px; text-decoration: none"
              >
                by <img src="./images/bitovi-logo.png" class="inline align-baseline" />
              </a>
            </li>
          </ul>
          <select-cloud></select-cloud>
          <div id="login"></div>
        </div>
      </nav>
    </div>
    <div id="loadingJira" class="place-center" style="display: none;">
      <p class="my-2">Loading the Jira Timeline Report ...</p>
    </div>
  `;
}

async function initializeMainApplication(config, options) {
  const {
    host,
    createStorage,
    configureRouting,
    showSidebarBranding,
    isAlwaysLoggedIn,
    createLinkBuilder,
    licensingPromise,
    isGuestMode,
  } = options;

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

  const props =
    isAlwaysLoggedIn || isGuestMode
      ? {
          isLoggedIn: true,
        }
      : {};

  const loginComponent = new JiraLogin().initialize({ jiraHelpers, ...props });
  routeData.isLoggedInObservable = value.from(loginComponent, 'isLoggedIn');
  routeData.jiraHelpers = jiraHelpers;
  routeData.storage = storage;
  routeData.licensingPromise = licensingPromise;

  // Set guest mode flag in route data
  if (isGuestMode) {
    routeData.isGuestMode = true;
  }

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

  const selectCloud = document.querySelector('select-cloud');
  if (selectCloud) {
    selectCloud.loginComponent = loginComponent;
    selectCloud.jiraHelpers = jiraHelpers;
  }

  const login = document.getElementById('login');
  const loadingJira = document.getElementById('loadingJira');
  const mainContent = document.getElementById('mainContent');

  const listener = ({ value }) => {
    if (value) {
      loginComponent.off('isResolved', listener);
      if (loadingJira) {
        loadingJira.style.display = 'none';
      }
      timelineReportNeedsMet.loginResolved = true;
      checkForNeedsAndInsertTimelineReport();
    }
  };

  function checkForNeedsAndInsertTimelineReport() {
    // if every need met, initialize
    if (Object.values(timelineReportNeedsMet).every((value) => value)) {
      // TODO: this is just to make sure things are bound so react can be cool
      routeData.on('timingCalculations', () => {});

      const report = new TimelineReport().initialize({
        jiraHelpers,
        loginComponent,
        mode: 'TEAMS',
        storage,
        linkBuilder,
        showSidebarBranding,
        featuresPromise: getFeatures(storage).then((features) => {
          queryClient.setQueryData(featuresKeyFactory.features(), features);

          return features;
        }),
      });
      report.className = 'flex flex-1 overflow-hidden';
      mainContent.append(report);
    }
  }

  loginComponent.on('isResolved', listener);
  if (login) {
    login.appendChild(loginComponent);
  }
  if (host === 'jira') {
    if (login) {
      login.style.display = 'none';
    }
  }

  return loginComponent;
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
