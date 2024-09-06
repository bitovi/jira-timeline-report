import chunkArray from "./chunk-array";
import fetchJSON from "./fetch";
import mapIdsToNames from "./map-ids-to-names";
import responseToText from "./response-to-text";
import {
  FetchJiraIssuesParams,
  Issue,
  JiraIssue,
  ProgressData,
  RequestHelper,
  RequestHelperResponse,
} from "./types";

function saveInformationToLocalStorage(
  parameters: Record<string, string | number | string[]>,
) {
  const objectKeys = Object.keys(parameters) as Array<
    keyof FetchJiraIssuesParams
  >;
  for (let key of objectKeys) {
    const value = parameters[key];
    if (value) {
      // TODO: This is a hack to get around the fact that we can't store arrays in local storage, should everything JSON.stringify? Are arrays real?
      window.localStorage.setItem(
        key,
        Array.isArray(value) ? "" : value.toString(),
      );
    } else {
      window.localStorage.removeItem(key);
    }
  }
}

function clearAuthFromLocalStorage() {
  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("refreshToken");
  window.localStorage.removeItem("expiryTimestamp");
}

function fetchFromLocalStorage(key: string) {
  return window.localStorage.getItem(key);
}

const fetchAuthorizationCode = (config: Config) => () => {
  const url = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${config.env.JIRA_CLIENT_ID}&scope=${config.env.JIRA_SCOPE}&redirect_uri=${config.env.JIRA_CALLBACK_URL}&response_type=code&prompt=consent&state=${encodeURIComponent(encodeURIComponent(window.location.search))}`;
  window.location.href = url;
};

const refreshAccessToken =
  (config: Config) =>
  async (accessCode?: string): Promise<string | void> => {
    try {
      const response = await fetchJSON(
        `${config.env.JIRA_API_URL}/?code=${accessCode}`,
      );

      const { accessToken, expiryTimestamp, refreshToken } = response.data;
      saveInformationToLocalStorage({
        accessToken,
        refreshToken,
        expiryTimestamp,
      });
      return accessToken;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error("An unknown error occurred");
      }
      clearAuthFromLocalStorage();
      fetchAuthorizationCode(config)();
    }
  };

async function fetchAccessTokenWithAuthCode(authCode: string): Promise<void> {
  try {
    const { accessToken, expiryTimestamp, refreshToken, scopeId } =
      await fetchJSON(`./access-token?code=${authCode}`);

    saveInformationToLocalStorage({
      accessToken,
      refreshToken,
      expiryTimestamp,
      scopeId,
    });
    //redirect to data page
    const addOnQuery = new URL(
      window.location as unknown as string | URL,
    ).searchParams.get("state");
    const decoded = decodeURIComponent(addOnQuery as string);
    location.href = "/" + (addOnQuery || "");
  } catch (error) {
    //handle error properly.
    console.error(error);
    // location.href = '/error.html';
  }
}

const fetchAccessibleResources = (config: Config) => () => {
  return config.requestHelper(
    `https://api.atlassian.com/oauth/token/accessible-resources`,
  );
};

const fetchJiraSprint = (config: Config) => (sprintId: string) => {
  return config.requestHelper(`/agile/1.0/sprint/${sprintId}`);
};

const fetchJiraIssue = (config: Config) => (issueId: string) => {
  return config.requestHelper(`/api/3/issue/${issueId}`);
};

const fieldsToEditBody = (
  obj: Record<string, any>,
  fieldMapping: { nameMap: Record<string, string> },
) => {
  const editBody: {
    fields: Record<string, any>;
    update: Record<string, { set: any }[]>;
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

const editJiraIssueWithNamedFields =
  (config: Config) => async (issueId: string, fields: Record<string, any>) => {
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
      },
    ).then(responseToText);
  };

const fetchJiraIssuesWithJQL =
  (config: Config) => (params: FetchJiraIssuesParams) => {
    // TODO - investigate this and convert params to proper type
    return config.requestHelper(
      `/api/3/search?` + new URLSearchParams(JiraIssueParamsToParams(params)),
    );
  };

const fieldsRequest = (config: Config) => () => {
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

const fetchJiraIssuesWithJQLWithNamedFields =
  (config: Config) => async (params: FetchJiraIssuesParams) => {
    const fields = await fieldsRequest(config)();

    if (!fields) return;

    const newParams = {
      ...params,
      fields: params.fields?.map((f) =>
        f in fields.nameMap ? fields.nameMap[f] : f,
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

const fetchAllJiraIssuesWithJQL =
  (config: Config) => async (params: FetchJiraIssuesParams) => {
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
        }),
      );
    }
    return Promise.all(requests).then((responses) => {
      return responses.map((response) => response.issues).flat();
    });
  };

const fetchAllJiraIssuesWithJQLUsingNamedFields =
  (config: Config) => async (params: FetchJiraIssuesParams) => {
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

const JiraIssueParamsToParams = (
  params: FetchJiraIssuesParams,
): Record<string, string> => {
  const formattedParams: Record<string, string> = {};
  if (params.jql) formattedParams.jql = params.jql;
  if (params.startAt) formattedParams.startAt = params.startAt.toString();
  if (params.maxResults)
    formattedParams.maxResults = params.maxResults.toString();
  if (params.fields) formattedParams.fields = params.fields.join(",");
  return formattedParams;
};

const fetchJiraChangelog =
  (config: Config) => (issueIdOrKey: string, params: FetchJiraIssuesParams) => {
    // TODO investigate this - convert params to proper type
    return config.requestHelper(
      `/api/3/issue/${issueIdOrKey}/changelog?` +
        new URLSearchParams(JiraIssueParamsToParams(params)),
    );
  };

const isChangelogComplete = (changelog: {
  histories: any[];
  total: number;
}): boolean => {
  return changelog.histories.length === changelog.total;
};

const fetchRemainingChangelogsForIssues =
  (config: Config) =>
  (
    issues: JiraIssue[],
    progress: {
      data?: ProgressData;
      (data: ProgressData): void;
    } = () => {},
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
            issue.changelog,
          ).then((histories) => {
            return {
              ...issue,
              changelog: issue.changelog.histories,
            };
          });
        }
      }),
    );
  };

// weirdly, this starts with the oldest, but we got the most recent
// returns an array of histories objects
const fetchRemainingChangelogsForIssue =
  (config: Config) =>
  async (
    issueIdOrKey: string,
    mostRecentChangeLog: {
      histories: { id: string; change: string }[];
      maxResults: number;
      total: number;
      startAt: number;
    },
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
        }),
      );
    }
    // server sends back as "values", we match that

    const responses = await Promise.all(requests);
    const response_2 = responses.map((response_1) => response_1.values).flat();
    return response_2;
  };

const fetchAllJiraIssuesWithJQLAndFetchAllChangelog =
  (config: Config) =>
  (
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
    } = () => {},
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
        progress,
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
          }).then(getRemainingChangeLogsForIssues),
        );
      }
      return Promise.all(requests).then((responses) => {
        return responses.flat();
      });
    });
  };

// this could do each response incrementally, but I'm being lazy
const fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields =
  (config: Config) =>
  async (
    params: { fields: string[]; [key: string]: any },
    progress: (data: ProgressData) => void = () => {},
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
      config,
    )(newParams, progress);

    return response.map((issue) => {
      return {
        ...issue,
        fields: mapIdsToNames(issue.fields, fields),
      };
    });
    // change the parms
  };

const fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields =
  async (
    params: { fields: string[]; [key: string]: any },
    progress: {
      data?: ProgressData;
      (data: ProgressData): void;
    } = () => {},
  ) => {
    console.warn("THIS METHOD SHOULD BE IMPOSSIBLE TO CALL");
    return Promise.resolve(null as any);
  };

const fetchChildrenResponses =
  (config: Config) =>
  (
    params: { fields: string[]; [key: string]: any },
    parentIssues: Issue[],
    progress: (data: ProgressData) => void = () => {},
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
        progress,
      );
    });
    // this needs to be flattened
    return batchedResponses;
  };

// Makes child requests in batches of 40
//
// params - base params
// sourceParentIssues - the source of parent issues
const fetchDeepChildren =
  (config: Config) =>
  (
    params: { fields: string[]; [key: string]: any },
    sourceParentIssues: Issue[],
    progress: (data: ProgressData) => void = () => {},
  ): Promise<Issue[]> => {
    const batchedFirstResponses = fetchChildrenResponses(config)(
      params,
      sourceParentIssues,
      progress,
    );

    const getChildren = (parentIssues: Issue[]) => {
      if (parentIssues.length) {
        return fetchDeepChildren(config)(params, parentIssues, progress).then(
          (deepChildrenIssues) => {
            return parentIssues.concat(deepChildrenIssues);
          },
        );
      } else {
        return parentIssues;
      }
    };

    const batchedIssueRequests = batchedFirstResponses.map(
      (firstBatchPromise) => {
        return firstBatchPromise.then(getChildren);
      },
    );

    return Promise.all(batchedIssueRequests).then((allChildren) => {
      return allChildren.flat();
    });
  };

const fetchJiraFields = (config: Config) => () => {
  return config.requestHelper(`/api/3/field`);
};

const getAccessToken = (config: Config) => async () => {
  if (!hasValidAccessToken()) {
    const refreshToken = fetchFromLocalStorage("refreshToken");
    if (!refreshToken) {
      fetchAuthorizationCode(config)();
    } else {
      return refreshAccessToken(config)();
    }
  } else {
    return fetchFromLocalStorage("accessToken");
  }
};

const hasAccessToken = (): boolean => {
  return !!fetchFromLocalStorage("accessToken");
};

const hasValidAccessToken = (): boolean => {
  const accessToken = fetchFromLocalStorage("accessToken");
  let expiryTimestamp = Number(fetchFromLocalStorage("expiryTimestamp"));
  if (isNaN(expiryTimestamp)) {
    expiryTimestamp = 0;
  }
  const currentTimestamp = Math.floor(new Date().getTime() / 1000.0);
  return !(currentTimestamp > expiryTimestamp || !accessToken);
};

const _cachedServerInfoPromise = (config: Config) => () => {
  return config.requestHelper("/api/3/serverInfo");
};

const getServerInfo =
  (config: Config) => (): Promise<RequestHelperResponse> => {
    // if(this._cachedServerInfoPromise) {
    // 	return this._cachedServerInfoPromise;
    // }
    // // https://your-domain.atlassian.net/rest/api/3/serverInfo

    // return this._cachedServerInfoPromise( = config.requestHelper('/api/3/serverInfo'));
    return _cachedServerInfoPromise(config)();
  };

type Config = {
  env: {
    JIRA_CLIENT_ID: string;
    JIRA_SCOPE: string;
    JIRA_CALLBACK_URL: string;
    JIRA_API_URL: string;
  };
  requestHelper: RequestHelper;
  host: "jira" | "hosted";
};

const createJiraHelpers = (
  { JIRA_CLIENT_ID, JIRA_SCOPE, JIRA_CALLBACK_URL, JIRA_API_URL } = window.env,
  requestHelper: (urlFragment: string) => Promise<RequestHelperResponse>,
  host: "jira" | "hosted",
) => {
  const config: Config = {
    env: { JIRA_CLIENT_ID, JIRA_SCOPE, JIRA_CALLBACK_URL, JIRA_API_URL },
    requestHelper,
    host,
  };
  return {
    saveInformationToLocalStorage,
    clearAuthFromLocalStorage,
    fetchFromLocalStorage,
    fetchAuthorizationCode: fetchAuthorizationCode(config),
    refreshAccessToken: refreshAccessToken(config),
    fetchAccessTokenWithAuthCode,
    fetchAccessibleResources: fetchAccessibleResources(config),
    fetchJiraSprint: fetchJiraSprint(config),
    fetchJiraIssue: fetchJiraIssue(config),
    fieldsToEditBody,
    editJiraIssueWithNamedFields: editJiraIssueWithNamedFields(config),
    fetchJiraIssuesWithJQL: fetchJiraIssuesWithJQL(config),
    fieldsRequest: fieldsRequest(config),
    fetchJiraIssuesWithJQLWithNamedFields:
      fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(config),
    fetchAllJiraIssuesWithJQL: fetchAllJiraIssuesWithJQL(config),
    fetchAllJiraIssuesWithJQLUsingNamedFields:
      fetchAllJiraIssuesWithJQLUsingNamedFields(config),
    JiraIssueParamsToParams,
    fetchJiraChangelog: fetchJiraChangelog(config),
    isChangelogComplete,
    fetchRemainingChangelogsForIssues:
      fetchRemainingChangelogsForIssues(config),
    fetchRemainingChangelogsForIssue,
    fetchAllJiraIssuesWithJQLAndFetchAllChangelog:
      fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config),
    fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields:
      fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(config),
    fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields,
    fetchChildrenResponses: fetchChildrenResponses(config),
    fetchDeepChildren: fetchDeepChildren(config),
    fetchJiraFields: fetchJiraFields(config),
    getAccessToken: getAccessToken(config),
    hasAccessToken,
    hasValidAccessToken,
    getServerInfo: getServerInfo(config),
  };
};

export default createJiraHelpers;
