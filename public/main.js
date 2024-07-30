
import { TimelineReport } from "./timeline-report.js";

import "./shared/saved-urls.js";
import "./shared/select-cloud.js";
import "./shared/velocities-from-issue.js"

import JiraLogin from "./shared/jira-login.js";
import JiraOIDCHelpers from "./jira-oidc-helpers.js";
import { getHostedRequestHelper } from "./request-helpers/hosted-request-helpers.js";

export default async function main(config) {
	// TODO: TR-11 send config to request helper
	// do the fetch in the request helper
	const requestHelper = getHostedRequestHelper(config);

	const jiraHelpers = JiraOIDCHelpers(config, requestHelper);

	const loginComponent = new JiraLogin().initialize({jiraHelpers});

	const savedUrls = document.querySelector("saved-urls")
	savedUrls.loginComponent = loginComponent;
	savedUrls.jiraHelpers = jiraHelpers;

	const selectCloud = document.querySelector("select-cloud")
	selectCloud.loginComponent = loginComponent;
	selectCloud.jiraHelpers = jiraHelpers;

	const velocitiesConfiguration = document.querySelector("velocities-from-issue")
	velocitiesConfiguration.jiraHelpers = jiraHelpers;
	velocitiesConfiguration.isLoggedIn = loginComponent.isLoggedIn;
	loginComponent.listenTo("isLoggedIn", ({value})=>{
		velocitiesConfiguration.isLoggedIn = value;
	})
	
	const listener = ({value})=>{
		if(value) {
			loginComponent.off("isResolved", listener);
			mainElement.style.display = "none";
			const report = new TimelineReport().initialize({jiraHelpers, loginComponent, mode: "TEAMS", velocitiesConfiguration});
			report.className = "block"
			document.body.append(report);
		}
	}
	loginComponent.on("isResolved",listener);
	login.appendChild(loginComponent);





}



