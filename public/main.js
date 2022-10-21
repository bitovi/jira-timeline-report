

async function main(jiraHelpers) {
	mainElement.textContent = "Checking for Jira Access Token";

	if(!jiraHelpers.hasValidAccessToken()) {
		await sleep(100);
		mainElement.textContent = "Getting access token";
	}

	const accessToken = await jiraHelpers.getAccessToken();

	mainElement.textContent = "Got Access Token "+ accessToken;

	const issue = await jiraHelpers.fetchJiraIssue('BACKEND-100');
	console.log(issue);

	const fields = await jiraHelpers.fetchJiraFields();

	mainElement.textContent = "Requesting field definitions";

	const fieldMap = makeFieldNameToIdMap(fields);
	const STORY_POINTS_FIELD = fieldMap["Story Points"];

	//console.log(fieldMap);

	// customfield_10029 //-> story points
	// customfield_10175
	// customfield_10176
	mainElement.textContent = "Getting stories";
	const issues = await jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelog({
		jql: `project = "YUMPOS" and "Actual Release[Labels]" in (4.0.0) and issueType not in (Initiatives, Epic)`,
		fields: ["summary",STORY_POINTS_FIELD],
		expand: ["changelog"]
	})

	//const issue = await jiraHelpers.fetchJiraIssueChangelog("YUMPOS-985");
	const issueResults = issues.map( (issue) => {
		if(issue.fields.summary.includes("Employee Edits section")) {
			debugger;
		}
		return {
			summary: issue.fields.summary,
			storyPoints: issue.fields[STORY_POINTS_FIELD],
			//changeLogComplete: isChangelogComplete(issue.changelog),
			inDevDays: calculateTimeInStatus(issue.changelog) / (1000*60*60*24)
		}
	})
	console.table(issueResults)

	/*
	field: "status"
	fieldId: "status"
	fieldtype: "jira"
	from: "10012"
	fromString: "To Do"
	to: "10055"
	toString: "Refinement"
	*/

	// get all stories for a fixVersion
		// get points
	// get all changelog for those issues
			// find status changes
}


function sleep(time){
	return new Promise((resolve)=>{
		setTimeout(resolve, time)
	})
}

function makeFieldNameToIdMap(fields){
	const map = {};
	fields.forEach((f) => {
		map[f.name] = f.id;
	});
	return map;
}

function isChangelogComplete(changelog) {
	return changelog.histories.length === changelog.total
}

function calculateTimeInStatus(changelog, status){
	let totalTime = 0;
	let currentStatus = "To Do";
	let inDevelopmentTime;
	changelog.reverse().forEach( (history) => {
		history.items.forEach( (changeItem)=> {
			if(changeItem.field === "status") {
				if( changeItem.toString === "In Development" ) {
					inDevelopmentTime = new Date(history.created);
				} else if(changeItem.fromString === "In Development") {
					if(!inDevelopmentTime) {
						console.error("No development time!")
					} else {
						totalTime += new Date(history.created) - inDevelopmentTime;
						inDevelopmentTime = undefined;
					}

				}

			}
		})
	})
	return totalTime;
}
