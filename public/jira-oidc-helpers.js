
const CACHE_FETCH = false;

function responseToJSON(response) {
	if(!response.ok) {
		return response.json().then((payload) => {
			const err = new Error("HTTP status code: " + response.status);
			Object.assign(err, payload);
			Object.assign(err, response);
			throw err;
		})
	}
	return response.json();
}

export function nativeFetchJSON(url, options) {
	return fetch(url, options).then(responseToJSON)
}

function chunkArray(array, size) {
	const chunkedArr = [];
	for (let i = 0; i < array.length; i += size) {
	  chunkedArr.push(array.slice(i, i + size));
	}
	return chunkedArr;
  }

export default function JiraOIDCHelpers({
	JIRA_CLIENT_ID,
	JIRA_SCOPE,
	JIRA_CALLBACK_URL,
	JIRA_API_URL
} = window.env) {


	let fetchJSON = nativeFetchJSON;
	if (CACHE_FETCH) {
		fetchJSON = async function (url, options) {
			if (window.localStorage.getItem(url)) {
				return JSON.parse(window.localStorage.getItem(url));
			} else {
				const result = nativeFetchJSON(url, options);
				result.then(async data => {
					try {
						window.localStorage.setItem(url, JSON.stringify(data));
					} catch (e) {
						console.log("can't save");
					}

				});
				return result;
			}
		};
	}


	let fieldsRequest;





	const jiraHelpers = {
		saveInformationToLocalStorage: (parameters) => {
			const objectKeys = Object.keys(parameters)
			for (let key of objectKeys) {
				window.localStorage.setItem(key, parameters[key]);
			}
		},
		clearAuthFromLocalStorage: function(){
			window.localStorage.removeItem("accessToken");
			window.localStorage.removeItem("refreshToken");
			window.localStorage.removeItem("expiryTimestamp");
		},
		fetchFromLocalStorage: (key) => {
			return window.localStorage.getItem(key);
		},
		fetchAuthorizationCode: () => {
			debugger;
			const url = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${JIRA_CLIENT_ID}&scope=${JIRA_SCOPE}&redirect_uri=${JIRA_CALLBACK_URL}&response_type=code&prompt=consent&state=${encodeURIComponent(encodeURIComponent(window.location.search))}`;
			window.location.href = url;
		},
		refreshAccessToken: async (accessCode) => {
			try {
				const response = await fetchJSON(`${window.env.JIRA_API_URL}/?code=${accessCode}`)
				

				const {
					accessToken,
					expiryTimestamp,
					refreshToken,
				} = response.data;
				jiraHelpers.saveInformationToLocalStorage({
					accessToken,
					refreshToken,
					expiryTimestamp,
				});
				return accessToken;
			} catch (error) {
				console.error(error.message)
				jiraHelpers.clearAuthFromLocalStorage();
				jiraHelpers.fetchAuthorizationCode();
			}
		},
		fetchAccessTokenWithAuthCode: async (authCode) => {
			try {
				const {
					accessToken,
					expiryTimestamp,
					refreshToken,
					scopeId
				} = await fetchJSON(`./access-token?code=${authCode}`)

				jiraHelpers.saveInformationToLocalStorage({
					accessToken,
					refreshToken,
					expiryTimestamp,
					scopeId,
				});
				//redirect to data page
				const addOnQuery = new URL(window.location).searchParams.get("state");
				const decoded = decodeURIComponent(addOnQuery);
				location.href = '/' + (addOnQuery || "");
			} catch (error) {
				//handle error properly.
				console.error(error);
				// location.href = '/error.html';
			}
		},
		fetchJiraSprint: async (sprintId) => {
			//this fetches all Recent Projects From Jira
			const scopeIdForJira = jiraHelpers.fetchFromLocalStorage('scopeId');
			const accessToken = jiraHelpers.fetchFromLocalStorage('accessToken');
			const url = `${JIRA_API_URL}/${scopeIdForJira}/rest/agile/1.0/sprint/${sprintId}`;
			const config = {
				headers: {
					'Authorization': `Bearer ${accessToken}`,
				}
			}
			return await fetchJSON(url, config);
		},
		fetchJiraIssue: async (issueId) => {
			//this fetches all Recent Projects From Jira
			const scopeIdForJira = jiraHelpers.fetchFromLocalStorage('scopeId');
			const accessToken = jiraHelpers.fetchFromLocalStorage('accessToken');
			const url = `${JIRA_API_URL}/${scopeIdForJira}/rest/api/3/issue/${issueId}`;
			const config = {
				headers: {
					'Authorization': `Bearer ${accessToken}`,
				}
			}
			return await fetchJSON(url, config);
		},
		fetchJiraIssuesWithJQL: function (params) {
			const scopeIdForJira = jiraHelpers.fetchFromLocalStorage('scopeId');
			const accessToken = jiraHelpers.fetchFromLocalStorage('accessToken');

			return fetchJSON(
				`${JIRA_API_URL}/${scopeIdForJira}/rest/api/3/search?` +
				new URLSearchParams(params),
				{
					headers: {
						'Authorization': `Bearer ${accessToken}`,
					}
				}

			)
		},
		fetchJiraIssuesWithJQLWithNamedFields: async function (params) {
			const fields = await fieldsRequest;
			const newParams = {
				...params,
				fields: params.fields.map(f => fields.nameMap[f] || f)
			}
			const response = await jiraHelpers.fetchJiraIssuesWithJQL(newParams);


			return response.issues.map((issue) => {
				return {
					...issue,
					fields: mapIdsToNames(issue.fields, fields)
				}
			});
		},
		fetchAllJiraIssuesWithJQL: async function (params) {
			const firstRequest = jiraHelpers.fetchJiraIssuesWithJQL({ maxResults: 100, ...params });
			const { issues, maxResults, total, startAt } = await firstRequest;
			const requests = [firstRequest];
			for (let i = startAt + maxResults; i < total; i += maxResults) {
				requests.push(
					jiraHelpers.fetchJiraIssuesWithJQL({ maxResults: maxResults, startAt: i, ...params })
				);
			}
			return Promise.all(requests).then(
				(responses) => {
					return responses.map((response) => response.issues).flat();
				}
			)
		},
		fetchJiraChangelog(issueIdOrKey, params) {
			const scopeIdForJira = jiraHelpers.fetchFromLocalStorage('scopeId');
			const accessToken = jiraHelpers.fetchFromLocalStorage('accessToken');

			return fetchJSON(
				`${JIRA_API_URL}/${scopeIdForJira}/rest/api/3/issue/${issueIdOrKey}/changelog?` +
				new URLSearchParams(params),
				{
					headers: {
						'Authorization': `Bearer ${accessToken}`,
					}
				}

			)
		},
		isChangelogComplete(changelog) {
			return changelog.histories.length === changelog.total
		},
		fetchRemainingChangelogsForIssues(issues, progress = function(){}) {
			// check for remainings
			return Promise.all(issues.map(issue => {
				if (jiraHelpers.isChangelogComplete(issue.changelog)) {
					return {
						...issue,
						changelog: issue.changelog.histories
					}
				} else {
					return jiraHelpers.fetchRemainingChangelogsForIssue(issue.key, issue.changelog).then((histories) => {
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
			const { histories, maxResults, total, startAt } = mostRecentChangeLog;

			const requests = [];
			requests.push({ values: mostRecentChangeLog.histories });
			for (let i = 0; i < total - maxResults; i += maxResults) {
				requests.push(
					jiraHelpers.fetchJiraChangelog(issueIdOrKey, {
						maxResults: Math.min(maxResults, total - maxResults - i),
						startAt: i,
					}).then((response) => {
						// the query above reverses the sort order, we fix that here
						return { ...response, values: response.values.reverse() };
					})
				);
			}
			// server sends back as "values", we match that

			return Promise.all(requests).then(
				(responses) => {
					return responses.map((response) => response.values).flat();
				}
			).then(function (response) {
				return response;
			})
		},
		fetchAllJiraIssuesWithJQLAndFetchAllChangelog: function (params, progress= function(){}) {
			// a weak map would be better
			progress.data = progress.data || {
				issuesRequested: 0,
				issuesReceived: 0,
				changeLogsRequested: 0,
				changeLogsReceived: 0
			};
			function getRemainingChangeLogsForIssues(response) {
				Object.assign(progress.data, {
					issuesReceived: progress.data.issuesReceived+response.issues.length
				});
				progress(progress.data);
				return jiraHelpers.fetchRemainingChangelogsForIssues(response.issues, progress)
			}

			const firstRequest = jiraHelpers.fetchJiraIssuesWithJQL({ maxResults: 100, expand: ["changelog"], ...params });

			return firstRequest.then( ({ issues, maxResults, total, startAt }) => {
				Object.assign(progress.data, {
					issuesRequested: progress.data.issuesRequested+total,
					changeLogsRequested: 0,
					changeLogsReceived: 0
				});
				progress(progress.data);

				const requests = [firstRequest.then(getRemainingChangeLogsForIssues)];

				for (let i = startAt + maxResults; i < total; i += maxResults) {
					requests.push(
						jiraHelpers.fetchJiraIssuesWithJQL({ maxResults: maxResults, startAt: i, ...params })
							.then(getRemainingChangeLogsForIssues)
					);
				}
				return Promise.all(requests).then(
					(responses) => {
						return responses.flat();
					}
				)
			});

			
		},
		// this could do each response incrementally, but I'm being lazy
		fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: async function (params, progress) {
			const fields = await fieldsRequest;
			const newParams = {
				...params,
				fields: params.fields.map(f => fields.nameMap[f] || f)
			}
			const response = await jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelog(newParams, progress);


			return response.map((issue) => {
				return {
					...issue,
					fields: mapIdsToNames(issue.fields, fields)
				}
			});
			// change the parms
		},
		fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: async function (params, progress = function(){}) {
			const fields = await fieldsRequest;
			const newParams = {
				...params,
				fields: params.fields.map(f => fields.nameMap[f] || f)
			}

			progress.data = progress.data || {
				issuesRequested: 0,
				issuesReceived: 0,
				changeLogsRequested: 0,
				changeLogsReceived: 0
			};
			const parentIssues = await jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelog(newParams, progress);

			// go get the children
			const allChildrenIssues = await this.fetchDeepChildren(newParams, parentIssues, progress);
			const combined = parentIssues.concat(allChildrenIssues);
			return combined.map((issue) => {
				return {
					...issue,
					fields: mapIdsToNames(issue.fields, fields)
				}
			});
			// change the parms
		},
		fetchChildrenResponses(params, parentIssues, progress) {
			const issuesToQuery = chunkArray(parentIssues, 40);

			const batchedResponses = issuesToQuery.map( issues => {
				const keys = issues.map( issue => issue.key);
				const jql = `parent in (${keys.join(", ")})`;
				return this.fetchAllJiraIssuesWithJQLAndFetchAllChangelog({
					...params,
					jql
				}, progress)
			});
			// this needs to be flattened
			return batchedResponses;
		},
		// Makes child requests in batches of 40
		// 
		// params - base params
		// sourceParentIssues - the source of parent issues
		fetchDeepChildren(params, sourceParentIssues, progress) {
			const batchedFirstResponses = this.fetchChildrenResponses(params, sourceParentIssues, progress);

			const getChildren = (parentIssues) => {
				if(parentIssues.length) {
					return this.fetchDeepChildren(params, parentIssues, progress).then(deepChildrenIssues => {
						return parentIssues.concat(deepChildrenIssues);
					})
				} else {
					return parentIssues
				}
			}
			const batchedIssueRequests = batchedFirstResponses.map( firstBatchPromise => {
				return firstBatchPromise.then( getChildren )
			})
			return Promise.all( batchedIssueRequests).then( (allChildren)=> {
				return allChildren.flat()
			});
		},
		fetchJiraFields() {
			const scopeIdForJira = jiraHelpers.fetchFromLocalStorage('scopeId');
			const accessToken = jiraHelpers.fetchFromLocalStorage('accessToken');

			return fetchJSON(
				`${JIRA_API_URL}/${scopeIdForJira}/rest/api/3/field`,
				{
					headers: {
						'Authorization': `Bearer ${accessToken}`,
					}
				}
			)
		},
		getAccessToken: async function () {
			if (!jiraHelpers.hasValidAccessToken()) {
				const refreshToken = jiraHelpers.fetchFromLocalStorage("refreshToken");
				if (!refreshToken) {
					jiraHelpers.fetchAuthorizationCode();
				} else {
					return jiraHelpers.refreshAccessToken();
				}
			} else {
				return jiraHelpers.fetchFromLocalStorage("accessToken");
			}
		},
		hasAccessToken: function(){
			return !! jiraHelpers.fetchFromLocalStorage("accessToken");
		},
		hasValidAccessToken: function () {
			const accessToken = jiraHelpers.fetchFromLocalStorage("accessToken");
			let expiryTimestamp = Number(jiraHelpers.fetchFromLocalStorage("expiryTimestamp"));
			if (isNaN(expiryTimestamp)) {
				expiryTimestamp = 0;
			}
			const currentTimestamp = Math.floor(new Date().getTime() / 1000.0);
			return !((currentTimestamp > expiryTimestamp) || (!accessToken))
		},
		getServerInfo() {
			if(this._cachedServerInfoPromise) {
				return this._cachedServerInfoPromise;
			}
			// https://your-domain.atlassian.net/rest/api/3/serverInfo
			const scopeIdForJira = jiraHelpers.fetchFromLocalStorage('scopeId');
			const accessToken = jiraHelpers.fetchFromLocalStorage('accessToken');

			return this._cachedServerInfoPromise = fetchJSON(
				`${JIRA_API_URL}/${scopeIdForJira}/rest/api/3/serverInfo`,
				{
					headers: {
						'Authorization': `Bearer ${accessToken}`,
					}
				}

			)
		}
	}


	function makeFieldNameToIdMap(fields) {
		const map = {};
		fields.forEach((f) => {
			map[f.name] = f.id;
		});
		return map;
	}

	if (jiraHelpers.hasValidAccessToken()) {
		fieldsRequest = jiraHelpers.fetchJiraFields().then((fields) => {
			const nameMap = {};
			const idMap = {};
			fields.forEach((f) => {
				idMap[f.id] = f.name;
				nameMap[f.name] = f.id;
			});
			console.log(nameMap);

			return {
				list: fields,
				nameMap: nameMap,
				idMap: idMap
			}
		});
	}


	function mapIdsToNames(obj, fields) {
		const mapped = {};
		for (let prop in obj) {
			mapped[fields.idMap[prop] || prop] = obj[prop];
		}
		return mapped;
	}

	return jiraHelpers;
}
