import { TimelineReport } from "../timeline-report.js";

import "../shared/saved-urls.js";
import "../shared/select-cloud.js";
import "../shared/velocities-from-issue.js";

import JiraLogin from "../shared/jira-login.js";
import JiraOIDCHelpers from "../jira-oidc-helpers.ts";
import { getHostedRequestHelper } from "../request-helpers/hosted-request-helper.js";
import { getConnectRequestHelper } from "../request-helpers/connect-request-helper.js";

import { updateUrlParam } from "./state-storage.js";
function legacyPrimaryReportingTypeRoutingFix(){
  const primaryIssueType = new URL(window.location).searchParams.get("primaryReportType");
  if(primaryIssueType === "breakdown") {
    updateUrlParam("primaryReportType", "start-due");
    updateUrlParam("primaryReportBreakdown", "true");
    console.warn("fixing url")
  }
}

function legacyPrimaryIssueTypeRoutingFix(){
  const primaryIssueType = new URL(window.location).searchParams.get("primaryIssueType");
  if(primaryIssueType) {
    updateUrlParam("primaryReportType", "","");
    updateUrlParam("selectedIssueType", primaryIssueType,"");
    console.warn("fixing url")
  }
}



export default async function mainHelper(config, host) {
  legacyPrimaryReportingTypeRoutingFix();
  legacyPrimaryIssueTypeRoutingFix();

  console.log("Loaded version of the Timeline Reporter: " + config?.COMMIT_SHA);


  let requestHelper;
  if (host === "jira") {
    requestHelper = getConnectRequestHelper();
  } else {
    requestHelper = getHostedRequestHelper(config);
  }

  const jiraHelpers = JiraOIDCHelpers(config, requestHelper, host);

  const loginComponent = new JiraLogin().initialize({ jiraHelpers });

  const savedUrls = document.querySelector("saved-urls");
  savedUrls.loginComponent = loginComponent;
  savedUrls.jiraHelpers = jiraHelpers;

  const selectCloud = document.querySelector("select-cloud");
  if (selectCloud) {
    selectCloud.loginComponent = loginComponent;
    selectCloud.jiraHelpers = jiraHelpers;
  }

  const velocitiesConfiguration = document.querySelector("velocities-from-issue");
  velocitiesConfiguration.jiraHelpers = jiraHelpers;
  velocitiesConfiguration.isLoggedIn = loginComponent.isLoggedIn;
  loginComponent.listenTo("isLoggedIn", ({ value }) => {
    velocitiesConfiguration.isLoggedIn = value;
  });

  const listener = ({ value }) => {
    if (value) {
      loginComponent.off("isResolved", listener);
      mainElement.style.display = "none";
      const report = new TimelineReport().initialize({
        jiraHelpers,
        loginComponent,
        mode: "TEAMS",
        velocitiesConfiguration,
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
