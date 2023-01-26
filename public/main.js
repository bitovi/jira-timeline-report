
import { SteercoReporter } from "./steerco-reporting.js";
// import qaMetrics from "./qa-metrics/main.js";

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
	//qaMetrics(jiraHelpers);
	//const fields = await jiraHelpers.fetchJiraFields();
	//const fieldMap = makeFieldNameToIdMap(fields);

	// SteerCo for TB
	/*const report = new SteercoReporter();
	report.jiraHelpers = jiraHelpers;
	report.getReleaseValue = function(issue){
		return issue["Product Target Release"]
	};
	report. jql = `(issuekey in portfolioChildIssuesOf(YUMPOS-266)  OR labels in (TB_US_POS) ) and issueType in (Initiatives, Epic) ORDER BY issuetype DESC`
	document.body.append(report);*/

	// SteerCo for KFC
	const report = new SteercoReporter();
	report.jiraHelpers = jiraHelpers;
	//report.jql = `issuekey in portfolioChildIssuesOf(YUMPOS-890) OR issueKey = YUMPOS-890 OR (issuekey in portfolioChildIssuesOf(YC-2157) ) and issueType in (Initiatives, Epic) ORDER BY issuetype DESC`
	report.mode = "TEAMS";
	document.body.append(report);



	// get all stories for a fixVersion
	// get points
	// get all changelog for those issues
	// find status changes
}


function sleep(time) {
	return new Promise((resolve) => {
		setTimeout(resolve, time)
	})
}
