
import { TimelineReport } from "./timeline-report.js";

export default async function main(jiraHelpers) {
	mainElement.textContent = "Checking for Jira Access Token";

	if (!jiraHelpers.hasValidAccessToken()) {
		await sleep(100);
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
}


function sleep(time) {
	return new Promise((resolve) => {
		setTimeout(resolve, time)
	})
}
