
import { TimelineReport } from "./timeline-report.js";
import JiraOIDCHelpers from "./jira-oidc-helpers.js";

export default async function main(config) {

	const jiraHelpers = JiraOIDCHelpers(config);
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
	report.className = "block"


}
/*
const NAV_HTML = `<div class="flex">
	<ul class="flex gap-3 flex-grow">
		<li>
			<h1>Timeline Report</h1>
		</li>
		<li>
			<a href="https://jira-auto-scheduler.bitovi-jira.com/" class="hover:text-sky-700 underline text-blue-500">Jira AutoScheduler</a>
		</li>
		<li>
			<a href="https://bitovi.github.io/statistical-software-estimator/" class="hover:text-sky-700 underline text-blue-500">Statistical Estimator</a>
		</li>
	</ul>
	<div>
		<a href="https://www.bitovi.com/services/agile-project-management-consulting" class="hover:text-sky-700 underline text-blue-500">Bitovi</a>
	</div>
</div>`
*/


function sleep(time) {
	return new Promise((resolve) => {
		setTimeout(resolve, time)
	})
}
