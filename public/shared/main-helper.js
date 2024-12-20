import { TimelineReport } from "../timeline-report.js";

import "../shared/select-cloud.js";

import JiraLogin from "../shared/jira-login.js";
import JiraOIDCHelpers from "../jira-oidc-helpers";
import { getHostedRequestHelper } from "../request-helpers/hosted-request-helper.js";
import { getConnectRequestHelper } from "../request-helpers/connect-request-helper.js";

import { directlyReplaceUrlParam } from "./state-storage.js";
import { route } from "../can.js";

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

export default async function mainHelper(config, { host, createStorage, configureRouting, showSidebarBranding }) {
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

  const loginComponent = new JiraLogin().initialize({ jiraHelpers });

  const selectCloud = document.querySelector("select-cloud");
  if (selectCloud) {
    selectCloud.loginComponent = loginComponent;
    selectCloud.jiraHelpers = jiraHelpers;
  }

  const listener = ({ value }) => {
    if (value) {
      loginComponent.off("isResolved", listener);
      mainElement.style.display = "none";

      const report = new TimelineReport().initialize({
        jiraHelpers,
        loginComponent,
        mode: "TEAMS",
        storage,
        showSidebarBranding
      });
      report.className = "block";
      document.body.append(report);
    }
  };
  loginComponent.on("isResolved", listener);
  login.appendChild(loginComponent);
  if (host === "jira") {
    login.style.display = "none";
  }

  return loginComponent;
}
