import {
  JsonResponse,
  JtrEnv,
	RequestHelperResponse
} from './shared/types.js';

import { responseToJSON } from './shared/response-to-json';

const mapIdsToNames: any = require('./shared/map-ids-to-names').mapIdsToNames;
const chunkArray: any = require('./shared/chunk-array').chunkArray;

import { JiraHelpers } from './JiraHelpers.js';

interface ResponseForFieldRequest extends JsonResponse {
	nameMap: any
}

// TODO move this into main module
declare global {
  interface Window {
    env: JtrEnv;
    localStorage: Storage;
    location: Location;
		jiraHelpers: any;
  }
}

const CACHE_FETCH = false;

export async function nativeFetchJSON(
  url: string,
  options?: RequestInit
): Promise<JsonResponse> {
	return fetch(url, options).then(responseToJSON)
}

export default function JiraOIDCHelpers(
	{
		JIRA_CLIENT_ID,
		JIRA_SCOPE,
		JIRA_CALLBACK_URL,
		JIRA_API_URL
	}: JtrEnv = window.env,
	requestHelper: (urlFragment: string) => Promise<RequestHelperResponse>,
	host: 'hosted' | 'jira'
) {

	let fetchJSON = nativeFetchJSON;
	if (CACHE_FETCH) {
		fetchJSON = async function (url, options) {
			const storedUrl = window.localStorage.getItem(url);
			if (storedUrl && typeof(storedUrl) === 'string') {
				return JSON.parse(storedUrl);
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

	function makeDeepChildrenLoaderUsingNamedFields(rootMethod: any){

		// Makes child requests in batches of 40
		// 
		// params - base params
		// sourceParentIssues - the source of parent issues
		function fetchChildrenResponses(
			params: any,
			parentIssues: any,
			progress: any
		) {
			const issuesToQuery = chunkArray(parentIssues, 40);
	
			const batchedResponses = issuesToQuery.map( (issues: any) => {
				const keys = issues.map( (issue: any) => issue.key);
				const jql = `parent in (${keys.join(", ")})`;
				return rootMethod({
					...params,
					jql
				}, progress)
			});
			// this needs to be flattened
			return batchedResponses;
		}
	
		async function fetchDeepChildren(
			params: any,
			sourceParentIssues: any,
			progress: any
		) {
			const batchedFirstResponses = fetchChildrenResponses(params, sourceParentIssues, progress);
	
			const getChildren = (parentIssues: any) => {
				if(parentIssues.length) {
					return fetchDeepChildren(params, parentIssues, progress).then(deepChildrenIssues => {
						return parentIssues.concat(deepChildrenIssues);
					})
				} else {
					return parentIssues
				}
			}
			const batchedIssueRequests = batchedFirstResponses.map( (firstBatchPromise: any) => {
				return firstBatchPromise.then( getChildren )
			})
			const allChildren = await Promise.all(batchedIssueRequests);
			return allChildren.flat();
		}
	
		return async function fetchAllDeepChildren(
			params: any,
			progress: any
		){
			const fields = await fieldsRequest;
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
			const parentIssues = await rootMethod(newParams, progress);
	
			// go get the children
			const allChildrenIssues = await fetchDeepChildren(newParams, parentIssues, progress);
			const combined = parentIssues.concat(allChildrenIssues);
			return combined.map((issue: any) => {
				return {
					...issue,
					fields: mapIdsToNames(issue.fields, fields)
				}
			});
		}
	}

	const jiraHelpers = new JiraHelpers(
		{
			JIRA_CLIENT_ID,
			JIRA_SCOPE,
			JIRA_CALLBACK_URL,
			JIRA_API_URL
		},
		requestHelper,
		host,
		fetchJSON
	);

	jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields = 
		makeDeepChildrenLoaderUsingNamedFields(jiraHelpers.fetchAllJiraIssuesWithJQL.bind(jiraHelpers));

	jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields = 
		makeDeepChildrenLoaderUsingNamedFields(jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelog.bind(jiraHelpers));

	function makeFieldNameToIdMap(fields: any) {
		const map: any = {};
		fields.forEach((f: any) => {
			map[f.name] = f.id;
		});
		return map;
	}

	if (host === "jira" || jiraHelpers.hasValidAccessToken()) {
		fieldsRequest = jiraHelpers.fetchJiraFields().then((fields: any) => {
			const nameMap: any = {};
			const idMap: any = {};
			fields.forEach((f: any) => {
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
		jiraHelpers.fieldsRequest = fieldsRequest;
	}
	
	window.jiraHelpers = jiraHelpers;
	return jiraHelpers;
}
