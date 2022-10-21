function JiraOIDCHelpers({
		JIRA_CLIENT_ID,
		JIRA_SCOPE,
		JIRA_CALLBACK_URL,
		JIRA_API_URL
	} = window.env){


	function responseToJSON(response){
		return response.json();
	}

	const jiraHelpers = {
		saveInformationToLocalStorage: (parameters) => {
				const objectKeys = Object.keys(parameters)
				for(let key of objectKeys) {
						window.localStorage.setItem(key, parameters[key]);
				}
		},
		fetchFromLocalStorage: (key) => {
				return window.localStorage.getItem(key);
		},
		fetchAuthorizationCode: () => {
				const url = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${JIRA_CLIENT_ID}&scope=${JIRA_SCOPE}&redirect_uri=${JIRA_CALLBACK_URL}&response_type=code&prompt=consent`;
				window.location.href = url;
		},
		fetchableRefresher: async (url, method = 'GET', body = undefined) => {
			if(!jiraHelpers.hasValidAccessToken){
				await jiraHelpers.refreshAccessToken();
			}
			const shouldRefresh = jiraHelpers.isValidForRefresh();
			const accessToken = jiraHelpers.fetchFromLocalStorage("accessToken");
			const config = {
				headers: new Headers({
					Authorization: `Bearer ${accessToken}`
				}),
				method,
			}
			if(shouldRefresh) {
				setTimeout(() => {
					jiraHelpers.refreshAccessToken();
				}, 10000);
			}
			return fetch(url, config).then(responseToJSON);
		},
		refreshAccessToken: async (accessCode) => {
				try {
						const response = await fetch(`./access-token?code=${accessCode}&refresh=true`)
						if(!response.ok) throw new Error("")
						const data = await response.json();
						const {
								accessToken,
								expiryTimestamp,
								refreshToken,
						} = data;
						jiraHelpers.saveInformationToLocalStorage({
								accessToken,
								refreshToken,
								expiryTimestamp,
						});
						return accessToken;
				} catch (error) {
						console.error(error.message)
						window.localStorage.clear()
						jiraHelpers.fetchAuthorizationCode();
				}
		},
		fetchAccessTokenWithAuthCode: async (authCode) => {
				try {
						const response = await fetch(`./access-token?code=${authCode}`)
						if(!response.ok) throw new Error("")
						const data = await response.json();
						const {
							accessToken,
							expiryTimestamp,
							refreshToken,
							scopeId
						} = data;
						jiraHelpers.saveInformationToLocalStorage({
								accessToken,
								refreshToken,
								expiryTimestamp,
								scopeId,
						});
						//redirect to data page
						location.href = '/';
				} catch (error) {
						//handle error properly.
						console.error(error);
						// location.href = '/error.html';
				}
		},
		fetchJiraIssue: async (issueId) => {
			const scopeIdForJira = jiraHelpers.fetchFromLocalStorage('scopeId');
			const url = `${JIRA_API_URL}/ex/jira/${scopeIdForJira}/rest/api/3/issue/${issueId}`;
			return jiraHelpers.fetchableRefresher(url);
		},
		fetchJiraIssuesWithJQL: function(params){
			const scopeIdForJira = jiraHelpers.fetchFromLocalStorage('scopeId');
			const url = `${JIRA_API_URL}/ex/jira/${scopeIdForJira}/rest/api/3/search?` + new URLSearchParams(params);
			return jiraHelpers.fetchableRefresher(url);
			
		},
		fetchAllJiraIssuesWithJQL: async function(params){
			const firstRequest = jiraHelpers.fetchJiraIssuesWithJQL({maxResults: 100, ...params});
			const {issues, maxResults, total, startAt} = await firstRequest;
			const requests = [firstRequest];
			for(let i = startAt+maxResults; i < total; i += maxResults) {
				requests.push(
					jiraHelpers.fetchJiraIssuesWithJQL({maxResults: maxResults, startAt: i, ...params})
				);
			}
			return Promise.all(requests).then(
				(responses)=> {
					return responses.map( (response)=> response.issues ).flat();
				}
			)
		},
		fetchJiraChangelog(issueIdOrKey, params){
			const scopeIdForJira = jiraHelpers.fetchFromLocalStorage('scopeId');
			const url = `${JIRA_API_URL}/ex/jira/${scopeIdForJira}/rest/api/3/issue/${issueIdOrKey}/changelog?` +new URLSearchParams(params)
			return jiraHelpers.fetchableRefresher(url);
		},
		isChangelogComplete(changelog) {
			return changelog.histories.length === changelog.total
		},
		fetchRemainingChangelogsForIssues(issues) {
			// check for remainings
			return Promise.all(issues.map( issue => {
				if(jiraHelpers.isChangelogComplete(issue.changelog)){
					return {
						...issue,
						changelog: issue.changelog.histories
					}
				} else {
					return jiraHelpers.fetchRemainingChangelogsForIssue(issue.key, issue.changelog).then( (histories)=>{
						return {
							...issue,
							changelog: issue.changelog.histories
						}
					})
				}
			}))
		},
		// weirdly, this starts with the oldest, but we got the most recent
		// returns an array of histories objects
		fetchRemainingChangelogsForIssue(issueIdOrKey, mostRecentChangeLog) {

			const {histories, maxResults, total, startAt} = mostRecentChangeLog;

			const requests = [];
			for(let i = 0; i < total - maxResults; i += maxResults) {
				requests.push(
					jiraHelpers.fetchJiraChangelog(issueIdOrKey, {
						maxResults: Math.min(maxResults, total - maxResults - i),
						startAt: i,
					})
				);
			}
			// server sends back as "values", we match that
			requests.push({values: mostRecentChangeLog.histories.reverse()});
			return Promise.all(requests).then(
				(responses)=> {
					return responses.map( (response)=> response.values ).flat();
				}
			).then(function(response){
				return response;
			})
		},
		fetchAllJiraIssuesWithJQLAndFetchAllChangelog: async function(params){
			function getRemainingChangeLogsForIssues(response) {
				return jiraHelpers.fetchRemainingChangelogsForIssues(response.issues)
			}

			const firstRequest = jiraHelpers.fetchJiraIssuesWithJQL({maxResults: 100, expand: ["changelog"], ...params});

			const {issues, maxResults, total, startAt} = await firstRequest;
			const requests = [firstRequest.then(getRemainingChangeLogsForIssues)];

			for(let i = startAt+maxResults; i < total; i += maxResults) {
				requests.push(
					jiraHelpers.fetchJiraIssuesWithJQL({maxResults: maxResults, startAt: i, ...params})
						.then( getRemainingChangeLogsForIssues )
				);
			}
			return Promise.all(requests).then(
				(responses)=> {
					return responses.flat();
				}
			)
		},
		fetchJiraFields(){
			const scopeIdForJira = jiraHelpers.fetchFromLocalStorage('scopeId');
			const url = `${JIRA_API_URL}/ex/jira/${scopeIdForJira}/rest/api/3/field`;
			return jiraHelpers.fetchableRefresher(url);
		},
		getAccessToken: async () => {
			if( !jiraHelpers.hasValidAccessToken() ){
				const refreshToken = jiraHelpers.fetchFromLocalStorage("refreshToken");
				if(!refreshToken) {
					jiraHelpers.fetchAuthorizationCode();
				}else{
					return jiraHelpers.refreshAccessToken();
				}
			} else {
				return jiraHelpers.fetchFromLocalStorage("accessToken");
			}
		},
		hasValidAccessToken: () => {
			const accessToken = jiraHelpers.fetchFromLocalStorage("accessToken");
			let expiryTimestamp = Number(jiraHelpers.fetchFromLocalStorage("expiryTimestamp"));
			if(isNaN(expiryTimestamp)) {
				expiryTimestamp = 0;
			}
			const currentTimestamp = Math.floor(new Date().getTime()/1000.0);
			return !((currentTimestamp > expiryTimestamp) || (!accessToken))
		},
		isValidForRefresh() {
			let expiryTimestamp = Number(jiraHelpers.fetchFromLocalStorage("expiryTimestamp"));
			if(isNaN(expiryTimestamp)) {
				expiryTimestamp = 0;
			}
			const currentTimestamp = Math.floor(new Date().getTime()/1000.0);
			const timeDifference = expiryTimestamp - currentTimestamp;
			const timeToExpiryForRefresh = 600; //in seconds
			return timeDifference <= timeToExpiryForRefresh;
	}
	}

	return jiraHelpers;
}
