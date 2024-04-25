
import { TimelineReport } from "./timeline-report.js";

import "./shared/saved-urls.js";
import "./shared/select-cloud.js";

import JiraLogin from "./shared/jira-login.js";
import JiraOIDCHelpers from "./jira-oidc-helpers.js";

export default async function main(config) {

	const jiraHelpers = JiraOIDCHelpers(config);

	const loginComponent = new JiraLogin().initialize({jiraHelpers});

	const savedUrls = document.querySelector("saved-urls")
	savedUrls.loginComponent = loginComponent;
	savedUrls.jiraHelpers = jiraHelpers;

	const selectCloud = document.querySelector("select-cloud")
	selectCloud.loginComponent = loginComponent;
	selectCloud.jiraHelpers = jiraHelpers;
	
	const listener = ({value})=>{
		if(value) {
			loginComponent.off("isResolved", listener);
			mainElement.style.display = "none";
			const report = new TimelineReport().initialize({jiraHelpers, loginComponent, mode: "TEAMS"});
			report.className = "block"
			document.body.append(report);
		}
	}
	loginComponent.on("isResolved",listener);
	login.appendChild(loginComponent);


	/*
	mainElement.textContent = "Checking for Jira Access Token";

	if (!jiraHelpers.hasValidAccessToken()) {
		mainElement.textContent = "Getting access token";
		const accessToken = await jiraHelpers.getAccessToken();
		return;
	}

	const accessToken = await jiraHelpers.getAccessToken();

	mainElement.textContent = "Got Access Token";
	mainElement.style.display = "none";


	// SteerCo for KFC
	const report = new TimelineReport();
	report.jiraHelpers = jiraHelpers;
	report.mode = "TEAMS";
	document.body.append(report);
	report.className = "block"*/


}



