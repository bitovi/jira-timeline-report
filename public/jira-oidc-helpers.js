function JiraOIDCHelpers({
		JIRA_CLIENT_ID,
		JIRA_SCOPE,
		JIRA_CALLBACK_URL,
		JIRA_API_URL
	} = window.env){


	function responseToJSON(response){
		return response.json();
	}

	let refreshingRequest = false;
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

		hasValidAccessToken: () => {
			const accessToken = jiraHelpers.fetchFromLocalStorage("accessToken");
			let expiryTimestamp = Number(jiraHelpers.fetchFromLocalStorage("expiryTimestamp"));
			if(isNaN(expiryTimestamp)) {
				expiryTimestamp = 0;
			}
			const currentTimestamp = Math.floor(new Date().getTime()/1000.0);
			return !((currentTimestamp > expiryTimestamp) || (!accessToken));
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

		refreshableFetch: async (url, options) => {
			if(!jiraHelpers.hasValidAccessToken) {
				if(!refreshingRequest) {
					refreshingRequest = jiraHelpers.refreshAccessToken;
					await refreshingRequest();
					refreshingRequest = null;
				}
			}
			const accessToken = jiraHelpers.fetchFromLocalStorage("accessToken");
			const config = {
				...options,
				headers: new Headers({
					Authorization: `Bearer ${accessToken}`
				}),
			}
			return fetch(url, config);
		},

		jiraFetch: async (urlPath, method = 'GET', body = undefined) => {
			const scopeIdForJira = jiraHelpers.fetchFromLocalStorage('scopeId');
			const url = `${JIRA_API_URL}/ex/jira/${scopeIdForJira}/${urlPath}`;
			const options = {
				method,
				...(body ? {body: JSON.stringify(body)} : {})
			};
			return await jiraHelpers.refreshableFetch(url, options).then(responseToJSON);
		},

		refreshAccessToken: async (accessCode) => {
				try {
						const refreshCode = jiraHelpers.fetchFromLocalStorage('refreshToken');						
						const response = await fetch(`./access-token?code=${refreshCode}&refresh=true`)
						if(!response.ok) throw new Error("Unable to fetch refresh token")
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
						console.error(error.message);
						window.localStorage.clear();
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
				}
		},

		fetchJiraIssue: async (issueId) => {
			const urlPath = `/rest/api/3/issue/${issueId}`;
			return jiraHelpers.jiraFetch(urlPath);
		},

		fetchJiraFields(){
			const url = `/rest/api/3/field`;
			return jiraHelpers.jiraFetch(url);
		},

	}

	return jiraHelpers;
}
