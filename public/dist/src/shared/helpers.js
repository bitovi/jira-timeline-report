var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import chunkArray from "./chunk-array";
import fetchJSON from "./fetch";
import mapIdsToNames from "./map-ids-to-names";
import responseToText from "./response-to-text";
function saveInformationToLocalStorage(parameters) {
    var objectKeys = Object.keys(parameters);
    for (var _i = 0, objectKeys_1 = objectKeys; _i < objectKeys_1.length; _i++) {
        var key = objectKeys_1[_i];
        var value = parameters[key];
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
var fetchAuthorizationCode = function (config) { return function () {
    var url = "https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=".concat(config.env.JIRA_CLIENT_ID, "&scope=").concat(config.env.JIRA_SCOPE, "&redirect_uri=").concat(config.env.JIRA_CALLBACK_URL, "&response_type=code&prompt=consent&state=").concat(encodeURIComponent(encodeURIComponent(window.location.search)));
    window.location.href = url;
}; };
var refreshAccessToken = function (config) {
    return function (accessCode) { return __awaiter(void 0, void 0, void 0, function () {
        var response, _a, accessToken, expiryTimestamp, refreshToken, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fetchJSON("".concat(config.env.JIRA_API_URL, "/?code=").concat(accessCode))];
                case 1:
                    response = _b.sent();
                    _a = response.data, accessToken = _a.accessToken, expiryTimestamp = _a.expiryTimestamp, refreshToken = _a.refreshToken;
                    saveInformationToLocalStorage({
                        accessToken: accessToken,
                        refreshToken: refreshToken,
                        expiryTimestamp: expiryTimestamp,
                    });
                    return [2 /*return*/, accessToken];
                case 2:
                    error_1 = _b.sent();
                    if (error_1 instanceof Error) {
                        console.error(error_1.message);
                    }
                    else {
                        console.error("An unknown error occurred");
                    }
                    clearAuthFromLocalStorage();
                    fetchAuthorizationCode(config)();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
};
function fetchAccessTokenWithAuthCode(authCode) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, accessToken, expiryTimestamp, refreshToken, scopeId, addOnQuery, decoded, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fetchJSON("./access-token?code=".concat(authCode))];
                case 1:
                    _a = _b.sent(), accessToken = _a.accessToken, expiryTimestamp = _a.expiryTimestamp, refreshToken = _a.refreshToken, scopeId = _a.scopeId;
                    saveInformationToLocalStorage({
                        accessToken: accessToken,
                        refreshToken: refreshToken,
                        expiryTimestamp: expiryTimestamp,
                        scopeId: scopeId,
                    });
                    addOnQuery = new URL(window.location).searchParams.get("state");
                    decoded = decodeURIComponent(addOnQuery);
                    location.href = "/" + (addOnQuery || "");
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _b.sent();
                    //handle error properly.
                    console.error(error_2);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
var fetchAccessibleResources = function (config) { return function () {
    return config.requestHelper("https://api.atlassian.com/oauth/token/accessible-resources");
}; };
var fetchJiraSprint = function (config) { return function (sprintId) {
    return config.requestHelper("/agile/1.0/sprint/".concat(sprintId));
}; };
var fetchJiraIssue = function (config) { return function (issueId) {
    return config.requestHelper("/api/3/issue/".concat(issueId));
}; };
var fieldsToEditBody = function (obj, fieldMapping) {
    var editBody = { fields: {}, update: {} };
    for (var prop in obj) {
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
var editJiraIssueWithNamedFields = function (config) { return function (issueId, fields) { return __awaiter(void 0, void 0, void 0, function () {
    var scopeIdForJira, accessToken, fieldMapping, editBody;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                scopeIdForJira = fetchFromLocalStorage("scopeId");
                accessToken = fetchFromLocalStorage("accessToken");
                return [4 /*yield*/, fieldsRequest(config)()];
            case 1:
                fieldMapping = _a.sent();
                if (!fieldMapping)
                    return [2 /*return*/];
                editBody = fieldsToEditBody(fields, fieldMapping);
                //const fieldsWithIds = mapNamesToIds(fields || {}, fieldMapping),
                //	updateWithIds = mapNamesToIds(update || {}, fieldMapping);
                return [2 /*return*/, fetch("".concat(config.env.JIRA_API_URL, "/").concat(scopeIdForJira, "/rest/api/3/issue/").concat(issueId, "?") +
                        "" /*new URLSearchParams(params)*/, {
                        method: "PUT",
                        headers: {
                            Authorization: "Bearer ".concat(accessToken),
                            Accept: "application/json",
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(editBody),
                    }).then(responseToText)];
        }
    });
}); }; };
var fetchJiraIssuesWithJQL = function (config) { return function (params) {
    // TODO - investigate this and convert params to proper type
    return config.requestHelper("/api/3/search?" + new URLSearchParams(JiraIssueParamsToParams(params)));
}; };
var fieldsRequest = function (config) { return function () {
    if (config.host === "jira" || hasValidAccessToken()) {
        return fetchJiraFields(config)().then(function (fields) {
            var nameMap = {};
            var idMap = {};
            // @ts-ignore
            fields.forEach(function (f) {
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
}; };
var fetchJiraIssuesWithJQLWithNamedFields = function (config) { return function (params) { return __awaiter(void 0, void 0, void 0, function () {
    var fields, newParams, response;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, fieldsRequest(config)()];
            case 1:
                fields = _b.sent();
                if (!fields)
                    return [2 /*return*/];
                newParams = __assign(__assign({}, params), { fields: (_a = params.fields) === null || _a === void 0 ? void 0 : _a.map(function (f) {
                        return f in fields.nameMap ? fields.nameMap[f] : f;
                    }) });
                return [4 /*yield*/, fetchJiraIssuesWithJQL(config)(newParams)];
            case 2:
                response = _b.sent();
                return [2 /*return*/, response.issues.map(function (issue) {
                        return __assign(__assign({}, issue), { fields: mapIdsToNames(issue.fields, fields) });
                    })];
        }
    });
}); }; };
var fetchAllJiraIssuesWithJQL = function (config) { return function (params) { return __awaiter(void 0, void 0, void 0, function () {
    var limit, apiParams, firstRequest, _a, issues, maxResults, total, startAt, requests, limitOrTotal, i;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                limit = params.limit, apiParams = __rest(params, ["limit"]);
                firstRequest = fetchJiraIssuesWithJQL(config)(__assign({ maxResults: 100 }, apiParams));
                return [4 /*yield*/, firstRequest];
            case 1:
                _a = _b.sent(), issues = _a.issues, maxResults = _a.maxResults, total = _a.total, startAt = _a.startAt;
                requests = [firstRequest];
                limitOrTotal = Math.min(total, limit || Infinity);
                for (i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
                    requests.push(fetchJiraIssuesWithJQL(config)(__assign({ maxResults: maxResults, startAt: i }, apiParams)));
                }
                return [2 /*return*/, Promise.all(requests).then(function (responses) {
                        return responses.map(function (response) { return response.issues; }).flat();
                    })];
        }
    });
}); }; };
var fetchAllJiraIssuesWithJQLUsingNamedFields = function (config) { return function (params) { return __awaiter(void 0, void 0, void 0, function () {
    var fields, newParams, response;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, fieldsRequest(config)()];
            case 1:
                fields = _b.sent();
                if (!fields)
                    return [2 /*return*/];
                newParams = __assign(__assign({}, params), { fields: (_a = params.fields) === null || _a === void 0 ? void 0 : _a.map(function (f) { return fields.nameMap[f] || f; }) });
                return [4 /*yield*/, fetchAllJiraIssuesWithJQL(config)(newParams)];
            case 2:
                response = _b.sent();
                return [2 /*return*/, response.map(function (issue) {
                        return __assign(__assign({}, issue), { fields: mapIdsToNames(issue.fields, fields) });
                    })];
        }
    });
}); }; };
var JiraIssueParamsToParams = function (params) {
    var formattedParams = {};
    if (params.jql)
        formattedParams.jql = params.jql;
    if (params.startAt)
        formattedParams.startAt = params.startAt.toString();
    if (params.maxResults)
        formattedParams.maxResults = params.maxResults.toString();
    if (params.fields)
        formattedParams.fields = params.fields.join(",");
    return formattedParams;
};
var fetchJiraChangelog = function (config) { return function (issueIdOrKey, params) {
    // TODO investigate this - convert params to proper type
    return config.requestHelper("/api/3/issue/".concat(issueIdOrKey, "/changelog?") +
        new URLSearchParams(JiraIssueParamsToParams(params)));
}; };
var isChangelogComplete = function (changelog) {
    return changelog.histories.length === changelog.total;
};
var fetchRemainingChangelogsForIssues = function (config) {
    return function (issues, progress) {
        if (progress === void 0) { progress = function () { }; }
        // check for remainings
        return Promise.all(issues.map(function (issue) {
            if (isChangelogComplete(issue.changelog)) {
                return __assign(__assign({}, issue), { changelog: issue.changelog.histories });
            }
            else {
                return fetchRemainingChangelogsForIssue(config)(issue.key, issue.changelog).then(function (histories) {
                    return __assign(__assign({}, issue), { changelog: issue.changelog.histories });
                });
            }
        }));
    };
};
// weirdly, this starts with the oldest, but we got the most recent
// returns an array of histories objects
var fetchRemainingChangelogsForIssue = function (config) {
    return function (issueIdOrKey, mostRecentChangeLog) { return __awaiter(void 0, void 0, void 0, function () {
        var histories, maxResults, total, startAt, requests, i, responses, response_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    histories = mostRecentChangeLog.histories, maxResults = mostRecentChangeLog.maxResults, total = mostRecentChangeLog.total, startAt = mostRecentChangeLog.startAt;
                    requests = [];
                    requests.push({ values: mostRecentChangeLog.histories });
                    for (i = 0; i < total - maxResults; i += maxResults) {
                        requests.push(fetchJiraChangelog(config)(issueIdOrKey, {
                            maxResults: Math.min(maxResults, total - maxResults - i),
                            startAt: i,
                        }).then(function (response) {
                            // the query above reverses the sort order, we fix that here
                            return __assign(__assign({}, response), { values: response.values.reverse() });
                        }));
                    }
                    return [4 /*yield*/, Promise.all(requests)];
                case 1:
                    responses = _a.sent();
                    response_2 = responses.map(function (response_1) { return response_1.values; }).flat();
                    return [2 /*return*/, response_2];
            }
        });
    }); };
};
var fetchAllJiraIssuesWithJQLAndFetchAllChangelog = function (config) {
    return function (params, progress) {
        if (progress === void 0) { progress = function () { }; }
        var limit = params.limit, apiParams = __rest(params, ["limit"]);
        // a weak map would be better
        progress.data =
            progress.data ||
                {
                    issuesRequested: 0,
                    issuesReceived: 0,
                    changeLogsRequested: 0,
                    changeLogsReceived: 0,
                };
        function getRemainingChangeLogsForIssues(response) {
            if (progress.data) {
                Object.assign(progress.data, {
                    issuesReceived: progress.data.issuesReceived + response.issues.length,
                });
                progress(progress.data);
            }
            return fetchRemainingChangelogsForIssues(config)(response.issues, progress);
        }
        var firstRequest = fetchJiraIssuesWithJQL(config)(__assign({ maxResults: 100, expand: ["changelog"] }, apiParams));
        return firstRequest.then(function (_a) {
            var issues = _a.issues, maxResults = _a.maxResults, total = _a.total, startAt = _a.startAt;
            if (progress.data) {
                Object.assign(progress.data, {
                    issuesRequested: progress.data.issuesRequested + total,
                    changeLogsRequested: 0,
                    changeLogsReceived: 0,
                });
                progress(progress.data);
            }
            var requests = [firstRequest.then(getRemainingChangeLogsForIssues)];
            var limitOrTotal = Math.min(total, limit || Infinity);
            for (var i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
                requests.push(fetchJiraIssuesWithJQL(config)(__assign({ maxResults: maxResults, startAt: i }, apiParams)).then(getRemainingChangeLogsForIssues));
            }
            return Promise.all(requests).then(function (responses) {
                return responses.flat();
            });
        });
    };
};
// this could do each response incrementally, but I'm being lazy
var fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields = function (config) {
    return function (params_1) {
        var args_1 = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args_1[_i - 1] = arguments[_i];
        }
        return __awaiter(void 0, __spreadArray([params_1], args_1, true), void 0, function (params, progress) {
            var fields, newParams, response;
            if (progress === void 0) { progress = function () { }; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fieldsRequest(config)()];
                    case 1:
                        fields = _a.sent();
                        if (!fields) {
                            return [2 /*return*/, Promise.resolve(null)];
                        }
                        newParams = __assign(__assign({}, params), { fields: params.fields.map(function (f) { return (fields === null || fields === void 0 ? void 0 : fields.nameMap[f]) || f; }) });
                        return [4 /*yield*/, fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config)(newParams, progress)];
                    case 2:
                        response = _a.sent();
                        return [2 /*return*/, response.map(function (issue) {
                                return __assign(__assign({}, issue), { fields: mapIdsToNames(issue.fields, fields) });
                            })];
                }
            });
        });
    };
};
var fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields = function (params_1) {
    var args_1 = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args_1[_i - 1] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([params_1], args_1, true), void 0, function (params, progress) {
        if (progress === void 0) { progress = function () { }; }
        return __generator(this, function (_a) {
            console.warn("THIS METHOD SHOULD BE IMPOSSIBLE TO CALL");
            return [2 /*return*/, Promise.resolve(null)];
        });
    });
};
var fetchChildrenResponses = function (config) {
    return function (params, parentIssues, progress) {
        if (progress === void 0) { progress = function () { }; }
        var issuesToQuery = chunkArray(parentIssues, 40);
        var batchedResponses = issuesToQuery.map(function (issues) {
            var keys = issues.map(function (issue) { return issue.key; });
            var jql = "parent in (".concat(keys.join(", "), ")");
            return fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config)(__assign(__assign({}, params), { jql: jql }), progress);
        });
        // this needs to be flattened
        return batchedResponses;
    };
};
// Makes child requests in batches of 40
//
// params - base params
// sourceParentIssues - the source of parent issues
var fetchDeepChildren = function (config) {
    return function (params, sourceParentIssues, progress) {
        if (progress === void 0) { progress = function () { }; }
        var batchedFirstResponses = fetchChildrenResponses(config)(params, sourceParentIssues, progress);
        var getChildren = function (parentIssues) {
            if (parentIssues.length) {
                return fetchDeepChildren(config)(params, parentIssues, progress).then(function (deepChildrenIssues) {
                    return parentIssues.concat(deepChildrenIssues);
                });
            }
            else {
                return parentIssues;
            }
        };
        var batchedIssueRequests = batchedFirstResponses.map(function (firstBatchPromise) {
            return firstBatchPromise.then(getChildren);
        });
        return Promise.all(batchedIssueRequests).then(function (allChildren) {
            return allChildren.flat();
        });
    };
};
var fetchJiraFields = function (config) { return function () {
    return config.requestHelper("/api/3/field");
}; };
var getAccessToken = function (config) { return function () { return __awaiter(void 0, void 0, void 0, function () {
    var refreshToken;
    return __generator(this, function (_a) {
        if (!hasValidAccessToken()) {
            refreshToken = fetchFromLocalStorage("refreshToken");
            if (!refreshToken) {
                fetchAuthorizationCode(config)();
            }
            else {
                return [2 /*return*/, refreshAccessToken(config)()];
            }
        }
        else {
            return [2 /*return*/, fetchFromLocalStorage("accessToken")];
        }
        return [2 /*return*/];
    });
}); }; };
var hasAccessToken = function () {
    return !!fetchFromLocalStorage("accessToken");
};
var hasValidAccessToken = function () {
    var accessToken = fetchFromLocalStorage("accessToken");
    var expiryTimestamp = Number(fetchFromLocalStorage("expiryTimestamp"));
    if (isNaN(expiryTimestamp)) {
        expiryTimestamp = 0;
    }
    var currentTimestamp = Math.floor(new Date().getTime() / 1000.0);
    return !(currentTimestamp > expiryTimestamp || !accessToken);
};
var _cachedServerInfoPromise = function (config) { return function () {
    return config.requestHelper("/api/3/serverInfo");
}; };
var getServerInfo = function (config) { return function () {
    // if(this._cachedServerInfoPromise) {
    // 	return this._cachedServerInfoPromise;
    // }
    // // https://your-domain.atlassian.net/rest/api/3/serverInfo
    // return this._cachedServerInfoPromise( = config.requestHelper('/api/3/serverInfo'));
    return _cachedServerInfoPromise(config)();
}; };
var createJiraHelpers = function (_a, requestHelper, host) {
    var _b = _a === void 0 ? window.env : _a, JIRA_CLIENT_ID = _b.JIRA_CLIENT_ID, JIRA_SCOPE = _b.JIRA_SCOPE, JIRA_CALLBACK_URL = _b.JIRA_CALLBACK_URL, JIRA_API_URL = _b.JIRA_API_URL;
    var config = {
        env: { JIRA_CLIENT_ID: JIRA_CLIENT_ID, JIRA_SCOPE: JIRA_SCOPE, JIRA_CALLBACK_URL: JIRA_CALLBACK_URL, JIRA_API_URL: JIRA_API_URL },
        requestHelper: requestHelper,
        host: host,
    };
    return {
        saveInformationToLocalStorage: saveInformationToLocalStorage,
        clearAuthFromLocalStorage: clearAuthFromLocalStorage,
        fetchFromLocalStorage: fetchFromLocalStorage,
        fetchAuthorizationCode: fetchAuthorizationCode(config),
        refreshAccessToken: refreshAccessToken(config),
        fetchAccessTokenWithAuthCode: fetchAccessTokenWithAuthCode,
        fetchAccessibleResources: fetchAccessibleResources(config),
        fetchJiraSprint: fetchJiraSprint(config),
        fetchJiraIssue: fetchJiraIssue(config),
        fieldsToEditBody: fieldsToEditBody,
        editJiraIssueWithNamedFields: editJiraIssueWithNamedFields(config),
        fetchJiraIssuesWithJQL: fetchJiraIssuesWithJQL(config),
        fieldsRequest: fieldsRequest(config),
        fetchJiraIssuesWithJQLWithNamedFields: fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(config),
        fetchAllJiraIssuesWithJQL: fetchAllJiraIssuesWithJQL(config),
        fetchAllJiraIssuesWithJQLUsingNamedFields: fetchAllJiraIssuesWithJQLUsingNamedFields(config),
        JiraIssueParamsToParams: JiraIssueParamsToParams,
        fetchJiraChangelog: fetchJiraChangelog(config),
        isChangelogComplete: isChangelogComplete,
        fetchRemainingChangelogsForIssues: fetchRemainingChangelogsForIssues(config),
        fetchRemainingChangelogsForIssue: fetchRemainingChangelogsForIssue,
        fetchAllJiraIssuesWithJQLAndFetchAllChangelog: fetchAllJiraIssuesWithJQLAndFetchAllChangelog(config),
        fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields(config),
        fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields,
        fetchChildrenResponses: fetchChildrenResponses(config),
        fetchDeepChildren: fetchDeepChildren(config),
        fetchJiraFields: fetchJiraFields(config),
        getAccessToken: getAccessToken(config),
        hasAccessToken: hasAccessToken,
        hasValidAccessToken: hasValidAccessToken,
        getServerInfo: getServerInfo(config),
    };
};
export default createJiraHelpers;
//# sourceMappingURL=helpers.js.map