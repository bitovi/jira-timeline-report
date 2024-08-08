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
import mapIdsToNames from './shared/map-ids-to-names.js';
import chunkArray from './shared/chunk-array.js';
function responseToText(response) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!response.ok) {
                return [2 /*return*/, response.json().then(function (payload) {
                        var err = new Error("HTTP status code: " + response.status);
                        Object.assign(err, payload);
                        Object.assign(err, response);
                        throw err;
                    })];
            }
            return [2 /*return*/, response.text()];
        });
    });
}
var JiraHelpers = /** @class */ (function () {
    function JiraHelpers(_a, requestHelper, host, fetchJSON) {
        var _b = _a === void 0 ? window.env : _a, JIRA_CLIENT_ID = _b.JIRA_CLIENT_ID, JIRA_SCOPE = _b.JIRA_SCOPE, JIRA_CALLBACK_URL = _b.JIRA_CALLBACK_URL, JIRA_API_URL = _b.JIRA_API_URL;
        var _this = this;
        this.fieldsToEditBody = function (obj, fieldMapping) {
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
        this.mapNamesToIds = function (obj, fields) {
            var mapped = {};
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
                mapped[fields.nameMap[prop] || prop] = obj[prop];
                //}
            }
        };
        this.requestHelper = requestHelper;
        this.fetchJSON = fetchJSON;
        this.saveInformationToLocalStorage = function (parameters) {
            var objectKeys = Object.keys(parameters);
            for (var _i = 0, objectKeys_1 = objectKeys; _i < objectKeys_1.length; _i++) {
                var key = objectKeys_1[_i];
                window.localStorage.setItem(key, parameters[key]);
            }
        };
        this.clearAuthFromLocalStorage = function () {
            window.localStorage.removeItem("accessToken");
            window.localStorage.removeItem("refreshToken");
            window.localStorage.removeItem("expiryTimestamp");
        };
        this.fetchFromLocalStorage = function (key) {
            return window.localStorage.getItem(key);
        };
        this.fetchAuthorizationCode = function () {
            var url = "https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=".concat(JIRA_CLIENT_ID, "&scope=").concat(JIRA_SCOPE, "&redirect_uri=").concat(JIRA_CALLBACK_URL, "&response_type=code&prompt=consent&state=").concat(encodeURIComponent(encodeURIComponent(window.location.search)));
            window.location.href = url;
        };
        this.refreshAccessToken = function (accessCode) { return __awaiter(_this, void 0, void 0, function () {
            var response, _a, accessToken, expiryTimestamp, refreshToken, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.fetchJSON("".concat(window.env.JIRA_API_URL, "/?code=").concat(accessCode))];
                    case 1:
                        response = _b.sent();
                        _a = response.data, accessToken = _a.accessToken, expiryTimestamp = _a.expiryTimestamp, refreshToken = _a.refreshToken;
                        this.saveInformationToLocalStorage({
                            accessToken: accessToken,
                            refreshToken: refreshToken,
                            expiryTimestamp: expiryTimestamp,
                        });
                        return [2 /*return*/, accessToken];
                    case 2:
                        error_1 = _b.sent();
                        console.error(error_1.message);
                        this.clearAuthFromLocalStorage();
                        this.fetchAuthorizationCode();
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); };
        this.fetchAccessTokenWithAuthCode = function (authCode) { return __awaiter(_this, void 0, void 0, function () {
            var _a, accessToken, expiryTimestamp, refreshToken, scopeId, addOnQuery, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.fetchJSON("./access-token?code=".concat(authCode))];
                    case 1:
                        _a = _b.sent(), accessToken = _a.accessToken, expiryTimestamp = _a.expiryTimestamp, refreshToken = _a.refreshToken, scopeId = _a.scopeId;
                        this.saveInformationToLocalStorage({
                            accessToken: accessToken,
                            refreshToken: refreshToken,
                            expiryTimestamp: expiryTimestamp,
                            scopeId: scopeId,
                        });
                        addOnQuery = new URL(window.location.toString()).searchParams.get("state");
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
        }); };
        this.fetchAccessibleResources = function () {
            return _this.requestHelper("https://api.atlassian.com/oauth/token/accessible-resources");
        };
        this.fetchJiraSprint = function (sprintId) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, requestHelper("/agile/1.0/sprint/".concat(sprintId))];
            });
        }); };
        this.fetchJiraIssue = function (issueId) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, requestHelper("/api/3/issue/".concat(issueId))];
            });
        }); };
        this.editJiraIssueWithNamedFields = function (issueId, fields) { return __awaiter(_this, void 0, void 0, function () {
            var scopeIdForJira, accessToken, fieldMapping, editBody;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        scopeIdForJira = this.fetchFromLocalStorage('scopeId');
                        accessToken = this.fetchFromLocalStorage('accessToken');
                        return [4 /*yield*/, this.fieldsRequest];
                    case 1:
                        fieldMapping = _a.sent();
                        editBody = this.fieldsToEditBody(fields, fieldMapping);
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
        }); };
        this.fetchJiraIssuesWithJQL = function (params) {
            return requestHelper("/api/3/search?" + new URLSearchParams(params));
        };
        this.fetchJiraIssuesWithJQLWithNamedFields = function (params) { return __awaiter(_this, void 0, void 0, function () {
            var fields, newParams, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fieldsRequest];
                    case 1:
                        fields = _a.sent();
                        newParams = __assign(__assign({}, params), { fields: params.fields.map(function (f) { return fields.nameMap[f] || f; }) });
                        return [4 /*yield*/, this.fetchJiraIssuesWithJQL(newParams)];
                    case 2:
                        response = _a.sent();
                        return [2 /*return*/, response.issues.map(function (issue) {
                                return __assign(__assign({}, issue), { fields: mapIdsToNames(issue.fields, fields) });
                            })];
                }
            });
        }); };
        this.fetchAllJiraIssuesWithJQL = function (params) { return __awaiter(_this, void 0, void 0, function () {
            var limit, apiParams, firstRequest, _a, maxResults, total, startAt, requests, limitOrTotal, i;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        limit = params.limit, apiParams = __rest(params, ["limit"]);
                        firstRequest = this.fetchJiraIssuesWithJQL(__assign({ maxResults: 100 }, apiParams));
                        return [4 /*yield*/, firstRequest];
                    case 1:
                        _a = _b.sent(), maxResults = _a.maxResults, total = _a.total, startAt = _a.startAt;
                        requests = [firstRequest];
                        limitOrTotal = Math.min(total, limit || Infinity);
                        for (i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
                            requests.push(this.fetchJiraIssuesWithJQL(__assign({ maxResults: maxResults, startAt: i }, apiParams)));
                        }
                        return [2 /*return*/, Promise.all(requests).then(function (responses) {
                                return responses.map(function (response) { return response.issues; }).flat();
                            })];
                }
            });
        }); };
        this.fetchAllJiraIssuesWithJQLUsingNamedFields = function (params) { return __awaiter(_this, void 0, void 0, function () {
            var fields, newParams, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fieldsRequest];
                    case 1:
                        fields = _a.sent();
                        newParams = __assign(__assign({}, params), { fields: params.fields.map(function (f) { return fields.nameMap[f] || f; }) });
                        return [4 /*yield*/, this.fetchAllJiraIssuesWithJQL(newParams)];
                    case 2:
                        response = _a.sent();
                        return [2 /*return*/, response.map(function (issue) {
                                return __assign(__assign({}, issue), { fields: mapIdsToNames(issue.fields, fields) });
                            })];
                }
            });
        }); };
        this.fetchJiraChangelog = function (issueIdOrKey, params) {
            return requestHelper("/api/3/issue/".concat(issueIdOrKey, "/changelog?") + new URLSearchParams(params));
        };
        this.isChangelogComplete = function (changelog) {
            return changelog.histories.length === changelog.total;
        };
        this.fetchRemainingChangelogsForIssues = function (issues, progress) {
            // check for remainings
            return Promise.all(issues.map(function (issue) {
                if (_this.isChangelogComplete(issue.changelog)) {
                    return __assign(__assign({}, issue), { changelog: issue.changelog.histories });
                }
                else {
                    return _this.fetchRemainingChangelogsForIssue(issue.key, issue.changelog).then(function () {
                        return __assign(__assign({}, issue), { changelog: issue.changelog.histories });
                    });
                }
            }));
        };
        // weirdly, this starts with the oldest, but we got the most recent
        // returns an array of histories objects
        this.fetchRemainingChangelogsForIssue = function (issueIdOrKey, mostRecentChangeLog) {
            var maxResults = mostRecentChangeLog.maxResults, total = mostRecentChangeLog.total;
            var requests = [];
            requests.push({ values: mostRecentChangeLog.histories });
            for (var i = 0; i < total - maxResults; i += maxResults) {
                requests.push(_this.fetchJiraChangelog(issueIdOrKey, {
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
        };
        this.fetchAllJiraIssuesWithJQLAndFetchAllChangelog = function (params, progress) {
            var limit = params.limit, apiParams = __rest(params, ["limit"]);
            // a weak map would be better
            progress.data = progress.data || {
                issuesRequested: 0,
                issuesReceived: 0,
                changeLogsRequested: 0,
                changeLogsReceived: 0
            };
            function getRemainingChangeLogsForIssues(response, fetchRemaining) {
                Object.assign(progress.data, {
                    issuesReceived: progress.data.issuesReceived + response.issues.length
                });
                progress(progress.data);
                return fetchRemaining(response.issues, progress);
            }
            var firstRequest = _this.fetchJiraIssuesWithJQL(__assign({ maxResults: 100, expand: ["changelog"] }, apiParams));
            return firstRequest.then(function (_a) {
                var issues = _a.issues, maxResults = _a.maxResults, total = _a.total, startAt = _a.startAt;
                Object.assign(progress.data, {
                    issuesRequested: progress.data.issuesRequested + total,
                    changeLogsRequested: 0,
                    changeLogsReceived: 0
                });
                progress(progress.data);
                var requests = [firstRequest.then(function (response) { return getRemainingChangeLogsForIssues(response, _this.fetchRemainingChangelogsForIssues); })];
                var limitOrTotal = Math.min(total, limit || Infinity);
                for (var i = startAt + maxResults; i < limitOrTotal; i += maxResults) {
                    requests.push(_this.fetchJiraIssuesWithJQL(__assign({ maxResults: maxResults, startAt: i }, apiParams))
                        .then(function (response) { return getRemainingChangeLogsForIssues(response, _this.fetchRemainingChangelogsForIssues); }));
                }
                return Promise.all(requests).then(function (responses) {
                    return responses.flat();
                });
            });
        };
        // this could do each response incrementally, but I'm being lazy
        this.fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields = function (params, progress) { return __awaiter(_this, void 0, void 0, function () {
            var fields, newParams, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fieldsRequest];
                    case 1:
                        fields = _a.sent();
                        newParams = __assign(__assign({}, params), { fields: params.fields.map(function (f) { return fields.nameMap[f] || f; }) });
                        return [4 /*yield*/, this.fetchAllJiraIssuesWithJQLAndFetchAllChangelog(newParams, progress)];
                    case 2:
                        response = _a.sent();
                        return [2 /*return*/, response.map(function (issue) {
                                return __assign(__assign({}, issue), { fields: mapIdsToNames(issue.fields, fields) });
                            })];
                }
            });
        }); };
        this.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields = function (params, progress) { return __awaiter(_this, void 0, void 0, function () {
            var fields, newParams, parentIssues, allChildrenIssues, combined;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fieldsRequest];
                    case 1:
                        fields = _a.sent();
                        newParams = __assign(__assign({}, params), { fields: params.fields.map(function (f) { return fields.nameMap[f] || f; }) });
                        progress.data = progress.data || {
                            issuesRequested: 0,
                            issuesReceived: 0,
                            changeLogsRequested: 0,
                            changeLogsReceived: 0
                        };
                        return [4 /*yield*/, this.fetchAllJiraIssuesWithJQLAndFetchAllChangelog(newParams, progress)];
                    case 2:
                        parentIssues = _a.sent();
                        return [4 /*yield*/, this.fetchDeepChildren(newParams, parentIssues, progress)];
                    case 3:
                        allChildrenIssues = _a.sent();
                        combined = parentIssues.concat(allChildrenIssues);
                        return [2 /*return*/, combined.map(function (issue) {
                                return __assign(__assign({}, issue), { fields: mapIdsToNames(issue.fields, fields) });
                            })];
                }
            });
        }); };
        this.fetchChildrenResponses = function (params, parentIssues, progress) {
            var issuesToQuery = chunkArray(parentIssues, 40);
            var batchedResponses = issuesToQuery.map(function (issues) {
                var keys = issues.map(function (issue) { return issue.key; });
                var jql = "parent in (".concat(keys.join(", "), ")");
                return _this.fetchAllJiraIssuesWithJQLAndFetchAllChangelog(__assign(__assign({}, params), { jql: jql }), progress);
            });
            // this needs to be flattened
            return batchedResponses;
        };
        // Makes child requests in batches of 40
        // 
        // params - base params
        // sourceParentIssues - the source of parent issues
        this.fetchDeepChildren = function (params, sourceParentIssues, progress) {
            var batchedFirstResponses = _this.fetchChildrenResponses(params, sourceParentIssues, progress);
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
        };
        this.fetchJiraFields = function () {
            return requestHelper("/api/3/field");
        };
        this.getAccessToken = function () { return __awaiter(_this, void 0, void 0, function () {
            var refreshToken;
            return __generator(this, function (_a) {
                if (!this.hasValidAccessToken()) {
                    refreshToken = this.fetchFromLocalStorage("refreshToken");
                    if (!refreshToken) {
                        this.fetchAuthorizationCode();
                    }
                    else {
                        return [2 /*return*/, this.refreshAccessToken()];
                    }
                }
                else {
                    return [2 /*return*/, this.fetchFromLocalStorage("accessToken")];
                }
                return [2 /*return*/];
            });
        }); };
        this.hasAccessToken = function () {
            return !!_this.fetchFromLocalStorage("accessToken");
        };
        this.hasValidAccessToken = function () {
            var accessToken = _this.fetchFromLocalStorage("accessToken");
            var expiryTimestamp = Number(_this.fetchFromLocalStorage("expiryTimestamp"));
            if (isNaN(expiryTimestamp)) {
                expiryTimestamp = 0;
            }
            var currentTimestamp = Math.floor(new Date().getTime() / 1000.0);
            return !((currentTimestamp > expiryTimestamp) || (!accessToken));
        };
        this.getServerInfo = function () {
            if (_this._cachedServerInfoPromise) {
                return _this._cachedServerInfoPromise;
            }
            // https://your-domain.atlassian.net/rest/api/3/serverInfo
            return _this._cachedServerInfoPromise = requestHelper('/api/3/serverInfo');
        };
    }
    return JiraHelpers;
}());
export { JiraHelpers };
