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
import { responseToJSON } from './shared/response-to-json';
var mapIdsToNames = require('./shared/map-ids-to-names').mapIdsToNames;
var chunkArray = require('./shared/chunk-array').chunkArray;
import { JiraHelpers } from './JiraHelpers.js';
var CACHE_FETCH = false;
export function nativeFetchJSON(url, options) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, fetch(url, options).then(responseToJSON)];
        });
    });
}
export default function JiraOIDCHelpers(_a, requestHelper, host) {
    var _b = _a === void 0 ? window.env : _a, JIRA_CLIENT_ID = _b.JIRA_CLIENT_ID, JIRA_SCOPE = _b.JIRA_SCOPE, JIRA_CALLBACK_URL = _b.JIRA_CALLBACK_URL, JIRA_API_URL = _b.JIRA_API_URL;
    var fetchJSON = nativeFetchJSON;
    if (CACHE_FETCH) {
        fetchJSON = function (url, options) {
            return __awaiter(this, void 0, void 0, function () {
                var storedUrl, result;
                var _this = this;
                return __generator(this, function (_a) {
                    storedUrl = window.localStorage.getItem(url);
                    if (storedUrl && typeof (storedUrl) === 'string') {
                        return [2 /*return*/, JSON.parse(storedUrl)];
                    }
                    else {
                        result = nativeFetchJSON(url, options);
                        result.then(function (data) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                try {
                                    window.localStorage.setItem(url, JSON.stringify(data));
                                }
                                catch (e) {
                                    console.log("can't save");
                                }
                                return [2 /*return*/];
                            });
                        }); });
                        return [2 /*return*/, result];
                    }
                    return [2 /*return*/];
                });
            });
        };
    }
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
                var jql = "parent in (".concat(keys.join(", "), ")");
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
        return function fetchAllDeepChildren(params, progress) {
            return __awaiter(this, void 0, void 0, function () {
                var fields, newParams, parentIssues, allChildrenIssues, combined;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, fieldsRequest];
                        case 1:
                            fields = _a.sent();
                            newParams = __assign(__assign({}, params), { fields: params.fields.map(function (f) { return fields.nameMap[f] || f; }) });
                            progress.data = progress.data || {
                                issuesRequested: 0,
                                issuesReceived: 0,
                                changeLogsRequested: 0,
                                changeLogsReceived: 0
                            };
                            return [4 /*yield*/, rootMethod(newParams, progress)];
                        case 2:
                            parentIssues = _a.sent();
                            return [4 /*yield*/, fetchDeepChildren(newParams, parentIssues, progress)];
                        case 3:
                            allChildrenIssues = _a.sent();
                            combined = parentIssues.concat(allChildrenIssues);
                            return [2 /*return*/, combined.map(function (issue) {
                                    return __assign(__assign({}, issue), { fields: mapIdsToNames(issue.fields, fields) });
                                })];
                    }
                });
            });
        };
    }
    var jiraHelpers = new JiraHelpers({
        JIRA_CLIENT_ID: JIRA_CLIENT_ID,
        JIRA_SCOPE: JIRA_SCOPE,
        JIRA_CALLBACK_URL: JIRA_CALLBACK_URL,
        JIRA_API_URL: JIRA_API_URL
    }, requestHelper, host, fetchJSON);
    jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLUsingNamedFields =
        makeDeepChildrenLoaderUsingNamedFields(jiraHelpers.fetchAllJiraIssuesWithJQL.bind(jiraHelpers));
    jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields =
        makeDeepChildrenLoaderUsingNamedFields(jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelog.bind(jiraHelpers));
    function makeFieldNameToIdMap(fields) {
        var map = {};
        fields.forEach(function (f) {
            map[f.name] = f.id;
        });
        return map;
    }
    if (host === "jira" || jiraHelpers.hasValidAccessToken()) {
        fieldsRequest = jiraHelpers.fetchJiraFields().then(function (fields) {
            var nameMap = {};
            var idMap = {};
            fields.forEach(function (f) {
                idMap[f.id] = f.name;
                nameMap[f.name] = f.id;
            });
            console.log(nameMap);
            return {
                list: fields,
                nameMap: nameMap,
                idMap: idMap
            };
        });
        jiraHelpers.fieldsRequest = fieldsRequest;
    }
    window.jiraHelpers = jiraHelpers;
    return jiraHelpers;
}
