import { TimelineReport } from "../timeline-report.js";

import "../shared/select-cloud.js";
import { initSentry } from "./sentry.js";

import JiraLogin from "../shared/jira-login.js";
import JiraOIDCHelpers from "../jira-oidc-helpers";
import { getHostedRequestHelper } from "../request-helpers/hosted-request-helper.js";
import { getConnectRequestHelper } from "../request-helpers/connect-request-helper.js";

import { directlyReplaceUrlParam } from "../canjs/routing/state-storage.js";
import { route, value, domMutateDomEvents, domEvents } from "../can.js";
import routeData from "../canjs/routing/route-data";
import { getFeatures } from "../jira/features/fetcher";
import { featuresKeyFactory } from "../react/services/features/key-factory";
import { queryClient } from "../react/services/query/queryClient";

domEvents.addEvent(domMutateDomEvents.inserted);

export default async function mainHelper(
  config,
  {
    host,
    createStorage,
    configureRouting,
    showSidebarBranding,
    isAlwaysLoggedIn,
    createLinkBuilder,
  }
) {
  initSentry(config);

  let fix = await legacyPrimaryReportingTypeRoutingFix();
  fix = await legacyPrimaryIssueTypeRoutingFix();

  configureRouting(route);

  console.log("Loaded version of the Timeline Reporter: " + config?.COMMIT_SHA);

  let requestHelper;
  if (host === "jira") {
    requestHelper = getConnectRequestHelper();
  } else {
    requestHelper = getHostedRequestHelper(config);
  }

  const jiraHelpers = JiraOIDCHelpers(config, requestHelper, host);

  const storage = createStorage(jiraHelpers);
  const linkBuilder = createLinkBuilder(jiraHelpers.appKey);

  const props = isAlwaysLoggedIn
    ? {
        isLoggedIn: true,
      }
    : {};

  const loginComponent = new JiraLogin().initialize({ jiraHelpers, ...props });
  routeData.isLoggedInObservable = value.from(loginComponent, "isLoggedIn");
  routeData.jiraHelpers = jiraHelpers;
  routeData.storage = storage;

  const selectCloud = document.querySelector("select-cloud");
  if (selectCloud) {
    selectCloud.loginComponent = loginComponent;
    selectCloud.jiraHelpers = jiraHelpers;
  }

  const listener = ({ value }) => {
    if (value) {
      loginComponent.off("isResolved", listener);
      loadingJira.style.display = "none";

      const report = new TimelineReport().initialize({
        jiraHelpers,
        loginComponent,
        mode: "TEAMS",
        storage,
        linkBuilder,
        showSidebarBranding,
        featuresPromise: getFeatures(storage).then((features) => {
          queryClient.setQueryData(featuresKeyFactory.features(), features);

          return features;
        }),
      });
      report.className = "flex flex-1 overflow-hidden";
      mainContent.append(report);
    }
  };
  loginComponent.on("isResolved", listener);
  login.appendChild(loginComponent);
  if (host === "jira") {
    login.style.display = "none";
  }

  return loginComponent;
}

// LEGACY URL SUPPORT
function legacyPrimaryReportingTypeRoutingFix() {
  const primaryIssueType = new URL(window.location).searchParams.get("primaryReportType");
  if (primaryIssueType === "breakdown") {
    directlyReplaceUrlParam("primaryReportType", "start-due");
    directlyReplaceUrlParam("primaryReportBreakdown", "true");
    console.warn("fixing url");
  }
}

function legacyPrimaryIssueTypeRoutingFix() {
  const primaryIssueType = new URL(window.location).searchParams.get("primaryIssueType");
  if (primaryIssueType) {
    directlyReplaceUrlParam("primaryIssueType", "", "");
    directlyReplaceUrlParam("selectedIssueType", primaryIssueType, "");
    console.warn("fixing url");
  }
}
