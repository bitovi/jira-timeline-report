import mapIdsToNames from './shared/map-ids-to-names';
import chunkArray from './shared/chunk-array';

import {
  JtrEnv,
	RequestHelperResponse
} from './shared/types.js';

async function responseToText(response: Response):Promise<string> {
	if(!response.ok) {
		return response.json().then((payload) => {
			const err = new Error("HTTP status code: " + response.status);
			Object.assign(err, payload);
			Object.assign(err, response);
			throw err;
		})
	}
	return response.text();
}
	
export class JiraHelpers {
	saveInformationToLocalStorage: any;
	clearAuthFromLocalStorage: any;
	fetchFromLocalStorage: any;
	fetchAuthorizationCode: any;
	refreshAccessToken: any;
	fetchAccessTokenWithAuthCode: any;
	fetchAccessibleResources: any;
	fetchJiraSprint: any;
	fetchJiraIssue: any;
	editJiraIssueWithNamedFields: any;
	fetchJiraIssuesWithJQL: any;
	fetchJiraIssuesWithJQLWithNamedFields: any;
	fetchAllJiraIssuesWithJQL: any;
	fetchAllJiraIssuesWithJQLUsingNamedFields: any;
	fetchJiraChangelog: any;
	isChangelogComplete: any;
	fetchRemainingChangelogsForIssues: any;
	fetchRemainingChangelogsForIssue: any;
	fetchAllJiraIssuesWithJQLAndFetchAllChangelog: any;
	fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: any;
	fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: any;
	fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields: any;
	fetchChildrenResponses: any;
	fetchDeepChildren : any;
	fetchJiraFields: any;
	getAccessToken: any;
	hasAccessToken: any;
	hasValidAccessToken: any;
	getServerInfo: any;
	fieldsRequest: any;
	requestHelper: any;
	_cachedServerInfoPromise: any;
	fetchJSON: any;

	fieldsToEditBody = (obj: any, fieldMapping: any) => {
		const editBody: any = {fields: {}, update: {}};
		
		for (let prop in obj) {
			//if(prop === "Story points") {
				// 10016 -> story point estimate
				// 10034 -> story points
				//obj[prop] = ""+obj[prop];
				//mapped["customfield_10016"] = obj[prop];
				//mapped["customfield_10034"] = obj[prop];
				//mapped["Story points"] = obj[prop];
				//mapped["storypoints"] = obj[prop];
				//mapped["Story Points"] = obj[prop];
				// 10016 -> story point estimate
			//} else {
				//mapped[fields.nameMap[prop] || prop] = obj[prop];
			//}
			editBody.update[fieldMapping.nameMap[prop] || prop] = [{set: obj[prop]}];
		}
		return editBody;
	}

	mapNamesToIds = (obj: any, fields: any) => {
		const mapped: any = {};
		for (let prop in obj) {
			//if(prop === "Story points") {
				// 10016 -> story point estimate
				// 10034 -> story points
				//obj[prop] = ""+obj[prop];
				//mapped["customfield_10016"] = obj[prop];
				//mapped["customfield_10034"] = obj[prop];
				//mapped["Story points"] = obj[prop];
				//mapped["storypoints"] = obj[prop];
				//mapped["Story Points"] = obj[prop];
				// 10016 -> story point estimate
			//} else {
				mapped[fields.nameMap[prop] || prop] = obj[prop];
			//}
			
		}
	}

	constructor(
		{
			JIRA_CLIENT_ID,
			JIRA_SCOPE,
			JIRA_CALLBACK_URL,
			JIRA_API_URL
		}: JtrEnv = window.env,
		requestHelper: (urlFragment: string) => Promise<RequestHelperResponse>,
		host: 'hosted' | 'jira',
		fetchJSON: any
	) {
		this.requestHelper = requestHelper;
		this.fetchJSON = fetchJSON;
	
		this.saveInformationToLocalStorage = (parameters: any) => {
			const objectKeys = Object.keys(parameters)
			for (let key of objectKeys) {
				window.localStorage.setItem(key, parameters[key]);
			}
		}

		this.clearAuthFromLocalStorage = function(){
			window.localStorage.removeItem("accessToken");
			window.localStorage.removeItem("refreshToken");
			window.localStorage.removeItem("expiryTimestamp");
		}

		this.fetchFromLocalStorage = (key: string) => {
			return window.localStorage.getItem(key);
		}

		this.fetchAuthorizationCode = () => {
			const url = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${JIRA_CLIENT_ID}&scope=${JIRA_SCOPE}&redirect_uri=${JIRA_CALLBACK_URL}&response_type=code&prompt=consent&state=${encodeURIComponent(encodeURIComponent(window.location.search))}`;
			window.location.href = url;
		}

		this.refreshAccessToken = async (accessCode?: any) => {
			try {
				const response = await this.fetchJSON(`${window.env.JIRA_API_URL}/?code=${accessCode}`)

				const {
					accessToken,
					expiryTimestamp,
					refreshToken,
				} = response.data;
				this.saveInformationToLocalStorage({
					accessToken,
					refreshToken,
					expiryTimestamp,
				});
				return accessToken;
			} catch (error: any) {
				console.error(error.message)
				this.clearAuthFromLocalStorage();
				this.fetchAuthorizationCode();
			}
		}

		this.fetchAccessTokenWithAuthCode = async (authCode: any) => {
			try {
				const {
					accessToken,
					expiryTimestamp,
					refreshToken,
					scopeId
				} = await this.fetchJSON(`./access-token?code=${authCode}`)

				this.saveInformationToLocalStorage({
					accessToken,
					refreshToken,
					expiryTimestamp,
					scopeId,
				});
				//redirect to data page
				const addOnQuery = new URL(window.location.toString()).searchParams.get("state");
				location.href = '/' + (addOnQuery || "");
			} catch (error) {
				//handle error properly.
				console.error(error);
				// location.href = '/error.html';
			}
		}

		this.fetchAccessibleResources = () => {
			return this.requestHelper(`https://api.atlassian.com/oauth/token/accessible-resources`);
		};

		this.fetchJiraSprint = async (sprintId: string) => {
			return requestHelper(`/agile/1.0/sprint/${sprintId}`);
		}

		this.fetchJiraIssue = async (issueId: string) => {
			return requestHelper(`/api/3/issue/${issueId}`);
		}

		this.editJiraIssueWithNamedFields = async (issueId: string, fields: any) => {
			const scopeIdForJira = this.fetchFromLocalStorage('scopeId');
			const accessToken = this.fetchFromLocalStorage('accessToken');

			const fieldMapping = await this.fieldsRequest;
			
			const editBody = this.fieldsToEditBody(fields, fieldMapping);
			//const fieldsWithIds = mapNamesToIds(fields || {}, fieldMapping),
			//	updateWithIds = mapNamesToIds(update || {}, fieldMapping);

			return fetch(
				`${JIRA_API_URL}/${scopeIdForJira}/rest/api/3/issue/${issueId}?` +
				"" /*new URLSearchParams(params)*/,
				{
					method: 'PUT',
					headers: {
						'Authorization': `Bearer ${accessToken}`,
						'Accept': 'application/json',
							'Content-Type': 'application/json'
					},
					body: JSON.stringify(editBody)
				}
			).then(responseToText);
		}

		this.fetchJiraIssuesWithJQL = (params: any) => {
			return requestHelper(`/api/3/search?` + new URLSearchParams(params));
		}

		this.fetchJiraIssuesWithJQLWithNamedFields = async(params: any) => {
			const fields = await this.fieldsRequest;
			const newParams = {
				...params,
				fields: params.fields.map((f: any) => fields.nameMap[f] || f)
			}
			const response = await this.fetchJiraIssuesWithJQL(newParams);


			return response.issues.map((issue: any) => {
				return {
					...issue,
					fields: mapIdsToNames(issue.fields, fields)
				}
			});
		}

		this.fetchAllJiraIssuesWithJQL = async(params: any) => {
			const { limit: limit, ...apiParams } = params;
			const firstRequest = this.fetchJiraIssuesWithJQL({ maxResults: 100, ...apiParams });
			const { maxResults, total, startAt } = await firstRequest;
			const requests = [firstRequest];
			
			const limitOrTotal = Math.min(total, limit || Infinity);
			for (let i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
				requests.push(
					this.fetchJiraIssuesWithJQL({ maxResults: maxResults, startAt: i, ...apiParams })
				);
			}
			return Promise.all(requests).then(
				(responses) => {
					return responses.map((response) => response.issues).flat();
				}
			)
		}

		this.fetchAllJiraIssuesWithJQLUsingNamedFields = async(params: any) => {
			const fields = await this.fieldsRequest;

			const newParams = {
				...params,
				fields: params.fields.map((f: any) => fields.nameMap[f] || f)
			}
			const response = await this.fetchAllJiraIssuesWithJQL(newParams);

			return response.map((issue: any) => {
				return {
					...issue,
					fields: mapIdsToNames(issue.fields, fields)
				}
			});
		}

		this.fetchJiraChangelog = (issueIdOrKey: string, params: any) => {
			return requestHelper(`/api/3/issue/${issueIdOrKey}/changelog?` + new URLSearchParams(params));
		}

		this.isChangelogComplete = (changelog: any) => {
			return changelog.histories.length === changelog.total
		}

		this.fetchRemainingChangelogsForIssues = (issues: any, progress: any) => {
			// check for remainings
			return Promise.all(issues.map((issue: any) => {
				if (this.isChangelogComplete(issue.changelog)) {
					return {
						...issue,
						changelog: issue.changelog.histories
					}
				} else {
					return this.fetchRemainingChangelogsForIssue(issue.key, issue.changelog).then(() => {
						return {
							...issue,
							changelog: issue.changelog.histories
						}
					})
				}
			}))
		}

		// weirdly, this starts with the oldest, but we got the most recent
		// returns an array of histories objects
		this.fetchRemainingChangelogsForIssue = (issueIdOrKey: string, mostRecentChangeLog: any) => {
			const { maxResults, total } = mostRecentChangeLog;

			const requests = [];
			requests.push({ values: mostRecentChangeLog.histories });
			for (let i = 0; i < total - maxResults; i += maxResults) {
				requests.push(
					this.fetchJiraChangelog(issueIdOrKey, {
						maxResults: Math.min(maxResults, total - maxResults - i),
						startAt: i,
					}).then((response: any) => {
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
		}

		this.fetchAllJiraIssuesWithJQLAndFetchAllChangelog = (params: any, progress: any) => {
			const { limit: limit, ...apiParams } = params;


			// a weak map would be better
			progress.data = progress.data || {
				issuesRequested: 0,
				issuesReceived: 0,
				changeLogsRequested: 0,
				changeLogsReceived: 0
			};
			function getRemainingChangeLogsForIssues(response: any, fetchRemaining: any) {
				Object.assign(progress.data, {
					issuesReceived: progress.data.issuesReceived+response.issues.length
				});
				progress(progress.data);
				return fetchRemaining(response.issues, progress);
			}

			const firstRequest = this.fetchJiraIssuesWithJQL({ maxResults: 100, expand: ["changelog"], ...apiParams });

			return firstRequest.then( (
				{ issues, maxResults, total, startAt }:
				{ issues: any[], maxResults: number, total: number, startAt: number }
			) => {
				Object.assign(progress.data, {
					issuesRequested: progress.data.issuesRequested+total,
					changeLogsRequested: 0,
					changeLogsReceived: 0
				});
				progress(progress.data);

				const requests = [firstRequest.then((response: any) => getRemainingChangeLogsForIssues(response, this.fetchRemainingChangelogsForIssues))];
				const limitOrTotal = Math.min(total, limit || Infinity);

				for (let i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
					requests.push(
						this.fetchJiraIssuesWithJQL({ maxResults, startAt: i, ...apiParams })
							.then((response: any) => getRemainingChangeLogsForIssues(response, this.fetchRemainingChangelogsForIssues))
					);
				}
				return Promise.all(requests).then(
					(responses) => {
						return responses.flat();
					}
				)
			});
		}

		// this could do each response incrementally, but I'm being lazy
		this.fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields = async(params: any, progress: any) => {
			const fields = await this.fieldsRequest;
			const newParams = {
				...params,
				fields: params.fields.map((f: any) => fields.nameMap[f] || f)
			}
			const response = await this.fetchAllJiraIssuesWithJQLAndFetchAllChangelog(newParams, progress);


			return response.map((issue: any) => {
				return {
					...issue,
					fields: mapIdsToNames(issue.fields, fields)
				}
			});
			// change the parms
		}

		this.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields = async(params: any, progress: any) => {
			const fields = await this.fieldsRequest;
			const newParams = {
				...params,
				fields: params.fields.map((f: any) => fields.nameMap[f] || f)
			}

			progress.data = progress.data || {
				issuesRequested: 0,
				issuesReceived: 0,
				changeLogsRequested: 0,
				changeLogsReceived: 0
			};
			const parentIssues = await this.fetchAllJiraIssuesWithJQLAndFetchAllChangelog(newParams, progress);

			// go get the children
			const allChildrenIssues = await this.fetchDeepChildren(newParams, parentIssues, progress);
			const combined = parentIssues.concat(allChildrenIssues);
			return combined.map((issue: any) => {
				return {
					...issue,
					fields: mapIdsToNames(issue.fields, fields)
				}
			});
			// change the parms
		}

		this.fetchChildrenResponses = (params: any, parentIssues: any, progress: any) => {
			const issuesToQuery = chunkArray(parentIssues, 40);

			const batchedResponses = issuesToQuery.map( (issues: any) => {
				const keys = issues.map( (issue: any) => issue.key);
				const jql = `parent in (${keys.join(", ")})`;
				return this.fetchAllJiraIssuesWithJQLAndFetchAllChangelog({
					...params,
					jql
				}, progress)
			});
			// this needs to be flattened
			return batchedResponses;
		}

		// Makes child requests in batches of 40
		// 
		// params - base params
		// sourceParentIssues - the source of parent issues
		this.fetchDeepChildren = (params: any, sourceParentIssues: any, progress: any) => {
			const batchedFirstResponses = this.fetchChildrenResponses(params, sourceParentIssues, progress);

			const getChildren = (parentIssues: any) => {
				if(parentIssues.length) {
					return this.fetchDeepChildren(params, parentIssues, progress).then((deepChildrenIssues: any) => {
						return parentIssues.concat(deepChildrenIssues);
					})
				} else {
					return parentIssues
				}
			}
			const batchedIssueRequests = batchedFirstResponses.map( (firstBatchPromise: any) => {
				return firstBatchPromise.then( getChildren )
			})
			return Promise.all( batchedIssueRequests).then( (allChildren)=> {
				return allChildren.flat()
			});
		}

		this.fetchJiraFields = () => {
			return requestHelper(`/api/3/field`);
		}

		this.getAccessToken = async() => {
			if (!this.hasValidAccessToken()) {
				const refreshToken = this.fetchFromLocalStorage("refreshToken");
				if (!refreshToken) {
					this.fetchAuthorizationCode();
				} else {
					return this.refreshAccessToken();
				}
			} else {
				return this.fetchFromLocalStorage("accessToken");
			}
		}
		
		this.hasAccessToken = () => {
			return !! this.fetchFromLocalStorage("accessToken");
		}

		this.hasValidAccessToken = () => {
			const accessToken = this.fetchFromLocalStorage("accessToken");
			let expiryTimestamp = Number(this.fetchFromLocalStorage("expiryTimestamp"));
			if (isNaN(expiryTimestamp)) {
				expiryTimestamp = 0;
			}
			const currentTimestamp = Math.floor(new Date().getTime() / 1000.0);
			return !((currentTimestamp > expiryTimestamp) || (!accessToken))
		}
		
		this.getServerInfo = () => {
			if(this._cachedServerInfoPromise) {
				return this._cachedServerInfoPromise;
			}
			// https://your-domain.atlassian.net/rest/api/3/serverInfo

			return this._cachedServerInfoPromise = requestHelper('/api/3/serverInfo');
		}
  }
}