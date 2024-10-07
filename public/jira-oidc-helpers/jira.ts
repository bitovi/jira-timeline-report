import { hasValidAccessToken } from "./auth";
import chunkArray from "./chunkArray";
import { Config } from "./types";
import mapIdsToNames from "./mapIdsToNames";
import responseToText from "./responseToText";
import { FetchJiraIssuesParams, Issue, JiraIssue, ProgressData } from "./types";
import { fetchFromLocalStorage } from "./storage";

export function fetchAccessibleResources(config: Config) {
    return () => {
        return config.requestHelper(
            `https://api.atlassian.com/oauth/token/accessible-resources`
        );
    };
}
export function fetchJiraSprint(config: Config) {
    return (sprintId: string) => {
        return config.requestHelper(`/agile/1.0/sprint/${sprintId}`);
    };
}
export function fetchJiraIssue(config: Config) {
    return (issueId: string) => {
        return config.requestHelper(`/api/3/issue/${issueId}`);
    };
} export const fieldsToEditBody = (
    obj: Record<string, any>,
    fieldMapping: { nameMap: Record<string, string>; }
) => {
    const editBody: {
        fields: Record<string, any>;
        update: Record<string, { set: any; }[]>;
    } = { fields: {}, update: {} };

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
        editBody.update[fieldMapping.nameMap[prop] || prop] = [{ set: obj[prop] }];
    }
    return editBody;
};
export function fetchJiraIssuesWithJQLWithNamedFields(config: Config) {
    return async (params: FetchJiraIssuesParams) => {
        const fields = await fieldsRequest(config)();

        if (!fields) return;

        const newParams = {
            ...params,
            fields: params.fields?.map((f) => f in fields.nameMap ? fields.nameMap[f] : f
            ),
        };
        const response = await fetchJiraIssuesWithJQL(config)(newParams);

        return response.issues.map((issue: JiraIssue) => {
            return {
                ...issue,
                fields: mapIdsToNames(issue.fields, fields),
            };
        });
    };
}
export function fieldsRequest(config: Config) {
    return () => {
        if (config.host === "jira" || hasValidAccessToken()) {
            return fetchJiraFields(config)().then((fields) => {
                const nameMap: Record<string, any> = {};
                const idMap: Record<string, any> = {};
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
                    idMap: idMap,
                };
            });
        }
    };
}
export function fetchJiraIssuesWithJQL(config: Config) {
    return (params: FetchJiraIssuesParams) => {
        // TODO - investigate this and convert params to proper type
        return config.requestHelper(
            `/api/3/search?` + new URLSearchParams(JiraIssueParamsToParams(params))
        );
    };
}
export function JiraIssueParamsToParams(params: FetchJiraIssuesParams): Record<string, string> {
    const formattedParams: Record<string, string> = {};
    if (params.jql) formattedParams.jql = params.jql;
    if (params.startAt) formattedParams.startAt = params.startAt.toString();
    if (params.maxResults)
        formattedParams.maxResults = params.maxResults.toString();
    if (params.fields) formattedParams.fields = params.fields.join(",");
    return formattedParams;
}
export function fetchJiraFields(config: Config) {
    return () => {
        return config.requestHelper(`/api/3/field`);
    };
}
export function fetchAllJiraIssuesWithJQL(config: Config) {
    return async (params: FetchJiraIssuesParams) => {
        const { limit: limit, ...apiParams } = params;
        const firstRequest = fetchJiraIssuesWithJQL(config)({
            maxResults: 100,
            ...apiParams,
        });
        const { issues, maxResults, total, startAt } = await firstRequest;
        const requests = [firstRequest];

        const limitOrTotal = Math.min(total, limit || Infinity);
        for (let i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
            requests.push(
                fetchJiraIssuesWithJQL(config)({
                    maxResults: maxResults,
                    startAt: i,
                    ...apiParams,
                })
            );
        }
        return Promise.all(requests).then((responses) => {
            return responses.map((response) => response.issues).flat();
        });
    };
}
export function fetchAllJiraIssuesWithJQLUsingNamedFields(config: Config) {
    return async (params: FetchJiraIssuesParams) => {
        const fields = await fieldsRequest(config)();

        if (!fields) return;

        const newParams = {
            ...params,
            fields: params.fields?.map((f) => fields.nameMap[f] || f),
        };
        const response = await fetchAllJiraIssuesWithJQL(config)(newParams);

        return response.map((issue) => {
            return {
                ...issue,
                fields: mapIdsToNames(issue.fields, fields),
            };
        });
    };
}
export function fetchJiraChangelog(config: Config) {
    return (issueIdOrKey: string, params: FetchJiraIssuesParams) => {
        // TODO investigate this - convert params to proper type
        return config.requestHelper(
            `/api/3/issue/${issueIdOrKey}/changelog?` +
            new URLSearchParams(JiraIssueParamsToParams(params))
        );
    };
}
export function isChangelogComplete(changelog: {
    histories: any[];
    total: number;
}): boolean {
    return changelog.histories.length === changelog.total;
}
export function fetchRemainingChangelogsForIssues(config: Config) {
    return (
        issues: JiraIssue[],
        progress: {
            data?: ProgressData;
            (data: ProgressData): void;
        } = () => { }
    ) => {
        // check for remainings
        return Promise.all(
            issues.map((issue) => {
                if (isChangelogComplete(issue.changelog)) {
                    return {
                        ...issue,
                        changelog: issue.changelog.histories,
                    };
                } else {
                    return fetchRemainingChangelogsForIssue(config)(
                        issue.key,
                        issue.changelog
                    ).then((histories) => {
                        return {
                            ...issue,
                            changelog: issue.changelog.histories,
                        };
                    });
                }
            })
        );
    };
}
// weirdly, this starts with the oldest, but we got the most recent
// returns an array of histories objects

export function fetchRemainingChangelogsForIssue(config: Config) {
    return async (
        issueIdOrKey: string,
        mostRecentChangeLog: {
            histories: { id: string; change: string; }[];
            maxResults: number;
            total: number;
            startAt: number;
        }
    ) => {
        const { histories, maxResults, total, startAt } = mostRecentChangeLog;

        const requests = [];
        requests.push({ values: mostRecentChangeLog.histories });
        for (let i = 0; i < total - maxResults; i += maxResults) {
            requests.push(
                fetchJiraChangelog(config)(issueIdOrKey, {
                    maxResults: Math.min(maxResults, total - maxResults - i),
                    startAt: i,
                }).then((response) => {
                    // the query above reverses the sort order, we fix that here
                    return { ...response, values: response.values.reverse() };
                })
            );
        }
        // server sends back as "values", we match that
        const responses = await Promise.all(requests);
        const response_2 = responses.map((response_1) => response_1.values).flat();
        return response_2;
    };
}
export function fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config: Config) {
    return (
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
        } = () => { }
    ): Promise<Issue[]> => {
        const { limit: limit, ...apiParams } = params;

        // a weak map would be better
        progress.data =
            progress.data ||
            ({
                issuesRequested: 0,
                issuesReceived: 0,
                changeLogsRequested: 0,
                changeLogsReceived: 0,
            } as ProgressData);
        function getRemainingChangeLogsForIssues(response: {
            issues: JiraIssue[];
        }) {
            if (progress.data) {
                Object.assign(progress.data as ProgressData, {
                    issuesReceived: progress.data.issuesReceived + response.issues.length,
                });
                progress(progress.data);
            }
            return fetchRemainingChangelogsForIssues(config)(
                response.issues,
                progress
            );
        }

        const firstRequest = fetchJiraIssuesWithJQL(config)({
            maxResults: 100,
            expand: ["changelog"],
            ...apiParams,
        });

        return firstRequest.then(({ issues, maxResults, total, startAt }) => {
            if (progress.data) {
                Object.assign(progress.data as ProgressData, {
                    issuesRequested: progress.data.issuesRequested + total,
                    changeLogsRequested: 0,
                    changeLogsReceived: 0,
                });
                progress(progress.data);
            }

            const requests = [firstRequest.then(getRemainingChangeLogsForIssues)];
            const limitOrTotal = Math.min(total, limit || Infinity);

            for (let i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
                requests.push(
                    fetchJiraIssuesWithJQL(config)({
                        maxResults: maxResults,
                        startAt: i,
                        ...apiParams,
                    }).then(getRemainingChangeLogsForIssues)
                );
            }
            return Promise.all(requests).then((responses) => {
                return responses.flat();
            });
        });
    };
}
// this could do each response incrementally, but I'm being lazy
export const fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields = (config: Config) =>
    async (
        params: { fields: string[];[key: string]: any; },
        progress: (data: ProgressData) => void = () => { }
    ) => {
        const fields = await fieldsRequest(config)();
        if (!fields) {
            return Promise.resolve(null);
        }
        const newParams = {
            ...params,
            fields: params.fields.map((f) => fields?.nameMap[f] || f),
        };
        const response = await fetchAllJiraIssuesWithJQLAndFetchAllChangelog(
            config
        )(newParams, progress);

        return response.map((issue) => {
            return {
                ...issue,
                fields: mapIdsToNames(issue.fields, fields),
            };
        });
        // change the parms
    };
export async function fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields(params: { fields: string[];[key: string]: any; },
    progress: {
        data?: ProgressData;
        (data: ProgressData): void;
    } = () => { }) {
    console.warn("THIS METHOD SHOULD BE IMPOSSIBLE TO CALL");
    return Promise.resolve(null as any);
}

export function fetchChildrenResponses(config: Config) {
    return (
        params: { fields: string[];[key: string]: any; },
        parentIssues: Issue[],
        progress: (data: ProgressData) => void = () => { }
    ) => {
        const issuesToQuery = chunkArray(parentIssues, 40);
        const batchedResponses = issuesToQuery.map((issues) => {
            const keys = issues.map((issue) => issue.key);
            const jql = `parent in (${keys.join(", ")})`;
            return fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config)(
                {
                    ...params,
                    jql,
                },
                progress
            );
        });
        // this needs to be flattened
        return batchedResponses;
    };
}
// Makes child requests in batches of 40
//
// params - base params
// sourceParentIssues - the source of parent issues
export function fetchDeepChildren(config: Config) {
    return (
        params: { fields: string[];[key: string]: any; },
        sourceParentIssues: Issue[],
        progress: (data: ProgressData) => void = () => { }
    ): Promise<Issue[]> => {
        const batchedFirstResponses = fetchChildrenResponses(config)(
            params,
            sourceParentIssues,
            progress
        );

        const getChildren = (parentIssues: Issue[]) => {
            if (parentIssues.length) {
                return fetchDeepChildren(config)(params, parentIssues, progress).then(
                    (deepChildrenIssues) => {
                        return parentIssues.concat(deepChildrenIssues);
                    }
                );
            } else {
                return parentIssues;
            }
        };

        const batchedIssueRequests = batchedFirstResponses.map(
            (firstBatchPromise) => {
                return firstBatchPromise.then(getChildren);
            }
        );

        return Promise.all(batchedIssueRequests).then((allChildren) => {
            return allChildren.flat();
        });
    };
}

export function editJiraIssueWithNamedFields(config: Config) {
    return async (issueId: string, fields: Record<string, any>) => {
        const scopeIdForJira = fetchFromLocalStorage("scopeId");
        const accessToken = fetchFromLocalStorage("accessToken");

        const fieldMapping = await fieldsRequest(config)();
        if (!fieldMapping) return;

        const editBody = fieldsToEditBody(fields, fieldMapping);
        //const fieldsWithIds = mapNamesToIds(fields || {}, fieldMapping),
        //	updateWithIds = mapNamesToIds(update || {}, fieldMapping);
        return fetch(
            `${config.env.JIRA_API_URL}/${scopeIdForJira}/rest/api/3/issue/${issueId}?` +
            "" /*new URLSearchParams(params)*/,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(editBody),
            }
        ).then(responseToText);
    };
}
