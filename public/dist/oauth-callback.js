function saveInformationToLocalStorage(parameters) {
    const objectKeys = Object.keys(parameters);
    for (let key of objectKeys) {
        const value = parameters[key];
        if (value) {
            // TODO: This is a hack to get around the fact that we can't store arrays in local storage, should everything JSON.stringify? Are arrays real?
            window.localStorage.setItem(key, Array.isArray(value) ? "" : value.toString());
        }
        else {
            window.localStorage.removeItem(key);
        }
    }
}
function clearAuthFromLocalStorage() {
    window.localStorage.removeItem("accessToken");
    window.localStorage.removeItem("refreshToken");
    window.localStorage.removeItem("expiryTimestamp");
}
function fetchFromLocalStorage(key) {
    return window.localStorage.getItem(key);
}

function responseToJSON(response) {
    if (!response.ok) {
        return response.json().then((payload) => {
            const err = new Error("HTTP status code: " + response.status);
            Object.assign(err, payload);
            Object.assign(err, response);
            throw err;
        });
    }
    return response.json();
}

/**
 * this module contains helper functions for requesting json over http.
 */
async function fetchJSON(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        const payload = await response.json();
        const err = new Error("HTTP status code: " + response.status);
        Object.assign(err, payload);
        Object.assign(err, response);
        throw err;
    }
    return responseToJSON(response);
}

/**
 * this module contains a collection of helper functions for authentication.
 */
const fetchAuthorizationCode = (config) => () => {
    const url = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${config.env.JIRA_CLIENT_ID}&scope=${config.env.JIRA_SCOPE}&redirect_uri=${config.env.JIRA_CALLBACK_URL}&response_type=code&prompt=consent&state=${encodeURIComponent(encodeURIComponent(window.location.search))}`;
    window.location.href = url;
};
const refreshAccessToken = (config) => async (accessCode) => {
    try {
        const response = await fetchJSON(`${config.env.JIRA_API_URL}/?code=${accessCode}`);
        const { accessToken, expiryTimestamp, refreshToken } = response;
        saveInformationToLocalStorage({
            accessToken,
            refreshToken,
            expiryTimestamp,
        });
        return accessToken;
    }
    catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
        }
        else {
            console.error("An unknown error occurred");
        }
        clearAuthFromLocalStorage();
        fetchAuthorizationCode(config)();
    }
};
async function fetchAccessTokenWithAuthCode(authCode) {
    try {
        const { accessToken, expiryTimestamp, refreshToken, scopeId } = await fetchJSON(`./access-token?code=${authCode}`);
        saveInformationToLocalStorage({
            accessToken,
            refreshToken,
            expiryTimestamp,
            // Only include the scopeId if there wasn't one already set
            ...fetchFromLocalStorage("scopeId") ? {} : { scopeId }
        });
        //redirect to data page
        const addOnQuery = new URL(window.location).searchParams.get("state");
        // const decoded = decodeURIComponent(addOnQuery as string);
        location.href = "/" + (addOnQuery ?? "");
    }
    catch (error) {
        //handle error properly.
        console.error(error);
        // location.href = '/error.html';
    }
}
const getAccessToken = (config) => async () => {
    if (!hasValidAccessToken()) {
        const refreshToken = fetchFromLocalStorage("refreshToken");
        if (!refreshToken) {
            fetchAuthorizationCode(config)();
        }
        else {
            return refreshAccessToken(config)();
        }
    }
    else {
        return fetchFromLocalStorage("accessToken");
    }
};
const hasAccessToken = () => {
    return !!fetchFromLocalStorage("accessToken");
};
const hasValidAccessToken = () => {
    const accessToken = fetchFromLocalStorage("accessToken");
    let expiryTimestamp = Number(fetchFromLocalStorage("expiryTimestamp"));
    if (isNaN(expiryTimestamp)) {
        expiryTimestamp = 0;
    }
    const currentTimestamp = Math.floor(new Date().getTime() / 1000.0);
    return !(currentTimestamp > expiryTimestamp || !accessToken);
};

function chunkArray(array, size) {
    const chunkedArr = [];
    for (let i = 0; i < array.length; i += size) {
        chunkedArr.push(array.slice(i, i + size));
    }
    return chunkedArr;
}

function mapIdsToNames(obj, fields) {
    const mapped = {};
    for (let prop in obj) {
        mapped[fields.idMap[prop] || prop] = obj[prop];
    }
    return mapped;
}

/**
 * this module is for getting text strings from an http response.
 */
function responseToText(response) {
    if (!response.ok) {
        return response.json().then((payload) => {
            const err = new Error("HTTP status code: " + response.status);
            Object.assign(err, payload);
            Object.assign(err, response);
            throw err;
        });
    }
    return response.text();
}

function unique(list, uniqueBy) {
    const result = new Map();
    for (const item of list) {
        const itemKey = uniqueBy(item);
        if (!result.has(itemKey))
            result.set(itemKey, item);
    }
    return [...result.values()];
}
function uniqueKeys(list) {
    return unique(list, ({ key }) => key);
}

/**
 * this module is for requesting all jira issues and changelogs.
 */
function fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config) {
    return (params, progress = () => { }) => {
        const { limit, ...apiParams } = params;
        // a weak map would be better
        progress.data =
            progress.data ||
                {
                    issuesRequested: 0,
                    issuesReceived: 0,
                    changeLogsRequested: 0,
                    changeLogsReceived: 0,
                };
        function getRemainingChangeLogsForIssues({ issues }) {
            if (progress.data) {
                Object.assign(progress.data, {
                    issuesReceived: progress.data.issuesReceived + issues.length,
                });
                progress(progress.data);
            }
            return fetchRemainingChangelogsForIssues(config)(issues, progress);
        }
        const firstRequest = fetchJiraIssuesWithJQL(config)({
            maxResults: 100,
            expand: ["changelog"],
            ...apiParams,
        });
        return firstRequest.then(({ maxResults, total, startAt }) => {
            if (progress.data) {
                Object.assign(progress.data, {
                    issuesRequested: progress.data.issuesRequested + total,
                    changeLogsRequested: 0,
                    changeLogsReceived: 0,
                });
                progress(progress.data);
            }
            const requests = [firstRequest.then(getRemainingChangeLogsForIssues)];
            const limitOrTotal = Math.min(total, limit ?? Infinity);
            for (let i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
                requests.push(fetchJiraIssuesWithJQL(config)({
                    maxResults: maxResults,
                    startAt: i,
                    ...apiParams,
                }).then(getRemainingChangeLogsForIssues));
            }
            return Promise.all(requests).then((responses) => {
                return uniqueKeys(responses.flat());
            });
        });
    };
}

/**
 * this module is contains helpers for working with jira.
 */
function fetchAccessibleResources(config) {
    return () => {
        return config.requestHelper(`https://api.atlassian.com/oauth/token/accessible-resources`);
    };
}
function fetchJiraSprint(config) {
    return (sprintId) => {
        return config.requestHelper(`/agile/1.0/sprint/${sprintId}`);
    };
}
function fetchJiraIssue(config) {
    return (issueId) => {
        return config.requestHelper(`/api/3/issue/${issueId}`);
    };
}
const fieldsToEditBody = (obj, fieldMapping) => {
    const editBody = { fields: {}, update: {} };
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
function fetchJiraIssuesWithJQLWithNamedFields(config) {
    return async (params) => {
        const fields = await config.fieldsRequest();
        const newParams = {
            ...params,
            fields: params.fields?.map((f) => fields?.nameMap && f in fields.nameMap ? fields.nameMap[f] : f),
        };
        const response = await fetchJiraIssuesWithJQL(config)(newParams);
        const uniqueIssues = uniqueKeys(response.issues);
        return uniqueIssues.map((issue) => {
            return {
                ...issue,
                fields: mapIdsToNames(issue.fields, fields),
            };
        });
    };
}
function fetchJiraIssuesWithJQL(config) {
    return (params) => {
        // TODO - investigate this and convert params to proper type
        return config.requestHelper(`/api/3/search?` + new URLSearchParams(params));
    };
}
// TODO ... we probably can remove this.  It's also not working right.
function JiraIssueParamsToParams(params) {
    const formattedParams = {};
    if (params.jql)
        formattedParams.jql = params.jql;
    if (params.startAt)
        formattedParams.startAt = params.startAt.toString();
    if (params.maxResults)
        formattedParams.maxResults = params.maxResults.toString();
    if (params.fields)
        formattedParams.fields = params.fields.join(",");
    return formattedParams;
}
function fetchIssueTypes(config) {
    return () => {
        // TODO this needs fixed, the type expectations here are all wrong
        const response = config.requestHelper(`/api/3/issuetype`);
        return response;
    };
}
function fetchAllJiraIssuesWithJQL(config) {
    return async (params) => {
        const { limit, ...apiParams } = params;
        const firstRequest = fetchJiraIssuesWithJQL(config)({
            maxResults: 100,
            ...apiParams,
        });
        const { maxResults, total, startAt } = await firstRequest;
        const requests = [firstRequest];
        const limitOrTotal = Math.min(total, limit ?? Infinity);
        for (let i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
            requests.push(fetchJiraIssuesWithJQL(config)({
                maxResults: maxResults,
                startAt: i,
                ...apiParams,
            }));
        }
        return Promise.all(requests).then((responses) => {
            return responses.map((response) => response.issues).flat();
        });
    };
}
function fetchAllJiraIssuesWithJQLUsingNamedFields(config) {
    return async (params) => {
        const fields = await config.fieldsRequest();
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
function fetchJiraChangelog(config) {
    return (issueIdOrKey, params) => {
        // TODO investigate this - convert params to proper type
        return config.requestHelper(`/api/3/issue/${issueIdOrKey}/changelog?` +
            new URLSearchParams(JiraIssueParamsToParams(params)));
    };
}
function isChangelogComplete(changelog) {
    return changelog.histories.length === changelog.total;
}
function fetchRemainingChangelogsForIssues(config) {
    return (issues, progress = () => { }) => {
        const fetchChangelogs = fetchRemainingChangelogsForIssue(config);
        // check for remainings
        return Promise.all(issues.map(({ key, changelog, ...issue }) => {
            if (!changelog || isChangelogComplete(changelog)) {
                return {
                    key,
                    ...issue,
                    changelog: changelog?.histories,
                };
            }
            else {
                return fetchChangelogs(key, changelog).then((histories) => {
                    return {
                        key,
                        ...issue,
                        changelog: histories,
                    };
                });
            }
        }));
    };
}
// weirdly, this starts with the oldest, but we got the most recent
// returns an array of histories objects
function fetchRemainingChangelogsForIssue(config) {
    return async (issueIdOrKey, mostRecentChangeLog) => {
        const { maxResults, total } = mostRecentChangeLog;
        const requests = [];
        requests.push({ values: mostRecentChangeLog.histories });
        for (let i = 0; i < total - maxResults; i += maxResults) {
            requests.push(fetchJiraChangelog(config)(issueIdOrKey, {
                maxResults: Math.min(maxResults, total - maxResults - i),
                startAt: i,
            }).then((response) => {
                // the query above reverses the sort order, we fix that here
                return { ...response, values: response.values.reverse() };
            }));
        }
        // server sends back as "values", we match that
        const responses = await Promise.all(requests);
        const response_2 = responses.map((response_1) => response_1.values).flat();
        return response_2;
    };
}
// this could do each response incrementally, but I'm being lazy
const fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields = (config) => async (params, progress = () => { }) => {
    const fields = await config.fieldsRequest();
    const newParams = {
        ...params,
        fields: params.fields.map((f) => fields?.nameMap[f] || f),
    };
    const response = await fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config)(newParams, progress);
    return response.map((issue) => {
        return {
            ...issue,
            fields: mapIdsToNames(issue.fields, fields),
        };
    });
    // change the parms
};
function fetchChildrenResponses(config) {
    return (params, parentIssues, progress = () => { }) => {
        const issuesToQuery = chunkArray(parentIssues, 40);
        const batchedResponses = issuesToQuery.map((issues) => {
            const keys = issues.map((issue) => issue.key);
            const jql = `parent in (${keys.join(", ")})`;
            return fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config)({
                ...params,
                jql,
            }, progress);
        });
        // this needs to be flattened
        return batchedResponses;
    };
}
// Makes child requests in batches of 40
//
// params - base params
// sourceParentIssues - the source of parent issues
function fetchDeepChildren(config) {
    return (params, sourceParentIssues, progress = () => { }) => {
        const batchedFirstResponses = fetchChildrenResponses(config)(params, sourceParentIssues, progress);
        const getChildren = (parentIssues) => {
            if (parentIssues.length) {
                return fetchDeepChildren(config)(params, parentIssues, progress).then((deepChildrenIssues) => {
                    return parentIssues.concat(deepChildrenIssues);
                });
            }
            else {
                return parentIssues;
            }
        };
        const batchedIssueRequests = batchedFirstResponses.map((firstBatchPromise) => {
            return firstBatchPromise.then(getChildren);
        });
        return Promise.all(batchedIssueRequests).then((allChildren) => {
            return allChildren.flat();
        });
    };
}
function editJiraIssueWithNamedFields(config) {
    return async (issueId, fields) => {
        const scopeIdForJira = fetchFromLocalStorage("scopeId");
        const accessToken = fetchFromLocalStorage("accessToken");
        const fieldMapping = await config.fieldsRequest();
        const editBody = fieldsToEditBody(fields, fieldMapping);
        //const fieldsWithIds = mapNamesToIds(fields || {}, fieldMapping),
        //	updateWithIds = mapNamesToIds(update || {}, fieldMapping);
        return fetch(`${config.env.JIRA_API_URL}/${scopeIdForJira}/rest/api/3/issue/${issueId}?returnIssue=true` +
            "" /*new URLSearchParams(params)*/, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(editBody),
        }).then(responseToText);
    };
}

/**
 * this module gets available jira fields.
 */
function fetchJiraFields(config) {
    return () => {
        return config.requestHelper(`/api/3/field`);
    };
}
function fieldPriorityOrder(a, b) {
    if (a?.scope && !b?.scope) {
        return 1;
    }
    if (b?.scope && !a?.scope) {
        return -1;
    }
    return 0;
}
function makeFieldsRequest(config, setFieldsRequest) {
    if (config.host === "jira" || hasValidAccessToken()) {
        const req = fetchJiraFields(config)().then((fieldsPassed) => {
            const fields = fieldsPassed;
            const nameMap = {};
            const idMap = {};
            const idToFields = {};
            fields.forEach((f) => {
                // @ts-ignore
                idMap[f.id] = f.name;
                // @ts-ignore
                if (!idToFields[f.name]) {
                    idToFields[f.name] = [];
                }
                idToFields[f.name].push(f);
            });
            for (let fieldName in idToFields) {
                idToFields[fieldName].sort(fieldPriorityOrder);
                nameMap[fieldName] = idToFields[fieldName][0].id;
            }
            return {
                list: fields,
                nameMap: nameMap,
                idMap: idMap,
            };
        });
        setFieldsRequest(req);
    }
}

const _cachedServerInfoPromise = (config) => () => {
    return config.requestHelper("/api/3/serverInfo");
};
const getServerInfo = (config) => () => {
    // if(this._cachedServerInfoPromise) {
    // 	return this._cachedServerInfoPromise;
    // }
    // // https://your-domain.atlassian.net/rest/api/3/serverInfo
    // return this._cachedServerInfoPromise( = config.requestHelper('/api/3/serverInfo'));
    return _cachedServerInfoPromise(config)();
};

/**
 * this module recursively fetches jira issues.
 */
function getIssuesThatHaventBeenLoaded(parentIssues, set) {
    return parentIssues.filter((issue) => {
        if (!set.has(issue.key)) {
            set.add(issue.key);
            return true;
        }
    });
}
function makeDeepChildrenLoaderUsingNamedFields(config) {
    return (rootMethod) => {
        // Makes child requests in batches of 40
        //
        // params - base params
        // sourceParentIssues - the source of parent issues
        function fetchChildrenResponses(params, parentIssues, progress) {
            const issuesThatNeedToBeLoaded = getIssuesThatHaventBeenLoaded(parentIssues, progress?.data?.keysWhoseChildrenWeAreAlreadyLoading ?? new Set());
            const issuesToQuery = chunkArray(issuesThatNeedToBeLoaded, 40);
            const batchedResponses = issuesToQuery.map((issues) => {
                const keys = issues.map((issue) => issue.key);
                const jql = `parent in (${keys.join(", ")}) ${params.childJQL || ""}`;
                return rootMethod({
                    ...params,
                    jql,
                }, progress);
            });
            // this needs to be flattened
            return batchedResponses;
        }
        async function fetchDeepChildren(params, sourceParentIssues, progress) {
            const batchedFirstResponses = fetchChildrenResponses(params, sourceParentIssues, progress);
            const getChildren = (parentIssues) => {
                if (parentIssues.length) {
                    return fetchDeepChildren(params, parentIssues, progress).then((deepChildrenIssues) => {
                        return parentIssues.concat(deepChildrenIssues);
                    });
                }
                else {
                    return parentIssues;
                }
            };
            const batchedIssueRequests = batchedFirstResponses.map((firstBatchPromise) => {
                return firstBatchPromise.then(getChildren);
            });
            const allChildren = await Promise.all(batchedIssueRequests);
            return allChildren.flat();
        }
        return async function fetchAllDeepChildren(params, progress = (() => { })) {
            const fields = await config.fieldsRequest();
            const newParams = {
                ...params,
                fields: params.fields?.map((f) => fields.nameMap[f] || f),
            };
            progress.data = progress.data || {
                issuesRequested: 0,
                issuesReceived: 0,
                changeLogsRequested: 0,
                changeLogsReceived: 0,
                keysWhoseChildrenWeAreAlreadyLoading: new Set(),
            };
            const parentIssues = await rootMethod(newParams, progress);
            // go get the children
            const allChildrenIssues = await fetchDeepChildren(newParams, parentIssues, progress);
            const combinedUnique = uniqueKeys(parentIssues.concat(allChildrenIssues));
            const result = combinedUnique.map((issue) => ({
                ...issue,
                fields: mapIdsToNames(issue.fields, fields),
            }));
            return result;
        };
    };
}

function createJiraHelpers({ JIRA_CLIENT_ID, JIRA_SCOPE, JIRA_CALLBACK_URL, JIRA_API_URL, JIRA_APP_KEY } = window.env, requestHelper, host) {
    // TODO currently fieldsRequest has to be defined and passed to other functions before it's
    // assigned, feels like there should be a better way to do it than this, but a setter function
    // was quickest solution i could come up with. Should revisit at some point.
    let fieldsRequest;
    const setFieldsRequest = (req) => (fieldsRequest = req);
    const config = {
        env: { JIRA_CLIENT_ID, JIRA_SCOPE, JIRA_CALLBACK_URL, JIRA_API_URL, JIRA_APP_KEY },
        requestHelper,
        fieldsRequest: () => fieldsRequest,
        host,
    };
    const makeDeep = makeDeepChildrenLoaderUsingNamedFields(config);
    const jiraHelpers = {
        appKey: JIRA_APP_KEY,
        saveInformationToLocalStorage,
        clearAuthFromLocalStorage,
        fetchFromLocalStorage,
        fetchAuthorizationCode: fetchAuthorizationCode(config),
        refreshAccessToken: refreshAccessToken(config),
        fetchAccessTokenWithAuthCode,
        fetchAccessibleResources: fetchAccessibleResources(config),
        fetchJiraSprint: fetchJiraSprint(config),
        fetchJiraIssue: fetchJiraIssue(config),
        editJiraIssueWithNamedFields: editJiraIssueWithNamedFields(config),
        fetchJiraIssuesWithJQL: fetchJiraIssuesWithJQL(config),
        fetchJiraIssuesWithJQLWithNamedFields: fetchJiraIssuesWithJQLWithNamedFields(config),
        fetchAllJiraIssuesWithJQL: fetchAllJiraIssuesWithJQL(config),
        fetchAllJiraIssuesWithJQLUsingNamedFields: fetchAllJiraIssuesWithJQLUsingNamedFields(config),
        fetchJiraChangelog: fetchJiraChangelog(config),
        isChangelogComplete,
        fetchRemainingChangelogsForIssues: fetchRemainingChangelogsForIssues(config),
        fetchRemainingChangelogsForIssue: fetchRemainingChangelogsForIssue(config),
        fetchAllJiraIssuesWithJQLAndFetchAllChangelog: fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config),
        fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(config),
        fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: makeDeep(fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config)),
        fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields: makeDeep(fetchAllJiraIssuesWithJQL(config)),
        fetchChildrenResponses: fetchChildrenResponses(config),
        fetchDeepChildren: fetchDeepChildren(config),
        fetchJiraFields: fetchJiraFields(config),
        fetchIssueTypes: fetchIssueTypes(config),
        getAccessToken: getAccessToken(config),
        hasAccessToken,
        hasValidAccessToken,
        _cachedServerInfoPromise,
        getServerInfo: getServerInfo(config),
        requester: requestHelper,
    };
    makeFieldsRequest(config, setFieldsRequest);
    jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields = makeDeep(jiraHelpers.fetchAllJiraIssuesWithJQL.bind(jiraHelpers));
    jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields =
        makeDeep(jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelog.bind(jiraHelpers));
    return jiraHelpers;
}

function oauthCallback(environment) {
  const jiraHelpers = createJiraHelpers(environment);
  const queryParams = new URLSearchParams(window.location.search);
  const queryCode = queryParams.get("code");
  if (!queryCode) {
    //handle error properly to ensure good feedback
    mainElement.innerHTML = `<p>Invalid code provided. <a href="/" class="link">Click here to return to the Timeline Report</a></p>`;
    // Todo
  } else {
    jiraHelpers.fetchAccessTokenWithAuthCode(queryCode);
  }
}

export { oauthCallback as default };
//# sourceMappingURL=oauth-callback.js.map
