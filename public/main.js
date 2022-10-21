

async function main(jiraHelpers) {
	mainElement.textContent = "Checking for Jira Access Token";

	if(!jiraHelpers.hasValidAccessToken()) {
		await sleep(100);
		mainElement.textContent = "Getting access token";
	}

	const accessToken = await jiraHelpers.getAccessToken();

	mainElement.textContent = "Got Access Token "+ accessToken;

	const issue = await jiraHelpers.fetchJiraIssue('PICK-ISSUE');
	console.log(issue);

	const fields = await jiraHelpers.fetchJiraFields();

	mainElement.textContent = "Requesting field definitions";

	const fieldMap = makeFieldNameToIdMap(fields);
	console.log(fieldMap);
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
