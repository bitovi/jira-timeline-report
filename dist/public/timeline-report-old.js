var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { StacheElement, type, ObservableObject, ObservableArray } from "./can.js";
import { calculationKeysToNames, denormalizedIssueHierarchy, getImpliedTimingCalculations } from "./prepare-issues/date-data.js";
import { percentComplete } from "./percent-complete/percent-complete.js";
import { issues as rollbackIssues } from "./rollback/rollback-jira-issues.js";
import { normalizeAndDeriveIssues } from "./shared/issue-data/issue-data.js";
import { howMuchHasDueDateMovedForwardChangedSince, DAY_IN_MS, parseDateISOString, epicTimingData } from "./date-helpers.js";
import { addStatusToInitiative, addStatusToRelease, getBusinessDatesCount, inPartnerReviewStatuses, inIdeaStatus, inIdeaStatuses } from "./status-helpers.js";
import { releasesAndInitiativesWithPriorTiming, rawIssuesToBaseIssueFormat, filterOutInitiativeStatuses, filterQAWork, filterPartnerReviewWork } from "./prepare-issues/prepare-issues.js";
import semverReleases from "./semver-releases.js";
import sortedByLastEpicReleases from "./sorted-by-last-epic-releases.js";
var dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: "short" });
var booleanParsing = {
    parse: function (x) {
        return ({ "": true, "true": true, "false": false })[x];
    },
    stringify: function (x) { return "" + x; }
};
import bitoviTrainingData from "./examples/bitovi-training.js";
import { estimateExtraPoints } from "./confidence.js";
import { saveJSONToUrl, updateUrlParam } from "./shared/state-storage.js";
//import "./steerco-timeline.js";
import "./status-filter.js";
import "./status-filter-only.js";
import "./gantt-grid.js";
import "./gantt-timeline.js";
import "./status-report.js";
var ISSUE_KEY = "Issue key";
var PRODUCT_TARGET_RELEASE_KEY = "Product Target Release";
var ISSUE_TYPE_KEY = "Issue Type";
var PARENT_LINK_KEY = "Parent Link";
var START_DATE_KEY = "Start date";
var DUE_DATE_KEY = "Due date";
var LABELS_KEY = "Labels";
var STATUS_KEY = "Status";
var FIX_VERSIONS_KEY = "Fix versions";
var selectStyle = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";
var configurationView = "\n<div class=\"border-gray-100 p-4 relative {{# not(this.showingConfiguration) }}hidden{{/}}\" style=\"border-top-width: 32px;overflow-y: auto\">\n  <p>\n    Questions on the options? \n    <a class=\"link\" href=\"https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#getting-started\">Read the guide</a>, or \n    <a class=\"link\" href=\"https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#need-help-or-have-questions\">connect with us</a>.\n  </p>  \n  <h3 class=\"h3\">Issue Source</h3>\n  <p>Specify a JQL that loads all issues you want to report on and help determine the timeline of your report.</p>\n  <p>\n    {{# if(this.loginComponent.isLoggedIn) }}\n      <input class=\"w-full-border-box mt-2 form-border p-1\" value:bind='this.jql'/>\n    {{ else }}\n      <input class=\"w-full-border-box mt-2 form-border p-1 text-yellow-300\" value=\"Sample data. Connect to Jira to specify.\" disabled/>\n    {{/ if}}\n  </p>\n  {{# if(this.cvsIssuesPromise.isPending) }}\n    {{# if(this.progressData.issuesRequested)}}\n      <p class=\"text-xs text-right\">Loaded {{this.progressData.issuesReceived}} of {{this.progressData.issuesRequested}} issues</p>\n    {{ else }}\n      <p class=\"text-xs text-right\">Loading issues ...</p>\n    {{/ if}}\n  {{/ if }}\n  {{# if(this.cvsIssuesPromise.isRejected) }}\n    <div class=\"border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked p-1\">\n      <p>There was an error loading from Jira!</p>\n      <p>Error message: {{this.cvsIssuesPromise.reason.errorMessages[0]}}</p>\n      <p>Please check your JQL is correct!</p>\n    </div>\n  {{/ if }}\n  <div class=\"flex justify-between mt-1\">\n\n    <p class=\"text-xs\"><input type='checkbox' \n      class='self-start align-middle' checked:bind='this.loadChildren'/> <span class=\"align-middle\">Load all children of JQL specified issues</span>\n    </p>\n    \n    {{# if(this.cvsIssuesPromise.isResolved) }}\n      <p class=\"text-xs\">Loaded {{this.rawIssues.length}} issues</p>\n    {{/ if }}\n  </div>\n  \n\n  <h3 class=\"h3 mt-4\">Primary Timeline</h3>\n  <div class=\"flex mt-2 gap-2 flex-wrap\">\n    <p>What Jira artifact do you want to report on?</p>\n    <div class=\"shrink-0\">\n    {{# for(issueType of this.primaryReportingIssueHierarchy) }}\n      <label class=\"px-2\"><input \n        type=\"radio\" \n        name=\"primaryIssueType\" \n        checked:from=\"eq(this.primaryIssueType, issueType.type)\"\n        on:change=\"this.primaryIssueType = issueType.type\"/> {{issueType.plural}} </label>\n    {{/ }}\n    </div>\n  </div>\n\n  <div class=\"flex mt-2 gap-2 flex-wrap\">\n    <p>What timing data do you want to report?</p>\n    <div class=\"shrink-0\">\n      <label class=\"px-2\"><input \n        type=\"radio\" \n        name=\"primaryReportType\"\n        checked:from=\"eq(this.primaryReportType, 'start-due')\"\n        on:change=\"this.primaryReportType = 'start-due'\"\n        /> Start and due dates </label>\n      <label class=\"px-2\"><input \n        type=\"radio\" \n        name=\"primaryReportType\"\n        checked:from=\"eq(this.primaryReportType, 'due')\"\n        on:change=\"this.primaryReportType = 'due'\"\n        /> Due dates only</label>\n      <label class=\"px-2\"><input \n        type=\"radio\" \n        name=\"primaryReportType\"\n        checked:from=\"eq(this.primaryReportType, 'breakdown')\"\n        on:change=\"this.primaryReportType = 'breakdown'\"\n        /> Work breakdown</label>\n    </div>\n  </div>\n\n\n  <h3 class=\"h3\">Timing Calculation</h3>\n  <div class=\"grid gap-2 my-2\" style=\"grid-template-columns: auto auto auto;\">\n    <div class=\"text-sm py-1 text-slate-600 font-semibold\" style=\"grid-column: 1 / span 1; grid-row: 1 / span 1;\">Parent Type</div>\n    <div class=\"text-sm py-1 text-slate-600 font-semibold\" style=\"grid-column: 2 / span 1; grid-row: 1 / span 1;\">Child Type</div>\n    <div class=\"text-sm py-1 text-slate-600 font-semibold\" style=\"grid-column: 3 / span 1; grid-row: 1 / span 1;\">How is timing calculated between parent and child?</div>\n    <div class=\"border-b-2 border-neutral-40\" style=\"grid-column: 1 / span 3; grid-row: 1 / span 1;\"></div>\n\n    {{# for(timingLevel of this.timingLevels) }}\n\n        <label class=\"pr-2 py-2 {{ this.paddingClass(scope.index) }}\">{{timingLevel.type}}</label>\n        {{# eq(timingLevel.types.length, 1) }}\n          <span class=\"p-2\">{{timingLevel.types[0].type}}</span>\n        {{ else }}\n          <select class=\"".concat(selectStyle, "\" on:change=\"this.updateCalculationType(scope.index, scope.element.value)\">\n            {{# for(type of timingLevel.types) }}\n              <option {{# if(type.selected) }}selected{{/ if }}>{{type.type}}</option>\n            {{/ for }}\n          </select>\n        {{/ eq}}\n\n        <select class=\"").concat(selectStyle, "\" on:change=\"this.updateCalculation(scope.index, scope.element.value)\">\n          {{# for(calculation of timingLevel.calculations) }}\n            <option {{# if(calculation.selected) }}selected{{/ if }} value=\"{{calculation.calculation}}\">{{calculation.name}}</option>\n          {{/ for }}\n        </select>\n\n    {{/ for }}\n    \n  </div>\n\n  <h3 class=\"h3\">Filters</h3>\n\n  <div class=\"grid gap-3\" style=\"grid-template-columns: max-content max-content 1fr\">\n\n    <label class=''>Hide Unknown {{this.primaryIssueType}}s</label>\n    <input type='checkbox' \n      class='self-start mt-1.5' checked:bind='this.hideUnknownInitiatives'/>\n    <p class=\"m-0\">Hide {{this.primaryIssueType}}s whose timing can't be determined.\n    </p>\n\n    <label>{{this.firstIssueTypeWithStatuses}} Statuses to Report</label>\n    <status-filter \n      statuses:from=\"this.statuses\"\n      param:raw=\"statusesToShow\"\n      selectedStatuses:to=\"this.statusesToShow\"\n      style=\"max-width: 400px;\"></status-filter>\n    <p>Only include these statuses in the report</p>\n\n    <label>{{this.firstIssueTypeWithStatuses}} Statuses to Ignore</label>\n    <status-filter \n      statuses:from=\"this.statuses\" \n      param:raw=\"statusesToRemove\"\n      selectedStatuses:to=\"this.statusesToRemove\"\n      style=\"max-width: 400px;\"></status-filter>\n    <p>Search for statuses to remove from the report</p>\n\n    {{# eq(this.primaryIssueType, \"Release\") }}\n      <label class=''>Show Only Semver Releases</label>\n      <input type='checkbox' \n        class='self-start mt-1.5'  checked:bind='this.showOnlySemverReleases'/>\n      <p class=\"m-0\">This will only include releases that have a structure like <code>[NAME]_[D.D.D]</code>. Examples:\n      <code>ACME_1.2.3</code>, <code>ACME_CHECKOUT_1</code>, <code>1.2</code>.\n      </p>\n    {{/ }}\n\n\n  </div>\n\n  <h3 class=\"h3\">Sorting</h3>\n  <div class=\"grid gap-3\" style=\"grid-template-columns: max-content max-content 1fr\">\n    <label class=''>Sort by Due Date</label>\n      <input type='checkbox' \n        class='self-start mt-1.5' checked:bind='this.sortByDueDate'/>\n      <p class=\"m-0\">Instead of ordering initiatives based on the order defined in the JQL, \n      sort initiatives by their last epic's due date.\n      </p>\n  </div>\n\n  <h3 class=\"h3\">Secondary Status Report</h3>\n  <div class=\"flex mt-2 gap-2 flex-wrap\">\n    <p>Secondary Report Type</p>\n    <div class=\"shrink-0\">\n      <label class=\"px-2\"><input \n        type=\"radio\" \n        name=\"secondary\" \n        checked:from=\"eq(this.secondaryReportType, 'none')\"\n        on:change=\"this.secondaryReportType = 'none'\"\n        /> None </label>\n        \n      <label class=\"px-2\"><input \n        type=\"radio\" \n        name=\"secondary\" \n        checked:from=\"eq(this.secondaryReportType, 'status')\"\n        on:change=\"this.secondaryReportType = 'status'\"\n        /> {{this.secondaryIssueType}} status </label>\n    \n      {{# not(eq(this.secondaryIssueType, \"Story\") ) }}\n      <label class=\"px-2\"><input \n        type=\"radio\" \n        name=\"secondary\" \n        checked:from=\"eq(this.secondaryReportType, 'breakdown')\"\n        on:change=\"this.secondaryReportType = 'breakdown'\"\n        /> {{this.secondaryIssueType}} work breakdown </label>\n      {{/ not }}\n    </div>\n  </div>\n  <div class=\"flex gap-2 mt-1\">\n    <label>{{this.firstIssueTypeWithStatuses}} statuses to show as planning:</label>\n    <status-filter \n      statuses:from=\"this.statuses\" \n      param:raw=\"planningStatuses\"\n      selectedStatuses:to=\"this.planningStatuses\"\n      style=\"max-width: 400px;\"></status-filter>\n  </div>\n\n  \n</div>");
var UNCERTAINTY_WEIGHT_DEFAULT = 80;
var PARENT_ISSUE_DURATION_DAYS_DEFAULT = 6 * 7;
var TimelineReport = /** @class */ (function (_super) {
    __extends(TimelineReport, _super);
    function TimelineReport() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TimelineReport.prototype.updateCalculationType = function (index, value) {
        var copyCalculations = __spreadArray([], getImpliedTimingCalculations(this.primaryIssueType, this.issueHierarchy.typeToIssueType, this.timingCalculations), true).slice(0, index + 1);
        copyCalculations[index].type = value;
        this.timingCalculations = copyCalculations;
    };
    TimelineReport.prototype.updateCalculation = function (index, value) {
        var copyCalculations = __spreadArray([], getImpliedTimingCalculations(this.primaryIssueType, this.issueHierarchy.typeToIssueType, this.timingCalculations), true).slice(0, index + 1);
        copyCalculations[index].calculation = value;
        this.timingCalculations = copyCalculations;
    };
    // hooks
    TimelineReport.prototype.connected = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                updateFullishHeightSection();
                return [2 /*return*/];
            });
        });
    };
    Object.defineProperty(TimelineReport.prototype, "serverInfoPromise", {
        get: function () {
            return this.jiraHelpers.getServerInfo();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimelineReport.prototype, "rawIssuesPromise", {
        get: function () {
            var _this = this;
            if (this.loginComponent.isLoggedIn === false || !this.jql) {
                return;
            }
            this.progressData = null;
            var loadIssues = this.loadChildren ?
                this.jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields.bind(this.jiraHelpers) :
                this.jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields.bind(this.jiraHelpers);
            return loadIssues({
                jql: this.jql,
                fields: ["summary",
                    "Rank",
                    "Start date",
                    "Due date",
                    "Issue Type",
                    "Fix versions",
                    "Story points",
                    //"Story Points", // This does not match a field returned by Jira but afraid to change at the moment.
                    "Story points median",
                    "Confidence",
                    "Story points confidence",
                    "Product Target Release", PARENT_LINK_KEY, LABELS_KEY, STATUS_KEY, "Sprint", "Epic Link", "Created", "Parent"],
                expand: ["changelog"]
            }, function (progressData) {
                _this.progressData = __assign({}, progressData);
            }).then(function (rawIssues) {
                if ( /*localStorage.getItem("percentComplete")*/true) {
                    setTimeout(function () {
                        console.log("percentComplete", percentComplete(rawIssues));
                    }, 13);
                }
                return rawIssues;
            });
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimelineReport.prototype, "cvsIssuesPromise", {
        get: function () {
            if (this.loginComponent.isLoggedIn === false) {
                return bitoviTrainingData(new Date());
            }
            if (this.jql) {
                var serverInfoPromise = this.serverInfoPromise;
                var issuesPromise = this.rawIssuesPromise;
                return Promise.all([
                    issuesPromise, serverInfoPromise
                ]).then(function (_a) {
                    var issues = _a[0], serverInfo = _a[1];
                    var formatted = rawIssuesToBaseIssueFormat(issues, serverInfo);
                    return formatted;
                });
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimelineReport.prototype, "teams", {
        get: function () {
            if (!this.rawIssues) {
                return new Set();
            }
            return new Set(this.rawIssues.map(function (issue) { return issue["Project key"]; }));
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimelineReport.prototype, "statuses", {
        get: function () {
            if (!this.rawIssues) {
                return [];
            }
            var statuses = new Set();
            for (var _i = 0, _a = this.rawIssues; _i < _a.length; _i++) {
                var issue = _a[_i];
                statuses.add(issue.Status);
            }
            return __spreadArray([], statuses, true).sort(function (s1, s2) {
                return s1 > s2 ? 1 : -1;
            });
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimelineReport.prototype, "teamKeyToCharacters", {
        get: function () {
            if (!this.teams) {
                return [];
            }
            var names = this.teams;
            return characterNamer(names);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimelineReport.prototype, "issuesMappedByParentKey", {
        get: function () {
            if (!this.rawIssues) {
                return {};
            }
            var map = {};
            for (var _i = 0, _a = this.rawIssues; _i < _a.length; _i++) {
                var issue = _a[_i];
                var parentKeyValue = issue[PARENT_LINK_KEY] || issue["Epic Link"];
                if (parentKeyValue) {
                    if (!map[parentKeyValue]) {
                        map[parentKeyValue] = [];
                    }
                    map[parentKeyValue].push(issue);
                }
            }
            return map;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimelineReport.prototype, "releasesAndInitiativesWithPriorTiming", {
        get: function () {
            if (!this.rawIssues || !this.issueHierarchy) {
                return { releases: [], initiatives: [] };
            }
            // Remove initiatives with certain statuses
            var initiativeStatusesToRemove = this.statusesToRemove;
            var initiativeStatusesToShow = this.statusesToShow;
            var reportedIssueType = this.primaryIssueType === "Release" ? this.secondaryIssueType : this.primaryIssueType;
            var timingMethods = getImpliedTimingCalculations(this.primaryIssueType, this.issueHierarchy.typeToIssueType, this.timingCalculations).map(function (calc) { return calc.calculation; });
            if (this.primaryIssueType === "Release") {
                timingMethods.shift();
            }
            var optionsForType = {
                baseIssues: this.rawIssues,
                priorTime: new Date(new Date().getTime() - this.compareToTime.timePrior),
                reportedStatuses: function (status) {
                    if (initiativeStatusesToShow && initiativeStatusesToShow.length) {
                        if (!initiativeStatusesToShow.includes(status)) {
                            return false;
                        }
                    }
                    return !initiativeStatusesToRemove.includes(status);
                },
                getChildWorkBreakdown: getChildWorkBreakdown,
                reportedIssueType: reportedIssueType,
                timingMethods: timingMethods
            };
            var _a = releasesAndInitiativesWithPriorTiming(optionsForType), releases = _a.releases, initiatives = _a.initiatives;
            function startBeforeDue(initiative) {
                return initiative.dateData.rollup.start < initiative.dateData.rollup.due;
            }
            if (this.hideUnknownInitiatives) {
                return {
                    initiatives: initiatives.filter(startBeforeDue),
                    releases: releases.map(function (release) {
                        return __assign(__assign({}, release), { initiatives: release.dateData.rollup.issues.filter(startBeforeDue) });
                    })
                };
            }
            else {
                return { releases: releases, initiatives: initiatives };
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimelineReport.prototype, "initiativesWithAStartAndEndDate", {
        get: function () {
            var initiatives = this.releasesAndInitiativesWithPriorTiming.initiatives;
            if (this.sortByDueDate) {
                initiatives = initiatives.toSorted(function (i1, i2) { return i1.dateData.rollup.due - i2.dateData.rollup.due; });
            }
            return initiatives;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimelineReport.prototype, "sortedIncompleteReleasesInitiativesAndEpics", {
        get: function () {
            var unsortedReleases = this.releasesAndInitiativesWithPriorTiming.releases;
            if (this.showOnlySemverReleases) {
                return semverReleases(unsortedReleases);
            }
            else {
                return sortedByLastEpicReleases(unsortedReleases);
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimelineReport.prototype, "releases", {
        get: function () {
            if (!this.rawIssues) {
                return undefined;
            }
            var data = this.sortedIncompleteReleasesInitiativesAndEpics;
            return data;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimelineReport.prototype, "primaryIssues", {
        get: function () {
            if (this.primaryIssueType === "Release") {
                return this.releases;
            }
            else {
                return this.initiativesWithAStartAndEndDate;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TimelineReport.prototype, "planningIssues", {
        get: function () {
            if (!this.rawIssues) {
                return [];
            }
            var reportedIssueType = this.primaryIssueType === "Release" ? this.secondaryIssueType : this.primaryIssueType;
            return getIssuesOfTypeAndStatus(this.rawIssues, reportedIssueType, this.planningStatuses || []);
        },
        enumerable: false,
        configurable: true
    });
    TimelineReport.prototype.prettyDate = function (date) {
        return date ? dateFormatter.format(date) : "";
    };
    TimelineReport.prototype.paddingClass = function (depth) {
        return "pl-" + (depth * 2);
    };
    TimelineReport.prototype.initiativeTeams = function (initiative) {
        return __spreadArray([], new Set(initiative.team.issues.map(function (issue) { return issue["Project key"]; })), true);
    };
    TimelineReport.prototype.showDebug = function (open) {
        this.showingDebugPanel = open;
    };
    /*teamWork(work) {
        const teamToWork = {};
        issues.forEach( issue => {
            let teamKey = issue["Project key"]
            if(!teamToWork[teamKey]) {
                teamToWork[teamKey] = 0
            }
            //teamToWork[teamKey] +=
        }) )
        const teams = [...new Set( work.issues.map( issue => issue["Project key"]) ) ];

    }*/
    TimelineReport.prototype.toggleConfiguration = function () {
        this.showingConfiguration = !this.showingConfiguration;
        var width = document.getElementById("configuration").clientWidth;
        document.querySelector(".left-config-width").style.left = (width + 16) + "px";
    };
    TimelineReport.view = "\n      <div \n          class=\"drop-shadow-lg\n          fixed left-0 z-50 overflow-auto\n          top-fullish-vh height-fullish-vh \n          bg-white flex max-w-4xl\" id=\"configuration\">\n        \n        ".concat(configurationView, "\n\n        <div on:click=\"this.toggleConfiguration()\"\n          class=\"w-8 hover:bg-gray-200 cursor-pointer bg-gray-100 \">\n        \n          {{#not(this.showingConfiguration)}}\n            <p class=\"-rotate-90 w-40 absolute\" style=\"top: 40%; left: -65px\">Configure</p>\n\n            <svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke-width=\"1.5\" stroke=\"currentColor\" data-slot=\"icon\" class=\"w-8 h-8 mt-px\">\n              <path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"m8.25 4.5 7.5 7.5-7.5 7.5\" />\n            </svg>\n\n          {{ else }}\n            <svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" stroke-width=\"1.5\" stroke=\"currentColor\" data-slot=\"icon\" class=\"w-8 h-8 mt-px\">\n              <path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M15.75 19.5 8.25 12l7.5-7.5\" />\n            </svg>\n        \n          {{/}}\n\n        </div>\n\n      </div>\n        <div class=\"w-1280 fullish-vh pt-4 left-config-width {{#this.showingConfiguration}}relative {{else}}place-center{{/}}\">\n\n        {{# not(this.loginComponent.isLoggedIn) }}\n\n          <div class=\"p-4 mb-4 drop-shadow-md hide-on-fullscreen bg-yellow-300\">\n            <p>The following is a sample report. Learn more about it in the \n              \"<a class=\"text-blue-400\" href=\"https://www.bitovi.com/academy/learn-agile-program-management-with-jira/reporting.html\">Agile Program Management with Jira</a>\" \n              training. Click \"Connect to Jira\" to load your own data.</p>\n            <p class=\"mt-2\">Checkout the following sample reports:</p>\n            <ul class=\"list-disc list-inside ml-2\">\n              <li><a class=\"text-blue-400\" href=\"?primaryIssueType=Release&hideUnknownInitiatives=true&primaryReportType=due&secondaryReportType=status\">Release end dates with initiative status</a></li>\n              <li><a class=\"text-blue-400\" href=\"?primaryIssueType=Release&hideUnknownInitiatives=true&secondaryReportType=breakdown\">Release timeline with iniative work breakdown</a></li>\n              <li><a class=\"text-blue-400\" href=\"?primaryIssueType=Initiative&hideUnknownInitiatives=true&statusesToShow=Development%2CReady&primaryReportType=breakdown\">Ready and in-development initiative work breakdown</a></li>\n            </ul>\n\n          </div>\n      {{/ not }}\n\n          <div class='p-4 rounded-lg-gray-100-on-white mb-4 drop-shadow-md color-bg-white'>\n            <p><label class=\"inline font-bold\">Compare to {{this.compareToTime.text}}</label>\n            - Specify what timepoint to use to determine if an initiative or release has fallen behind.</p>\n            <input class=\"w-full-border-box\" type='range' valueAsNumber:bind:on:input='this.timeSliderValue' min=\"0\" max=\"100\"/>\n          </div>\n\n          \n\n\n          {{# and( not(this.jql), this.loginComponent.isLoggedIn  }}\n            <div class=\"my-2 p-2 h-780 border-solid-1px-slate-900 border-box block overflow-hidden color-bg-white drop-shadow-md\">Configure a JQL in the sidebar on the left to get started.</div>\n          {{ /and }}\n\n\t\t\t\t\t{{# and(this.cvsIssuesPromise.value, this.releases) }}\n            <div class=\"my-2  border-solid-1px-slate-900 border-box block overflow-hidden color-bg-white drop-shadow-md\">\n            \n              {{# or( eq(this.primaryReportType, \"start-due\"), eq(this.primaryReportType, \"breakdown\") ) }}\n                <gantt-grid issues:from=\"this.primaryIssues\" breakdown:from=\"eq(this.primaryReportType, 'breakdown')\"></gantt-grid>\n              {{ else }}\n                <gantt-timeline issues:from=\"this.primaryIssues\"></gantt-timeline>\n              {{/ or }}\n\n              {{# or( eq(this.secondaryReportType, \"status\"), eq(this.secondaryReportType, \"breakdown\") ) }}\n                <status-report primaryIssues:from=\"this.primaryIssues\"\n                  breakdown:from=\"eq(this.secondaryReportType, 'breakdown')\"\n                  planningIssues:from=\"this.planningIssues\"></status-report>\n              {{/ }}\n\n              <div class='p-2'>\n                <span class='color-text-and-bg-unknown p-2 inline-block'>Unknown</span>\n                <span class='color-text-and-bg-new p-2 inline-block'>New</span>\n                <span class='color-text-and-bg-notstarted p-2 inline-block'>Not Started</span>\n                <span class='color-text-and-bg-ontrack p-2 inline-block'>On Track</span>\n                <span class='color-text-and-bg-ahead p-2 inline-block'>Ahead</span>\n                <span class='color-text-and-bg-behind p-2 inline-block'>Behind</span>\n                <span class='color-text-and-bg-blocked p-2 inline-block'>Blocked</span>\n                <span class='color-text-and-bg-complete p-2 inline-block'>Complete</span>\n              </div>\n            </div>\n          {{/ and }}\n          {{# if(this.cvsIssuesPromise.isPending) }}\n            <div class=\"my-2 p-2 h-780 border-solid-1px-slate-900 border-box block overflow-hidden color-bg-white drop-shadow-md\">\n              <p>Loading ...<p>\n              {{# if(this.progressData.issuesRequested)}}\n                <p>Loaded {{this.progressData.issuesReceived}} of {{this.progressData.issuesRequested}} issues.</p>\n              {{/ }}\n            </div>\n          {{/ if }}\n          {{# if(this.cvsIssuesPromise.isRejected) }}\n            <div class=\"my-2 p-2 h-780 border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked drop-shadow-md\">\n              <p>There was an error loading from Jira!</p>\n              <p>Error message: {{this.cvsIssuesPromise.reason.errorMessages[0]}}</p>\n              <p>Please check your JQL is correct!</p>\n            </div>\n          {{/ if }}\n        </div>\n  ");
    TimelineReport.props = {
        showingDebugPanel: { type: Boolean, default: false },
        timeSliderValue: {
            type: type.convert(Number),
            default: 25
        },
        progressData: type.Any,
        // default params
        defaultSearch: type.Any,
        get compareToTime() {
            var SECOND = 1000;
            var MIN = 60 * SECOND;
            var HOUR = 60 * MIN;
            var DAY = 24 * HOUR;
            if (this.timeSliderValue === 0) {
                return { timePrior: 0, text: "now" };
            }
            if (this.timeSliderValue === 1) {
                return { timePrior: 30 * SECOND, text: "30 seconds ago" };
            }
            if (this.timeSliderValue === 2) {
                return { timePrior: MIN, text: "1 minute ago" };
            }
            if (this.timeSliderValue === 3) {
                return { timePrior: 5 * MIN, text: "5 minutes ago" };
            }
            if (this.timeSliderValue === 4) {
                return { timePrior: 10 * MIN, text: "10 minutes ago" };
            }
            if (this.timeSliderValue === 5) {
                return { timePrior: 30 * MIN, text: "30 minutes ago" };
            }
            if (this.timeSliderValue === 6) {
                return { timePrior: HOUR, text: "1 hour ago" };
            }
            if (this.timeSliderValue === 7) {
                return { timePrior: 3 * HOUR, text: "3 hours ago" };
            }
            if (this.timeSliderValue === 8) {
                return { timePrior: 6 * HOUR, text: "6 hours ago" };
            }
            if (this.timeSliderValue === 9) {
                return { timePrior: 12 * HOUR, text: "12 hours ago" };
            }
            if (this.timeSliderValue === 10) {
                return { timePrior: DAY, text: "1 day ago" };
            }
            else {
                var days_1 = this.timeSliderValue - 10;
                return { timePrior: DAY * days_1, text: days_1 + " days ago" };
            }
            var days = this.timeSliderValue;
            return { timePrior: (MIN / 2) * this.timeSliderValue, text: this.timeSliderValue + " days ago" };
        },
        // REMOVE
        reportEpics: saveJSONToUrl("reportEpics", false, Boolean, booleanParsing),
        showOnlySemverReleases: saveJSONToUrl("showOnlySemverReleases", false, Boolean, booleanParsing),
        // REMOVE
        breakOutTimings: saveJSONToUrl("breakOutTimings", false, Boolean, booleanParsing),
        // remove
        showReleasesInTimeline: saveJSONToUrl("showReleasesInTimeline", false, Boolean, booleanParsing),
        loadChildren: saveJSONToUrl("loadChildren", false, Boolean, booleanParsing),
        sortByDueDate: saveJSONToUrl("sortByDueDate", false, Boolean, booleanParsing),
        hideUnknownInitiatives: saveJSONToUrl("hideUnknownInitiatives", false, Boolean, booleanParsing),
        jql: saveJSONToUrl("jql", "", String, { parse: function (x) { return "" + x; }, stringify: function (x) { return "" + x; } }),
        primaryIssueType: saveJSONToUrl("primaryIssueType", "Epic", String, { parse: function (x) { return "" + x; }, stringify: function (x) { return "" + x; } }),
        secondaryReportType: saveJSONToUrl("secondaryReportType", "none", String, { parse: function (x) { return "" + x; }, stringify: function (x) { return "" + x; } }),
        primaryReportType: saveJSONToUrl("primaryReportType", "start-due", String, { parse: function (x) { return "" + x; }, stringify: function (x) { return "" + x; } }),
        statusesToRemove: {
            get default() {
                return [];
            }
        },
        statusesToShow: {
            get default() {
                return [];
            }
        },
        planningStatuses: {
            get default() {
                return [];
            }
        },
        get secondaryIssueType() {
            if (!this.issueHierarchy) {
                return undefined;
            }
            var calculations = getImpliedTimingCalculations(this.primaryIssueType, this.issueHierarchy.typeToIssueType, this.timingCalculations);
            if (calculations.length) {
                return calculations[0].type;
            }
        },
        getReleaseValue: {
            type: Function,
            default: function (issue) {
                var _a, _b;
                return (_b = (_a = issue === null || issue === void 0 ? void 0 : issue[FIX_VERSIONS_KEY]) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.name;
            }
        },
        rawIssues: {
            async: function (resolve) {
                if (!this.cvsIssuesPromise) {
                    resolve(null);
                }
                else {
                    this.cvsIssuesPromise.then(resolve);
                }
            }
        },
        issueHierarchy: {
            value: function (_a) {
                var _this = this;
                var resolve = _a.resolve, listenTo = _a.listenTo;
                var handleRawIssuePromise = function () {
                    //console.log()
                    if (_this.loginComponent.isLoggedIn === false) {
                        bitoviTrainingData(new Date()).then(function (csvIssues) {
                            resolve(denormalizedIssueHierarchy(normalizeCSVIssues(csvIssues)));
                        });
                    }
                    else if (_this.rawIssuesPromise) {
                        _this.rawIssuesPromise.then(function (issues) { return resolve(denormalizedIssueHierarchy(normalizeAndDeriveIssues(issues))); });
                    }
                };
                listenTo("rawIssuesPromise", handleRawIssuePromise);
                listenTo(this.loginComponent, "isLoggedIn", handleRawIssuePromise);
                handleRawIssuePromise(this.rawIssuesPromise);
            }
        },
        get primaryReportingIssueHierarchy() {
            // we need to remove stories
            if (this.issueHierarchy) {
                return this.issueHierarchy.filter(function (issue) {
                    return issue.hierarchyLevel > 0;
                });
            }
        },
        get secondaryReportingIssueHierarchy() {
            // hierarchy isn't known at first
            if (!this.issueHierarchy.length) {
                return [];
            }
            var issueTypeMap = this.issueHierarchy.typeToIssueType;
            var primaryType = issueTypeMap[this.primaryIssueType];
            if (!primaryType) {
                console.warn("no primary issuetype?!?!");
                return [];
            }
            return __spreadArray([], primaryType.denormalizedChildren, true);
        },
        showingConfiguration: false,
        // [{type: "Epic", calculation: "calculationName"},{type, calculation}]
        timingCalculations: {
            value: function (_a) {
                var resolve = _a.resolve, lastSet = _a.lastSet, listenTo = _a.listenTo;
                var currentValue;
                updateValue(new URL(window.location).searchParams.get("timingCalculations"));
                listenTo(lastSet, function (value) {
                    updateValue(value);
                });
                listenTo("primaryIssueType", function () {
                    updateValue([]);
                });
                function updateValue(value) {
                    if (typeof value === "string") {
                        try {
                            value = parse(value);
                        }
                        catch (e) {
                            value = [];
                        }
                    }
                    else if (!value) {
                        value = [];
                    }
                    updateUrlParam("timingCalculations", stringify(value), stringify([]));
                    currentValue = value;
                    resolve(currentValue);
                }
                function parse(value) {
                    return value.split(",").map(function (piece) {
                        var parts = piece.split(":");
                        return { type: parts[0], calculation: parts[1] };
                    }).flat();
                }
                function stringify(array) {
                    return array.map(function (obj) { return obj.type + ":" + obj.calculation; }).join(",");
                }
            }
        },
        get firstIssueTypeWithStatuses() {
            if (this.primaryIssueType !== "Release") {
                return this.primaryIssueType;
            }
            if (!this.issueHierarchy) {
                return undefined;
            }
            var calculations = getImpliedTimingCalculations(this.primaryIssueType, this.issueHierarchy.typeToIssueType, this.timingCalculations);
            if (!calculations.length) {
                return undefined;
            }
            if (calculations[0].type !== "Release") {
                return calculations[0].type;
            }
            else {
                return calculations[1].type;
            }
        },
        // [ {type: "Initiative", types: [{type: "Epic", selected}, ...], calculations: [{calculation: "parentOnly", name, selected}]} ]
        get timingLevels() {
            if (!this.issueHierarchy) {
                return [];
            }
            var issueTypeMap = this.issueHierarchy.typeToIssueType;
            var primaryType = issueTypeMap[this.primaryIssueType];
            if (!primaryType) {
                return [];
            }
            var currentType = this.primaryIssueType;
            var childrenCalculations = primaryType.timingCalculations;
            var timingLevels = [];
            var setCalculations = __spreadArray([], this.timingCalculations, true);
            var _loop_1 = function () {
                // this is the calculation that should be selected for that level
                var setLevelCalculation = setCalculations.shift() ||
                    {
                        type: childrenCalculations[0].child,
                        calculation: childrenCalculations[0].calculations[0].calculation
                    };
                var selected = childrenCalculations.find(function (calculation) { return setLevelCalculation.type === calculation.child; });
                var timingLevel = {
                    type: currentType,
                    types: childrenCalculations.map(function (calculationsForType) {
                        return {
                            type: calculationsForType.child,
                            selected: (setLevelCalculation === null || setLevelCalculation === void 0 ? void 0 : setLevelCalculation.type) === calculationsForType.child
                        };
                    }),
                    calculations: selected.calculations.map(function (calculation) {
                        return __assign(__assign({}, calculation), { selected: calculation.calculation === setLevelCalculation.calculation });
                    })
                };
                timingLevels.push(timingLevel);
                currentType = setLevelCalculation.type;
                childrenCalculations = issueTypeMap[setLevelCalculation.type].timingCalculations;
            };
            while (childrenCalculations.length) {
                _loop_1();
            }
            return timingLevels;
        }
    };
    return TimelineReport;
}(StacheElement));
export { TimelineReport };
customElements.define("timeline-report", TimelineReport);
function filterByIssueType(issues, issueType) {
    return issues.filter(function (issue) { return issue[ISSUE_TYPE_KEY] === issueType; });
}
function getIssuesOfTypeAndStatus(issues, type, statuses) {
    return issues.filter(function (issue) {
        return issue["Issue Type"] === type && statuses.includes(issue.Status);
    });
}
function goodStuffFromIssue(issue) {
    var _a;
    return _a = {
            Summary: issue.Summary
        },
        _a[ISSUE_KEY] = issue[ISSUE_KEY],
        _a;
}
function filterReleases(issues, getReleaseValue) {
    return issues.filter(function (issue) { return getReleaseValue(issue); });
}
function filterOutReleases(issues, getReleaseValue) {
    return issues.filter(function (issue) { return !getReleaseValue(issue); });
}
function filterPlanningAndReady(issues) {
    return issues.filter(function (issue) { return ["Ready", "Planning"].includes(issue.Status); });
}
function mapReleasesToIssues(issues, getReleaseValue) {
    var map = {};
    issues.forEach(function (issue) {
        var release = getReleaseValue(issue);
        if (!map[release]) {
            map[release] = [];
        }
        map[release].push(issue);
    });
    return map;
}
function makeIssueMap(issues) {
    if (typeof issues === "object" && !Array.isArray(issues)) {
        return issues;
    }
    var map = {};
    issues.forEach(function (i) {
        map[i[ISSUE_KEY]] = i;
    });
    return map;
}
function getChildrenOf(issue, issuesOrIssueMap) {
    var children = [];
    var issueMap = makeIssueMap(issuesOrIssueMap);
    for (var issueKey in issueMap) {
        var possibleChild = issueMap[issueKey];
        if (possibleChild[PARENT_LINK_KEY] === issue[ISSUE_KEY]) {
            children.push(possibleChild);
        }
    }
    return children;
}
function getChildWorkBreakdown(children) {
    if (children === void 0) { children = []; }
    var qaWork = new Set(filterQAWork(children));
    var uatWork = new Set(filterPartnerReviewWork(children));
    var devWork = children.filter(function (epic) { return !qaWork.has(epic) && !uatWork.has(epic); });
    return { qaWork: qaWork, uatWork: uatWork, devWork: devWork };
}
function sortReadyFirst(initiatives) {
    return initiatives.sort(function (a, b) {
        if (a.Status === "Ready") {
            return -1;
        }
        return 1;
    });
}
function newDateFromYYYYMMDD(dateString) {
    var _a = dateString.split("-"), year = _a[0], month = _a[1], day = _a[2];
    return new Date(year, month - 1, day);
}
function addTeamBreakdown(release) {
    return __assign({}, release);
}
// ontrack
// behind
// complete
function getElementPosition(el) {
    var rect = el.getBoundingClientRect();
    var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    return { x: rect.left + scrollLeft, y: rect.top + scrollTop };
}
function updateFullishHeightSection() {
    var position = getElementPosition(document.querySelector('.fullish-vh'));
    document.documentElement.style.setProperty('--fullish-document-top', "".concat(position.y, "px"));
}
window.addEventListener('load', updateFullishHeightSection);
window.addEventListener('resize', updateFullishHeightSection);
var typesToHierarchyLevel = { Epic: 1, Story: 0, Initiative: 2 };
function normalizeCSVIssues(cvsIssues) {
    var res = cvsIssues.map(function (issue) {
        return __assign(__assign({}, issue), { fields: __assign(__assign({}, issue), { "Parent Link": { data: issue["Parent Link"] }, "Issue Type": { name: issue["Issue Type"], hierarchyLevel: typesToHierarchyLevel[issue["Issue Type"]] } }), key: issue["Issue key"] });
    });
    return normalizeAndDeriveIssues(res);
}
