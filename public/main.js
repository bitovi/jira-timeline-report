

async function main(jiraHelpers) {
	mainElement.textContent = "Checking for Jira Access Token";

	if(!jiraHelpers.hasValidAccessToken()) {
		mainElement.textContent = "Getting access token";
	}

	const accessToken = await jiraHelpers.getAccessToken();

	mainElement.textContent = "Got Access Token "+ accessToken;

	const fields = await jiraHelpers.fetchJiraFields();

	mainElement.textContent = "Requesting field definitions";

	const fieldMap = makeFieldNameToIdMap(fields);
	mainElement.innerHTML = `Fields: ${JSON.stringify(fieldMap)}`;	
}

function makeFieldNameToIdMap(fields){
	const map = {};
	fields.forEach(f => {
		map[f.name] = f.id;
	});
	return map;
}
