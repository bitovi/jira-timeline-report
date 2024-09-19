/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */


var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
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
}

function __values(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

function responseToJSON(response) {
    if (!response.ok) {
        return response.json().then(function (payload) {
            var err = new Error("HTTP status code: " + response.status);
            Object.assign(err, payload);
            Object.assign(err, response);
            throw err;
        });
    }
    return response.json();
}

function responseToText(response) {
    if (!response.ok) {
        return response.json().then(function (payload) {
            var err = new Error("HTTP status code: " + response.status);
            Object.assign(err, payload);
            Object.assign(err, response);
            throw err;
        });
    }
    return response.text();
}
function nativeFetchJSON(url, options) {
    return fetch(url, options).then(responseToJSON);
}
function chunkArray(array, size) {
    var chunkedArr = [];
    for (var i = 0; i < array.length; i += size) {
        chunkedArr.push(array.slice(i, i + size));
    }
    return chunkedArr;
}
function jiraOIDCHelpers (_a, requestHelper, host) {
    var _this = this;
    var _b = _a === void 0 ? window.env : _a, JIRA_CLIENT_ID = _b.JIRA_CLIENT_ID, JIRA_SCOPE = _b.JIRA_SCOPE, JIRA_CALLBACK_URL = _b.JIRA_CALLBACK_URL, JIRA_API_URL = _b.JIRA_API_URL;
    var fetchJSON = nativeFetchJSON;
    var fieldsRequest;
    function makeDeepChildrenLoaderUsingNamedFields(rootMethod) {
        // Makes child requests in batches of 40
        // 
        // params - base params
        // sourceParentIssues - the source of parent issues
        function fetchChildrenResponses(params, parentIssues, progress) {
            var issuesToQuery = chunkArray(parentIssues, 40);
            var batchedResponses = issuesToQuery.map(function (issues) {
                var keys = issues.map(function (issue) { return issue.key; });
                var jql = "parent in (".concat(keys.join(", "), ") ").concat(params.childJQL || "");
                return rootMethod(__assign(__assign({}, params), { jql: jql }), progress);
            });
            // this needs to be flattened
            return batchedResponses;
        }
        function fetchDeepChildren(params, sourceParentIssues, progress) {
            return __awaiter(this, void 0, void 0, function () {
                var batchedFirstResponses, getChildren, batchedIssueRequests, allChildren;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            batchedFirstResponses = fetchChildrenResponses(params, sourceParentIssues, progress);
                            getChildren = function (parentIssues) {
                                if (parentIssues.length) {
                                    return fetchDeepChildren(params, parentIssues, progress).then(function (deepChildrenIssues) {
                                        return parentIssues.concat(deepChildrenIssues);
                                    });
                                }
                                else {
                                    return parentIssues;
                                }
                            };
                            batchedIssueRequests = batchedFirstResponses.map(function (firstBatchPromise) {
                                return firstBatchPromise.then(getChildren);
                            });
                            return [4 /*yield*/, Promise.all(batchedIssueRequests)];
                        case 1:
                            allChildren = _a.sent();
                            return [2 /*return*/, allChildren.flat()];
                    }
                });
            });
        }
        return function fetchAllDeepChildren(params_1) {
            return __awaiter(this, arguments, void 0, function (params, progress) {
                var fields, newParams, parentIssues, allChildrenIssues, combined;
                var _a;
                if (progress === void 0) { progress = {}; }
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, fieldsRequest];
                        case 1:
                            fields = _b.sent();
                            newParams = __assign(__assign({}, params), { fields: (_a = params.fields) === null || _a === void 0 ? void 0 : _a.map(function (f) { return fields.nameMap[f] || f; }) });
                            progress.data = progress.data || {
                                issuesRequested: 0,
                                issuesReceived: 0,
                                changeLogsRequested: 0,
                                changeLogsReceived: 0
                            };
                            return [4 /*yield*/, rootMethod(newParams, progress)];
                        case 2:
                            parentIssues = _b.sent();
                            return [4 /*yield*/, fetchDeepChildren(newParams, parentIssues, progress)];
                        case 3:
                            allChildrenIssues = _b.sent();
                            combined = parentIssues.concat(allChildrenIssues);
                            return [2 /*return*/, combined.map(function (issue) {
                                    return __assign(__assign({}, issue), { fields: mapIdsToNames(issue.fields, fields) });
                                })];
                    }
                });
            });
        };
    }
    var jiraHelpers = {
        saveInformationToLocalStorage: function (parameters) {
            var e_1, _a;
            var objectKeys = Object.keys(parameters);
            try {
                for (var objectKeys_1 = __values(objectKeys), objectKeys_1_1 = objectKeys_1.next(); !objectKeys_1_1.done; objectKeys_1_1 = objectKeys_1.next()) {
                    var key = objectKeys_1_1.value;
                    window.localStorage.setItem(key, parameters[key]);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (objectKeys_1_1 && !objectKeys_1_1.done && (_a = objectKeys_1.return)) _a.call(objectKeys_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        },
        clearAuthFromLocalStorage: function () {
            window.localStorage.removeItem("accessToken");
            window.localStorage.removeItem("refreshToken");
            window.localStorage.removeItem("expiryTimestamp");
        },
        fetchFromLocalStorage: function (key) {
            return window.localStorage.getItem(key);
        },
        fetchAuthorizationCode: function () {
            var url = "https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=".concat(JIRA_CLIENT_ID, "&scope=").concat(JIRA_SCOPE, "&redirect_uri=").concat(JIRA_CALLBACK_URL, "&response_type=code&prompt=consent&state=").concat(encodeURIComponent(encodeURIComponent(window.location.search)));
            window.location.href = url;
        },
        refreshAccessToken: function (accessCode) { return __awaiter(_this, void 0, void 0, function () {
            var response, _a, accessToken, expiryTimestamp, refreshToken, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fetchJSON("".concat(window.env.JIRA_API_URL, "/?code=").concat(accessCode))];
                    case 1:
                        response = _b.sent();
                        _a = response.data, accessToken = _a.accessToken, expiryTimestamp = _a.expiryTimestamp, refreshToken = _a.refreshToken;
                        jiraHelpers.saveInformationToLocalStorage({
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
                            console.error('An unknown error occurred');
                        }
                        jiraHelpers.clearAuthFromLocalStorage();
                        jiraHelpers.fetchAuthorizationCode();
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); },
        fetchAccessTokenWithAuthCode: function (authCode) { return __awaiter(_this, void 0, void 0, function () {
            var _a, accessToken, expiryTimestamp, refreshToken, scopeId, addOnQuery, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fetchJSON("./access-token?code=".concat(authCode))];
                    case 1:
                        _a = _b.sent(), accessToken = _a.accessToken, expiryTimestamp = _a.expiryTimestamp, refreshToken = _a.refreshToken, scopeId = _a.scopeId;
                        jiraHelpers.saveInformationToLocalStorage({
                            accessToken: accessToken,
                            refreshToken: refreshToken,
                            expiryTimestamp: expiryTimestamp,
                            scopeId: scopeId,
                        });
                        addOnQuery = new URL(window.location).searchParams.get("state");
                        location.href = '/' + (addOnQuery || "");
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _b.sent();
                        //handle error properly.
                        console.error(error_2);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); },
        fetchAccessibleResources: function () {
            return requestHelper("https://api.atlassian.com/oauth/token/accessible-resources");
        },
        fetchJiraSprint: function (sprintId) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, requestHelper("/agile/1.0/sprint/".concat(sprintId))];
            });
        }); },
        fetchJiraIssue: function (issueId) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, requestHelper("/api/3/issue/".concat(issueId))];
            });
        }); },
        editJiraIssueWithNamedFields: function (issueId, fields) { return __awaiter(_this, void 0, void 0, function () {
            var scopeIdForJira, accessToken, fieldMapping, editBody;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        scopeIdForJira = jiraHelpers.fetchFromLocalStorage('scopeId');
                        accessToken = jiraHelpers.fetchFromLocalStorage('accessToken');
                        return [4 /*yield*/, fieldsRequest];
                    case 1:
                        fieldMapping = _a.sent();
                        editBody = fieldsToEditBody(fields, fieldMapping);
                        //const fieldsWithIds = mapNamesToIds(fields || {}, fieldMapping),
                        //	updateWithIds = mapNamesToIds(update || {}, fieldMapping);
                        return [2 /*return*/, fetch("".concat(JIRA_API_URL, "/").concat(scopeIdForJira, "/rest/api/3/issue/").concat(issueId, "?") +
                                "" /*new URLSearchParams(params)*/, {
                                method: 'PUT',
                                headers: {
                                    'Authorization': "Bearer ".concat(accessToken),
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify(editBody)
                            }).then(responseToText)];
                }
            });
        }); },
        fetchJiraIssuesWithJQL: function (params) {
            // TODO - investigate this and convert params to proper type
            return requestHelper("/api/3/search?" + new URLSearchParams(params));
        },
        fetchJiraIssuesWithJQLWithNamedFields: function (params) {
            return __awaiter(this, void 0, void 0, function () {
                var fields, newParams, response;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, fieldsRequest];
                        case 1:
                            fields = _b.sent();
                            newParams = __assign(__assign({}, params), { fields: (_a = params.fields) === null || _a === void 0 ? void 0 : _a.map(function (f) { return fields.nameMap[f] || f; }) });
                            return [4 /*yield*/, jiraHelpers.fetchJiraIssuesWithJQL(newParams)];
                        case 2:
                            response = _b.sent();
                            return [2 /*return*/, response.issues.map(function (issue) {
                                    return __assign(__assign({}, issue), { fields: mapIdsToNames(issue.fields, fields) });
                                })];
                    }
                });
            });
        },
        fetchAllJiraIssuesWithJQL: function (params) {
            return __awaiter(this, void 0, void 0, function () {
                var limit, apiParams, firstRequest, _a, maxResults, total, startAt, requests, limitOrTotal, i;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            limit = params.limit, apiParams = __rest(params, ["limit"]);
                            firstRequest = jiraHelpers.fetchJiraIssuesWithJQL(__assign({ maxResults: 100 }, apiParams));
                            return [4 /*yield*/, firstRequest];
                        case 1:
                            _a = _b.sent(), _a.issues, maxResults = _a.maxResults, total = _a.total, startAt = _a.startAt;
                            requests = [firstRequest];
                            limitOrTotal = Math.min(total, limit || Infinity);
                            for (i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
                                requests.push(jiraHelpers.fetchJiraIssuesWithJQL(__assign({ maxResults: maxResults, startAt: i }, apiParams)));
                            }
                            return [2 /*return*/, Promise.all(requests).then(function (responses) {
                                    return responses.map(function (response) { return response.issues; }).flat();
                                })];
                    }
                });
            });
        },
        fetchAllJiraIssuesWithJQLUsingNamedFields: function (params) {
            return __awaiter(this, void 0, void 0, function () {
                var fields, newParams, response;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, fieldsRequest];
                        case 1:
                            fields = _b.sent();
                            newParams = __assign(__assign({}, params), { fields: (_a = params.fields) === null || _a === void 0 ? void 0 : _a.map(function (f) { return fields.nameMap[f] || f; }) });
                            return [4 /*yield*/, jiraHelpers.fetchAllJiraIssuesWithJQL(newParams)];
                        case 2:
                            response = _b.sent();
                            return [2 /*return*/, response.map(function (issue) {
                                    return __assign(__assign({}, issue), { fields: mapIdsToNames(issue.fields, fields) });
                                })];
                    }
                });
            });
        },
        fetchJiraChangelog: function (issueIdOrKey, params) {
            // TODO investigate this - convert params to proper type
            return requestHelper("/api/3/issue/".concat(issueIdOrKey, "/changelog?") + new URLSearchParams(params));
        },
        isChangelogComplete: function (changelog) {
            return changelog.histories.length === changelog.total;
        },
        fetchRemainingChangelogsForIssues: function (issues, progress) {
            // check for remainings
            return Promise.all(issues.map(function (issue) {
                if (jiraHelpers.isChangelogComplete(issue.changelog)) {
                    return __assign(__assign({}, issue), { changelog: issue.changelog.histories });
                }
                else {
                    return jiraHelpers.fetchRemainingChangelogsForIssue(issue.key, issue.changelog).then(function (histories) {
                        return __assign(__assign({}, issue), { changelog: issue.changelog.histories });
                    });
                }
            }));
        },
        // weirdly, this starts with the oldest, but we got the most recent
        // returns an array of histories objects
        fetchRemainingChangelogsForIssue: function (issueIdOrKey, mostRecentChangeLog) {
            mostRecentChangeLog.histories; var maxResults = mostRecentChangeLog.maxResults, total = mostRecentChangeLog.total; mostRecentChangeLog.startAt;
            var requests = [];
            requests.push({ values: mostRecentChangeLog.histories });
            for (var i = 0; i < total - maxResults; i += maxResults) {
                requests.push(jiraHelpers.fetchJiraChangelog(issueIdOrKey, {
                    maxResults: Math.min(maxResults, total - maxResults - i),
                    startAt: i,
                }).then(function (response) {
                    // the query above reverses the sort order, we fix that here
                    return __assign(__assign({}, response), { values: response.values.reverse() });
                }));
            }
            // server sends back as "values", we match that
            return Promise.all(requests).then(function (responses) {
                return responses.map(function (response) { return response.values; }).flat();
            }).then(function (response) {
                return response;
            });
        },
        fetchAllJiraIssuesWithJQLAndFetchAllChangelog: function (params, progress) {
            if (progress === void 0) { progress = function () { }; }
            var limit = params.limit, apiParams = __rest(params, ["limit"]);
            // a weak map would be better
            progress.data = progress.data || {
                issuesRequested: 0,
                issuesReceived: 0,
                changeLogsRequested: 0,
                changeLogsReceived: 0
            };
            function getRemainingChangeLogsForIssues(response) {
                if (progress.data) {
                    Object.assign(progress.data, {
                        issuesReceived: progress.data.issuesReceived + response.issues.length
                    });
                    progress(progress.data);
                }
                return jiraHelpers.fetchRemainingChangelogsForIssues(response.issues, progress);
            }
            var firstRequest = jiraHelpers.fetchJiraIssuesWithJQL(__assign({ maxResults: 100, expand: ["changelog"] }, apiParams));
            return firstRequest.then(function (_a) {
                _a.issues; var maxResults = _a.maxResults, total = _a.total, startAt = _a.startAt;
                if (progress.data) {
                    Object.assign(progress.data, {
                        issuesRequested: progress.data.issuesRequested + total,
                        changeLogsRequested: 0,
                        changeLogsReceived: 0
                    });
                    progress(progress.data);
                }
                var requests = [firstRequest.then(getRemainingChangeLogsForIssues)];
                var limitOrTotal = Math.min(total, limit || Infinity);
                for (var i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
                    requests.push(jiraHelpers.fetchJiraIssuesWithJQL(__assign({ maxResults: maxResults, startAt: i }, apiParams))
                        .then(getRemainingChangeLogsForIssues));
                }
                return Promise.all(requests).then(function (responses) {
                    return responses.flat();
                });
            });
        },
        // this could do each response incrementally, but I'm being lazy
        fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: function (params_1) {
            return __awaiter(this, arguments, void 0, function (params, progress) {
                var fields, newParams, response;
                if (progress === void 0) { progress = function () { }; }
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, fieldsRequest];
                        case 1:
                            fields = _a.sent();
                            newParams = __assign(__assign({}, params), { fields: params.fields.map(function (f) { return fields.nameMap[f] || f; }) });
                            return [4 /*yield*/, jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelog(newParams, progress)];
                        case 2:
                            response = _a.sent();
                            return [2 /*return*/, response.map(function (issue) {
                                    return __assign(__assign({}, issue), { fields: mapIdsToNames(issue.fields, fields) });
                                })];
                    }
                });
            });
        },
        fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: function (params_1) {
            return __awaiter(this, arguments, void 0, function (params, progress) {
                return __generator(this, function (_a) {
                    console.warn("THIS METHOD SHOULD BE IMPOSSIBLE TO CALL");
                    return [2 /*return*/, Promise.resolve(null)];
                });
            });
        },
        fetchChildrenResponses: function (params, parentIssues, progress) {
            var _this = this;
            if (progress === void 0) { progress = function () { }; }
            var issuesToQuery = chunkArray(parentIssues, 40);
            var batchedResponses = issuesToQuery.map(function (issues) {
                var keys = issues.map(function (issue) { return issue.key; });
                var jql = "parent in (".concat(keys.join(", "), ")");
                return _this.fetchAllJiraIssuesWithJQLAndFetchAllChangelog(__assign(__assign({}, params), { jql: jql }), progress);
            });
            // this needs to be flattened
            return batchedResponses;
        },
        // Makes child requests in batches of 40
        // 
        // params - base params
        // sourceParentIssues - the source of parent issues
        fetchDeepChildren: function (params, sourceParentIssues, progress) {
            var _this = this;
            if (progress === void 0) { progress = function () { }; }
            var batchedFirstResponses = this.fetchChildrenResponses(params, sourceParentIssues, progress);
            var getChildren = function (parentIssues) {
                if (parentIssues.length) {
                    return _this.fetchDeepChildren(params, parentIssues, progress).then(function (deepChildrenIssues) {
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
        },
        fetchJiraFields: function () {
            return requestHelper("/api/3/field");
        },
        getAccessToken: function () {
            return __awaiter(this, void 0, void 0, function () {
                var refreshToken;
                return __generator(this, function (_a) {
                    if (!jiraHelpers.hasValidAccessToken()) {
                        refreshToken = jiraHelpers.fetchFromLocalStorage("refreshToken");
                        if (!refreshToken) {
                            jiraHelpers.fetchAuthorizationCode();
                        }
                        else {
                            return [2 /*return*/, jiraHelpers.refreshAccessToken()];
                        }
                    }
                    else {
                        return [2 /*return*/, jiraHelpers.fetchFromLocalStorage("accessToken")];
                    }
                    return [2 /*return*/];
                });
            });
        },
        hasAccessToken: function () {
            return !!jiraHelpers.fetchFromLocalStorage("accessToken");
        },
        hasValidAccessToken: function () {
            var accessToken = jiraHelpers.fetchFromLocalStorage("accessToken");
            var expiryTimestamp = Number(jiraHelpers.fetchFromLocalStorage("expiryTimestamp"));
            if (isNaN(expiryTimestamp)) {
                expiryTimestamp = 0;
            }
            var currentTimestamp = Math.floor(new Date().getTime() / 1000.0);
            return !((currentTimestamp > expiryTimestamp) || (!accessToken));
        },
        _cachedServerInfoPromise: function () {
            return requestHelper('/api/3/serverInfo');
        },
        getServerInfo: function () {
            // if(this._cachedServerInfoPromise) {
            // 	return this._cachedServerInfoPromise;
            // }
            // // https://your-domain.atlassian.net/rest/api/3/serverInfo
            // return this._cachedServerInfoPromise( = requestHelper('/api/3/serverInfo'));
            return this._cachedServerInfoPromise();
        },
    };
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
    if (jiraHelpers.hasValidAccessToken()) {
        // @ts-ignore
        fieldsRequest = jiraHelpers.fetchJiraFields().then(function (fields) {
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
                idMap: idMap
            };
        });
        // @ts-ignore
        jiraHelpers.fieldsRequest = fieldsRequest;
    }
    function mapIdsToNames(obj, fields) {
        var mapped = {};
        for (var prop in obj) {
            mapped[fields.idMap[prop] || prop] = obj[prop];
        }
        return mapped;
    }
    function fieldsToEditBody(obj, fieldMapping) {
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

function oauthCallback(environment) {
	const jiraHelpers = jiraOIDCHelpers(environment);

	const queryParams = new URLSearchParams(window.location.search);
	const queryCode = queryParams.get('code');
	if (!queryCode) {
		//handle error properly to ensure good feedback
		mainElement.textContent = "Invalid code provided";
		// Todo
	} else {
		jiraHelpers.fetchAccessTokenWithAuthCode(queryCode);
	}

}

export { oauthCallback as default };
//# sourceMappingURL=oauth-callback.js.map
