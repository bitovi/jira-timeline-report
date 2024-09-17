import {
  JsonResponse,
  JtrEnv,
  RequestHelperResponse
} from './shared/types.js';

interface ResponseForFieldRequest extends RequestHelperResponse {
  idMap: { [key: string]: string },
  nameMap: { [key: string]: string }
}

type FetchJiraIssuesParams = {
  jql?: string;
  fields?: string[];
  startAt?: number;
  maxResults?: number;
	limit?: number;
};

type JiraIssue = {
  id: string;
  key: string;
  fields: Record<string, any>;
	changelog?: any;
};

type Issue = {
	key: string;
	fields: Record<string, any>; // Adjust based on the actual structure of fields
};

type Params = {
	[key: string]: any; // Adjust based on the actual structure of params
	fields?: string[];
};

type ProgressData = {
	issuesRequested: number;
	issuesReceived: number;
	changeLogsRequested: number;
	changeLogsReceived: number;
}

type Progress = {
    data?: ProgressData;
    (data: ProgressData): void;
};


import { responseToJSON } from "./shared/response-to-json.js";

const CACHE_FETCH = false;

// TODO move this into main module
declare global {
  interface Window {
    env: JtrEnv;
    localStorage: Storage;
    location: Location;
		jiraHelpers: any;
  }
}

function responseToText(response: Response): Promise<string> {
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

export function nativeFetchJSON(url: string, options?: RequestInit): Promise<JsonResponse> {
	return fetch(url, options).then(responseToJSON)
}

function chunkArray<T>(array: T[], size: number): T[][] {
	const chunkedArr = [];
	for (let i = 0; i < array.length; i += size) {
	  chunkedArr.push(array.slice(i, i + size));
	}
	return chunkedArr;
}

export default function (
	{
		JIRA_CLIENT_ID,
		JIRA_SCOPE,
		JIRA_CALLBACK_URL,
		JIRA_API_URL
	} = window.env,
	requestHelper: (urlFragment: string) => Promise<RequestHelperResponse>,
	host: 'jira' | 'hosted'
) {
	let fetchJSON = nativeFetchJSON;
	if (CACHE_FETCH) {
		fetchJSON = async function <T = any>(url: string, options?: RequestInit): Promise<T | JsonResponse> {
			const cachedData = window.localStorage.getItem(url);

			if (cachedData !== null) {
				return JSON.parse(cachedData) as T;
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

	let fieldsRequest: Promise<ResponseForFieldRequest>;

	type RootMethod = (params: Params, progress: Progress) => Promise<Issue[]>;

	function makeDeepChildrenLoaderUsingNamedFields(rootMethod: RootMethod){
		
		// Makes child requests in batches of 40
		// 
		// params - base params
		// sourceParentIssues - the source of parent issues
		function fetchChildrenResponses(params: Params, parentIssues: Issue[], progress: Progress): Promise<Issue[]>[] {
			const issuesToQuery = chunkArray(parentIssues, 40);
	
			const batchedResponses = issuesToQuery.map( issues => {
				const keys = issues.map( issue => issue.key);
				const jql = `parent in (${keys.join(", ")}) ${params.childJQL || ""}`;
				return rootMethod({
					...params,
					jql
				}, progress)
			});
			// this needs to be flattened
			return batchedResponses;
		}
	
		async function fetchDeepChildren(params: Params, sourceParentIssues: Issue[], progress: Progress): Promise<Issue[]> {
			const batchedFirstResponses = fetchChildrenResponses(params, sourceParentIssues, progress);
	
			const getChildren = (parentIssues: Issue[]) => {
				if(parentIssues.length) {
					return fetchDeepChildren(params, parentIssues, progress).then(deepChildrenIssues => {
						return parentIssues.concat(deepChildrenIssues);
					})
				} else {
					return parentIssues
				}
			}
			const batchedIssueRequests = batchedFirstResponses.map( firstBatchPromise => {
				return firstBatchPromise.then( getChildren )
			})
			const allChildren = await Promise.all(batchedIssueRequests);
			return allChildren.flat();
		}
	
		return async function fetchAllDeepChildren(params: Params, progress: Progress = {} as any){
			const fields = await fieldsRequest;
			const newParams = {
				...params,
				fields: params.fields?.map(f => fields.nameMap[f] || f)
			}
	
			progress.data = progress.data || {
				issuesRequested: 0,
				issuesReceived: 0,
				changeLogsRequested: 0,
				changeLogsReceived: 0
			};
			const parentIssues = await rootMethod(newParams, progress);
	
			// go get the children
			const allChildrenIssues = await fetchDeepChildren(newParams, parentIssues, progress);
			const combined = parentIssues.concat(allChildrenIssues);
			return combined.map((issue) => {
				return {
					...issue,
					fields: mapIdsToNames(issue.fields, fields)
				}
			});
		}
	}

	const jiraHelpers: {
		saveInformationToLocalStorage(parameters: Record<string, string>): void;
		clearAuthFromLocalStorage(): void;
		fetchFromLocalStorage(key: string): string | null;
		fetchAuthorizationCode(): void;
		refreshAccessToken(accessCode?: string): Promise<string | void>;
		fetchAccessTokenWithAuthCode(authCode: string): Promise<void>;
		fetchAccessibleResources(): ReturnType<typeof requestHelper>;
		fetchJiraSprint(sprintId: string): ReturnType<typeof requestHelper>;
		fetchJiraIssue(issueId: string): ReturnType<typeof requestHelper>;
		editJiraIssueWithNamedFields(issueId: string, fields: Record<string, any>): Promise<string>;
		fetchJiraIssuesWithJQL(params: FetchJiraIssuesParams): ReturnType<typeof requestHelper>;
		fetchJiraIssuesWithJQLWithNamedFields(params: FetchJiraIssuesParams): Promise<any[]>;
		fetchAllJiraIssuesWithJQL(params: FetchJiraIssuesParams): Promise<JiraIssue[]>;
		fetchAllJiraIssuesWithJQLUsingNamedFields(params: FetchJiraIssuesParams): Promise<any[]>;
		fetchJiraChangelog(issueIdOrKey: string, params: FetchJiraIssuesParams): ReturnType<typeof requestHelper>;
		isChangelogComplete(changelog: { histories: any[]; total: number; }): boolean;
		fetchRemainingChangelogsForIssues(
			issues: JiraIssue[],
			progress?: {
				data?: ProgressData;
				(data: ProgressData): void;
			}
		): Promise<JiraIssue[]>;
		fetchRemainingChangelogsForIssue(
			issueIdOrKey: string,
			mostRecentChangeLog: {
				histories: { id: string; change: string; }[];
				maxResults: number;
				total: number;
				startAt: number;
			}
		): Promise<{ id: string; change: string; }[]>;
		fetchAllJiraIssuesWithJQLAndFetchAllChangelog(
			params: {
				limit?: number;
				maxResults?: number;
				startAt?: number;
				expand?: string[];
				[key: string]: any;
			},
			progress?: {
				data?: ProgressData;
				(data: ProgressData): void;
			}
		): Promise<Issue[]>;
		fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(
			params: { fields: string[]; [key: string]: any },
			progress?: (data: ProgressData) => void
		): Promise<any[]>;
		fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields(
			params: { fields: string[]; [key: string]: any },
			progress?: {
				data?: ProgressData;
				(data: ProgressData): void;
			}
		): Promise<any[]>;
		fetchChildrenResponses: (params: { [key: string]: any; fields: string[]; }, parentIssues: Issue[], progress?: ((data: ProgressData) => void) | undefined) => Promise<Issue[]>[];
		fetchDeepChildren(
			params: { fields: string[]; [key: string]: any },
			sourceParentIssues: Issue[],
			progress?: (data: ProgressData) => void
		): Promise<Issue[]>;
		fetchJiraFields(): Promise<RequestHelperResponse>;
		getAccessToken(): Promise<string | void | null>;
		hasAccessToken(): boolean;
		hasValidAccessToken(): boolean;
		_cachedServerInfoPromise(): Promise<RequestHelperResponse>;
		getServerInfo(): Promise<RequestHelperResponse>;
		fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields?: (params: Params, progress?: Progress) => Promise<{ fields: { [key: string]: any; }; key: string; }[]>;
	} = {
		saveInformationToLocalStorage: (parameters: Record<string, string>) => {
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
		fetchFromLocalStorage: (key: string) => {
			return window.localStorage.getItem(key);
		},
		fetchAuthorizationCode: () => {
			const url = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${JIRA_CLIENT_ID}&scope=${JIRA_SCOPE}&redirect_uri=${JIRA_CALLBACK_URL}&response_type=code&prompt=consent&state=${encodeURIComponent(encodeURIComponent(window.location.search))}`;
			window.location.href = url;
		},
		refreshAccessToken: async (accessCode?: string): Promise<string | void> => {
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
			} catch (error: unknown) {
				if (error instanceof Error) {
					console.error(error.message);
				} else {
					console.error('An unknown error occurred');
				}
				jiraHelpers.clearAuthFromLocalStorage();
				jiraHelpers.fetchAuthorizationCode();
			}
		},
		fetchAccessTokenWithAuthCode: async (authCode: string): Promise<void> => {
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
				const addOnQuery = new URL(window.location as unknown as string | URL).searchParams.get("state");
				const decoded = decodeURIComponent(addOnQuery as string);
				location.href = '/' + (addOnQuery || "");
			} catch (error) {
				//handle error properly.
				console.error(error);
				// location.href = '/error.html';
			}
		},
		fetchAccessibleResources: () => {
			return requestHelper(`https://api.atlassian.com/oauth/token/accessible-resources`);
		},
		fetchJiraSprint: async (sprintId: string) => {
			return requestHelper(`/agile/1.0/sprint/${sprintId}`);
		},
		fetchJiraIssue: async (issueId: string) => {
			return requestHelper(`/api/3/issue/${issueId}`);
		},
		editJiraIssueWithNamedFields: async (issueId: string, fields: Record<string, any>) => {
			const scopeIdForJira = jiraHelpers.fetchFromLocalStorage('scopeId');
			const accessToken = jiraHelpers.fetchFromLocalStorage('accessToken');

			const fieldMapping = await fieldsRequest;
			
			const editBody = fieldsToEditBody(fields, fieldMapping);
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
		},
		fetchJiraIssuesWithJQL: function (params: FetchJiraIssuesParams) {
			// TODO - investigate this and convert params to proper type
			return requestHelper(`/api/3/search?` + new URLSearchParams(params as any));
		},
		fetchJiraIssuesWithJQLWithNamedFields: async function (params: FetchJiraIssuesParams) {
			const fields = await fieldsRequest;
			const newParams = {
				...params,
				fields: params.fields?.map(f => fields.nameMap[f] || f)
			}
			const response = await jiraHelpers.fetchJiraIssuesWithJQL(newParams);


			return response.issues.map((issue: JiraIssue) => {
				return {
					...issue,
					fields: mapIdsToNames(issue.fields, fields)
				}
			});
		},
		fetchAllJiraIssuesWithJQL: async function (params: FetchJiraIssuesParams) {
			const { limit: limit, ...apiParams } = params;
			const firstRequest = jiraHelpers.fetchJiraIssuesWithJQL({ maxResults: 100, ...apiParams });
			const { issues, maxResults, total, startAt } = await firstRequest;
			const requests = [firstRequest];
			
			const limitOrTotal = Math.min(total, limit || Infinity);
			for (let i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
				requests.push(
					jiraHelpers.fetchJiraIssuesWithJQL({ maxResults: maxResults, startAt: i, ...apiParams })
				);
			}
			return Promise.all(requests).then(
				(responses) => {
					return responses.map((response) => response.issues).flat();
				}
			)
		},
		fetchAllJiraIssuesWithJQLUsingNamedFields: async function(params: FetchJiraIssuesParams) {
			const fields = await fieldsRequest;

			const newParams = {
				...params,
				fields: params.fields?.map(f => fields.nameMap[f] || f)
			}
			const response = await jiraHelpers.fetchAllJiraIssuesWithJQL(newParams);

			return response.map((issue) => {
				return {
					...issue,
					fields: mapIdsToNames(issue.fields, fields)
				}
			});
		},
		fetchJiraChangelog(issueIdOrKey: string, params: FetchJiraIssuesParams) {
			// TODO investigate this - convert params to proper type
			return requestHelper(`/api/3/issue/${issueIdOrKey}/changelog?` + new URLSearchParams(params as any));
		},
		isChangelogComplete(changelog: { histories: any[]; total: number; }) {
			return changelog.histories.length === changelog.total
		},
		fetchRemainingChangelogsForIssues(
			issues: JiraIssue[],
			progress: {
				data?: ProgressData;
				(data: ProgressData): void;
			} = () => {}
		) {
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
		fetchRemainingChangelogsForIssue(
			issueIdOrKey: string,
			mostRecentChangeLog: {
				histories: { id: string; change: string; }[];
				maxResults: number;
				total: number;
				startAt: number;
			}
		) {
			const { histories, maxResults, total, startAt } = mostRecentChangeLog;

			const requests = [];
			requests.push({ values: mostRecentChangeLog.histories });
			for (let i = 0; i < total - maxResults; i += maxResults) {
				requests.push(
					jiraHelpers.fetchJiraChangelog(issueIdOrKey, {
						maxResults: Math.min(maxResults, total - maxResults - i),
						startAt: i,
					} as any).then((response) => {
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
		fetchAllJiraIssuesWithJQLAndFetchAllChangelog(
			params: {
				limit?: number;
				maxResults?: number;
				startAt?: number;
				expand?: string[];
				[key: string]: any;
			},
			progress: {
				data?: ProgressData;
				(data: ProgressData): void;
			} = () => {}
		): Promise<Issue[]> {
			const { limit: limit, ...apiParams } = params;

			// a weak map would be better
			progress.data = progress.data || {
				issuesRequested: 0,
				issuesReceived: 0,
				changeLogsRequested: 0,
				changeLogsReceived: 0
			} as ProgressData;
			function getRemainingChangeLogsForIssues(response: { issues: JiraIssue[] }) {
				if(progress.data) {
					Object.assign(progress.data as ProgressData, {
						issuesReceived: progress.data.issuesReceived + response.issues.length
					});
					progress(progress.data);
				}
				return jiraHelpers.fetchRemainingChangelogsForIssues(response.issues, progress)
			}

			const firstRequest = jiraHelpers.fetchJiraIssuesWithJQL({ maxResults: 100, expand: ["changelog"], ...apiParams });

			return firstRequest.then( ({ issues, maxResults, total, startAt }) => {
				if(progress.data) {
					Object.assign(progress.data as ProgressData, {
						issuesRequested: progress.data.issuesRequested+total,
						changeLogsRequested: 0,
						changeLogsReceived: 0
					});
					progress(progress.data);
				}

				const requests = [firstRequest.then(getRemainingChangeLogsForIssues)];
				const limitOrTotal = Math.min(total, limit || Infinity);

				for (let i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
					requests.push(
						jiraHelpers.fetchJiraIssuesWithJQL({ maxResults: maxResults, startAt: i, ...apiParams })
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
		fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: async function (
			params: { fields: string[]; [key: string]: any },
			progress: (data: ProgressData) => void = () => {}
		) {
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
		fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: async function (
			params: { fields: string[]; [key: string]: any },
			progress: {
				data?: ProgressData;
				(data: ProgressData): void;
			} = () => {}
		) {
			console.warn("THIS METHOD SHOULD BE IMPOSSIBLE TO CALL");
			return Promise.resolve(null as any);
		},
		fetchChildrenResponses(
			params: { fields: string[]; [key: string]: any },
			parentIssues: Issue[],
			progress: (data: ProgressData) => void = () => {}
		) {
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
		fetchDeepChildren(
			params: { fields: string[]; [key: string]: any },
			sourceParentIssues: Issue[],
			progress: (data: ProgressData) => void = () => {}
		): Promise<Issue[]> {
			const batchedFirstResponses = this.fetchChildrenResponses(params, sourceParentIssues, progress);

			const getChildren = (parentIssues: Issue[]) => {
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
			return requestHelper(`/api/3/field`);
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
		_cachedServerInfoPromise: function() {
			return requestHelper('/api/3/serverInfo')
		},
		getServerInfo(): Promise<RequestHelperResponse> {
			// if(this._cachedServerInfoPromise) {
			// 	return this._cachedServerInfoPromise;
			// }
			// // https://your-domain.atlassian.net/rest/api/3/serverInfo

			// return this._cachedServerInfoPromise( = requestHelper('/api/3/serverInfo'));
			return this._cachedServerInfoPromise();
		},
	}

	jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields = 
		makeDeepChildrenLoaderUsingNamedFields(jiraHelpers.fetchAllJiraIssuesWithJQL.bind(jiraHelpers));

	jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields = 
		makeDeepChildrenLoaderUsingNamedFields(jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelog.bind(jiraHelpers));


	// commented out because it's not used

	// function makeFieldNameToIdMap(
	// 	fields: {
	// 		name: string;
	// 		id: string | number;
	// 	}[]
	// ) {
	// 	const map = {};
	// 	fields.forEach((f) => {
	// 		map[f.name] = f.id;
	// 	});
	// 	return map;
	// }

	if (host === "jira" || jiraHelpers.hasValidAccessToken()) {
		// @ts-ignore
		fieldsRequest = jiraHelpers.fetchJiraFields().then((fields) => {
			const nameMap = {};
			const idMap = {};
			// @ts-ignore
			fields.forEach((f) => {
				// @ts-ignore
				idMap[f.id] = f.name;
				// @ts-ignore
				nameMap[f.name] = f.id;
			});
			console.log(nameMap);

			return {
				list: fields,
				nameMap: nameMap,
				idMap: idMap
			}
		});
		// @ts-ignore
		jiraHelpers.fieldsRequest = fieldsRequest;
	}


	function mapIdsToNames(
		obj: { [key: string]: any },
		fields: { idMap: { [key: string]: string } }
	) {
		const mapped: { [key: string]: any } = {};
		for (let prop in obj) {
			mapped[fields.idMap[prop] || prop] = obj[prop];
		}
		return mapped;
	}

	function fieldsToEditBody(
		obj: Record<string, any>,
		fieldMapping: { nameMap: Record<string, string> }
	){
		const editBody: {
			fields: Record<string, any>;
			update: Record<string, { set: any }[]>;
		} = {fields: {}, update: {}};
		
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

	// commented out because it's not used

	// function mapNamesToIds(obj, fields) {
	// 	const mapped = {};
	// 	for (let prop in obj) {
	// 		//if(prop === "Story points") {
	// 			// 10016 -> story point estimate
	// 			// 10034 -> story points
	// 			//obj[prop] = ""+obj[prop];
	// 			//mapped["customfield_10016"] = obj[prop];
	// 			//mapped["customfield_10034"] = obj[prop];
	// 			//mapped["Story points"] = obj[prop];
	// 			//mapped["storypoints"] = obj[prop];
	// 			//mapped["Story Points"] = obj[prop];
	// 			// 10016 -> story point estimate
	// 		//} else {
	// 			mapped[fields.nameMap[prop] || prop] = obj[prop];
	// 		//}
			
	// 	}
	// }
	
	window.jiraHelpers = jiraHelpers;
	return jiraHelpers;
}
