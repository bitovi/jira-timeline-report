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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { StacheElement, type, ObservableObject, ObservableArray, value } from "../can.js";
import { saveJSONToUrl, updateUrlParam } from "../shared/state-storage.js";
import { calculationKeysToNames, allTimingCalculationOptions, getImpliedTimingCalculations } from "../prepare-issues/date-data.js";
import { rawIssuesRequestData, configurationPromise, derivedIssuesRequestData } from "../state/issue-data.js";
import { percentComplete } from "../percent-complete/percent-complete.js";
import { allStatusesSorted } from "../shared/issue-data/issue-data.js";
import "../status-filter.js";
var booleanParsing = {
    parse: function (x) {
        return ({ "": true, "true": true, "false": false })[x];
    },
    stringify: function (x) { return "" + x; }
};
var selectStyle = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";
var TimelineConfiguration = /** @class */ (function (_super) {
    __extends(TimelineConfiguration, _super);
    function TimelineConfiguration() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    // HOOKS
    TimelineConfiguration.prototype.connected = function () {
        this.listenTo("percentComplete", function () { });
    };
    // METHODS
    TimelineConfiguration.prototype.updateCalculationType = function (index, value) {
        var copyCalculations = __spreadArray([], getImpliedTimingCalculations(this.primaryIssueType, this.allTimingCalculationOptions.map, this.timingCalculations), true).slice(0, index + 1);
        copyCalculations[index].type = value;
        this.timingCalculations = copyCalculations;
    };
    TimelineConfiguration.prototype.updateCalculation = function (index, value) {
        var copyCalculations = __spreadArray([], getImpliedTimingCalculations(this.primaryIssueType, this.allTimingCalculationOptions.map, this.timingCalculations), true).slice(0, index + 1);
        copyCalculations[index].calculation = value;
        this.timingCalculations = copyCalculations;
    };
    // UI Helpers
    TimelineConfiguration.prototype.paddingClass = function (depth) {
        return "pl-" + (depth * 2);
    };
    TimelineConfiguration.view = "\n        <p>\n            Questions on the options? \n            <a class=\"link\" href=\"https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#getting-started\">Read the guide</a>, or \n            <a class=\"link\" href=\"https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#need-help-or-have-questions\">connect with us</a>.\n        </p>  \n        <h3 class=\"h3\">Issue Source</h3>\n        <p>Specify a JQL that loads all issues you want to report on and help determine the timeline of your report.</p>\n        <p>\n            {{# if(this.isLoggedIn) }}\n            <input class=\"w-full-border-box mt-2 form-border p-1\" value:bind='this.jql'/>\n            {{ else }}\n            <input class=\"w-full-border-box mt-2 form-border p-1 text-yellow-300\" value=\"Sample data. Connect to Jira to specify.\" disabled/>\n            {{/ if}}\n        </p>\n        {{# if(this.rawIssuesRequestData.issuesPromise.isPending) }}\n            {{# if(this.rawIssuesRequestData.progressData.issuesRequested)}}\n            <p class=\"text-xs text-right\">Loaded {{this.rawIssuesRequestData.progressData.issuesReceived}} of {{this.rawIssuesRequestData.progressData.issuesRequested}} issues</p>\n            {{ else }}\n            <p class=\"text-xs text-right\">Loading issues ...</p>\n            {{/ if}}\n        {{/ if }}\n        {{# if(this.rawIssuesRequestData.issuesPromise.isRejected) }}\n            <div class=\"border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked p-1\">\n            <p>There was an error loading from Jira!</p>\n            <p>Error message: {{this.rawIssuesRequestData.issuesPromise.reason.errorMessages[0]}}</p>\n            <p>Please check your JQL is correct!</p>\n            </div>\n        {{/ if }}\n        <div class=\"flex justify-between mt-1\">\n\n            <p class=\"text-xs\"><input type='checkbox' \n            class='self-start align-middle' checked:bind='this.loadChildren'/> <span class=\"align-middle\">Load all children of JQL specified issues</span>\n            </p>\n            \n            {{# if(this.rawIssuesRequestData.issuesPromise.isResolved) }}\n            <p class=\"text-xs\">Loaded {{this.rawIssuesRequestData.issuesPromise.value.length}} issues</p>\n            {{/ if }}\n        </div>\n        \n\n        <h3 class=\"h3 mt-4\">Primary Timeline</h3>\n        <div class=\"flex mt-2 gap-2 flex-wrap\">\n            {{# if(this.allTimingCalculationOptions) }}\n            <p>What Jira artifact do you want to report on?</p>\n            <div class=\"shrink-0\">\n            {{# for(issueType of this.allTimingCalculationOptions.list) }}\n            <label class=\"px-2\"><input \n                type=\"radio\" \n                name=\"primaryIssueType\" \n                checked:from=\"eq(this.primaryIssueType, issueType.type)\"\n                on:change=\"this.primaryIssueType = issueType.type\"/> {{issueType.plural}} </label>\n            {{/ }}\n            </div>\n            {{/ if }}\n            \n            \n        </div>\n\n        <div class=\"flex mt-2 gap-2 flex-wrap\">\n            <p>What timing data do you want to report?</p>\n            <div class=\"shrink-0\">\n            <label class=\"px-2\"><input \n                type=\"radio\" \n                name=\"primaryReportType\"\n                checked:from=\"eq(this.primaryReportType, 'start-due')\"\n                on:change=\"this.primaryReportType = 'start-due'\"\n                /> Start and due dates </label>\n            <label class=\"px-2\"><input \n                type=\"radio\" \n                name=\"primaryReportType\"\n                checked:from=\"eq(this.primaryReportType, 'due')\"\n                on:change=\"this.primaryReportType = 'due'\"\n                /> Due dates only</label>\n            <label class=\"px-2\"><input \n                type=\"radio\" \n                name=\"primaryReportType\"\n                checked:from=\"eq(this.primaryReportType, 'breakdown')\"\n                on:change=\"this.primaryReportType = 'breakdown'\"\n                /> Work breakdown</label>\n            </div>\n        </div>\n\n        <div class=\"flex mt-2 gap-2 flex-wrap\">\n            <p>Do you want to report on completion percentage?</p>\n            <input type='checkbox' \n                class='self-start mt-1.5'  checked:bind='this.showPercentComplete'/>\n        </div>\n\n\n        <h3 class=\"h3\">Timing Calculation</h3>\n        <div class=\"grid gap-2 my-2\" style=\"grid-template-columns: auto auto auto;\">\n            <div class=\"text-sm py-1 text-slate-600 font-semibold\" style=\"grid-column: 1 / span 1; grid-row: 1 / span 1;\">Parent Type</div>\n            <div class=\"text-sm py-1 text-slate-600 font-semibold\" style=\"grid-column: 2 / span 1; grid-row: 1 / span 1;\">Child Type</div>\n            <div class=\"text-sm py-1 text-slate-600 font-semibold\" style=\"grid-column: 3 / span 1; grid-row: 1 / span 1;\">How is timing calculated between parent and child?</div>\n            <div class=\"border-b-2 border-neutral-40\" style=\"grid-column: 1 / span 3; grid-row: 1 / span 1;\"></div>\n\n            {{# for(timingLevel of this.timingLevels) }}\n\n                <label class=\"pr-2 py-2 {{ this.paddingClass(scope.index) }}\">{{timingLevel.type}}</label>\n                {{# eq(timingLevel.types.length, 1) }}\n                <span class=\"p-2\">{{timingLevel.types[0].type}}</span>\n                {{ else }}\n                <select class=\"".concat(selectStyle, "\" on:change=\"this.updateCalculationType(scope.index, scope.element.value)\">\n                    {{# for(type of timingLevel.types) }}\n                    <option {{# if(type.selected) }}selected{{/ if }}>{{type.type}}</option>\n                    {{/ for }}\n                </select>\n                {{/ eq}}\n\n                <select class=\"").concat(selectStyle, "\" on:change=\"this.updateCalculation(scope.index, scope.element.value)\">\n                {{# for(calculation of timingLevel.calculations) }}\n                    <option {{# if(calculation.selected) }}selected{{/ if }} value=\"{{calculation.calculation}}\">{{calculation.name}}</option>\n                {{/ for }}\n                </select>\n\n            {{/ for }}\n            \n        </div>\n        {{# if(this.primaryIssueType) }}\n        <h3 class=\"h3\">Filters</h3>\n\n        <div class=\"grid gap-3\" style=\"grid-template-columns: max-content max-content 1fr\">\n\n            <label class=''>Hide Unknown {{this.primaryIssueType}}s</label>\n            <input type='checkbox' \n            class='self-start mt-1.5' checked:bind='this.hideUnknownInitiatives'/>\n            <p class=\"m-0\">Hide {{this.primaryIssueType}}s whose timing can't be determined.\n            </p>\n\n            <label>{{this.firstIssueTypeWithStatuses}} Statuses to Report</label>\n            <status-filter \n                statuses:from=\"this.statuses\"\n                param:raw=\"statusesToShow\"\n                selectedStatuses:to=\"this.statusesToShow\"\n                style=\"max-width: 400px;\">\n            </status-filter>\n            <p>Only include these statuses in the report</p>\n\n            <label>{{this.firstIssueTypeWithStatuses}} Statuses to Ignore</label>\n            <status-filter \n                statuses:from=\"this.statuses\" \n                param:raw=\"statusesToRemove\"\n                selectedStatuses:to=\"this.statusesToRemove\"\n                style=\"max-width: 400px;\">\n                </status-filter>\n            <p>Search for statuses to remove from the report</p>\n\n            {{# eq(this.primaryIssueType, \"Release\") }}\n            <label class=''>Show Only Semver Releases</label>\n            <input type='checkbox' \n                class='self-start mt-1.5'  checked:bind='this.showOnlySemverReleases'/>\n            <p class=\"m-0\">This will only include releases that have a structure like <code>[NAME]_[D.D.D]</code>. Examples:\n            <code>ACME_1.2.3</code>, <code>ACME_CHECKOUT_1</code>, <code>1.2</code>.\n            </p>\n            {{/ }}\n\n\n        </div>\n        {{/ if }}\n\n        <h3 class=\"h3\">Sorting</h3>\n        <div class=\"grid gap-3\" style=\"grid-template-columns: max-content max-content 1fr\">\n            <label class=''>Sort by Due Date</label>\n            <input type='checkbox' \n                class='self-start mt-1.5' checked:bind='this.sortByDueDate'/>\n            <p class=\"m-0\">Instead of ordering initiatives based on the order defined in the JQL, \n            sort initiatives by their last epic's due date.\n            </p>\n        </div>\n\n        <h3 class=\"h3\">Secondary Status Report</h3>\n        <div class=\"flex mt-2 gap-2 flex-wrap\">\n            <p>Secondary Report Type</p>\n            <div class=\"shrink-0\">\n            <label class=\"px-2\"><input \n                type=\"radio\" \n                name=\"secondary\" \n                checked:from=\"eq(this.secondaryReportType, 'none')\"\n                on:change=\"this.secondaryReportType = 'none'\"\n                /> None </label>\n                \n            <label class=\"px-2\"><input \n                type=\"radio\" \n                name=\"secondary\" \n                checked:from=\"eq(this.secondaryReportType, 'status')\"\n                on:change=\"this.secondaryReportType = 'status'\"\n                /> {{this.secondaryIssueType}} status </label>\n            \n            {{# not(eq(this.secondaryIssueType, \"Story\") ) }}\n            <label class=\"px-2\"><input \n                type=\"radio\" \n                name=\"secondary\" \n                checked:from=\"eq(this.secondaryReportType, 'breakdown')\"\n                on:change=\"this.secondaryReportType = 'breakdown'\"\n                /> {{this.secondaryIssueType}} work breakdown </label>\n            {{/ not }}\n            </div>\n        </div>\n        {{# if(this.firstIssueTypeWithStatuses) }}\n        <div class=\"flex gap-2 mt-1\">\n            <label>{{this.firstIssueTypeWithStatuses}} statuses to show as planning:</label>\n            <status-filter \n            statuses:from=\"this.statuses\" \n            param:raw=\"planningStatuses\"\n            selectedStatuses:to=\"this.planningStatuses\"\n            style=\"max-width: 400px;\"></status-filter>\n        </div>\n        {{/ if}}");
    TimelineConfiguration.props = {
        // passed
        // "base" values that do not change when other value change
        jql: saveJSONToUrl("jql", "", String, { parse: function (x) { return "" + x; }, stringify: function (x) { return "" + x; } }),
        loadChildren: saveJSONToUrl("loadChildren", false, Boolean, booleanParsing),
        secondaryReportType: saveJSONToUrl("secondaryReportType", "none", String, { parse: function (x) { return "" + x; }, stringify: function (x) { return "" + x; } }),
        primaryReportType: saveJSONToUrl("primaryReportType", "start-due", String, { parse: function (x) { return "" + x; }, stringify: function (x) { return "" + x; } }),
        showPercentComplete: saveJSONToUrl("showPercentComplete", false, Boolean, booleanParsing),
        sortByDueDate: saveJSONToUrl("sortByDueDate", false, Boolean, booleanParsing),
        hideUnknownInitiatives: saveJSONToUrl("hideUnknownInitiatives", false, Boolean, booleanParsing),
        // VALUES DERIVING FROM THE `jql`
        rawIssuesRequestData: {
            value: function (_a) {
                var listenTo = _a.listenTo, resolve = _a.resolve;
                return rawIssuesRequestData({
                    jql: value.from(this, "jql"),
                    loadChildren: value.from(this, "loadChildren"),
                    isLoggedIn: value.from(this, "isLoggedIn"),
                    jiraHelpers: this.jiraHelpers
                }, { listenTo: listenTo, resolve: resolve });
            }
        },
        get serverInfoPromise() {
            return this.jiraHelpers.getServerInfo();
        },
        get configurationPromise() {
            return configurationPromise({ teamConfigurationPromise: this.teamConfigurationPromise, serverInfoPromise: this.serverInfoPromise });
        },
        derivedIssuesRequestData: {
            value: function (_a) {
                var listenTo = _a.listenTo, resolve = _a.resolve;
                return derivedIssuesRequestData({
                    rawIssuesRequestData: value.from(this, "rawIssuesRequestData"),
                    configurationPromise: value.from(this, "configurationPromise")
                }, { listenTo: listenTo, resolve: resolve });
            }
        },
        get derivedIssuesPromise() {
            return this.derivedIssuesRequestData.issuesPromise;
        },
        derivedIssues: {
            async: function () {
                return this.derivedIssuesRequestData.issuesPromise;
            }
        },
        // PROPERTIES DERIVING FROM `derivedIssues`
        get statuses() {
            if (this.derivedIssues) {
                console.log("here");
                return allStatusesSorted(this.derivedIssues);
            }
            else {
                return [];
            }
        },
        allTimingCalculationOptions: {
            async: function (resolve) {
                if (this.derivedIssuesRequestData.issuesPromise) {
                    return this.derivedIssuesRequestData.issuesPromise.then(function (issues) {
                        return allTimingCalculationOptions(issues);
                    });
                }
            }
        },
        // primary issue type depends on allTimingCalculationOptions
        // but it can also be set itself
        primaryIssueType: {
            value: function (_a) {
                var resolve = _a.resolve, lastSet = _a.lastSet, listenTo = _a.listenTo;
                var currentPrimaryIssueType = new URL(window.location).searchParams.get("primaryIssueType");
                listenTo("allTimingCalculationOptions", function (_a) {
                    var value = _a.value;
                    reconcileCurrentValue(value, currentPrimaryIssueType);
                });
                listenTo(lastSet, function (value) {
                    setCurrentValue(value);
                });
                //setCurrentValue(new URL(window.location).searchParams.get("primaryIssueType") )
                reconcileCurrentValue(this.allTimingCalculationOptions, currentPrimaryIssueType);
                function reconcileCurrentValue(calculationOptions, primaryIssueType) {
                    // if we've actually loaded some stuff, but it doesn't match the current primary issue type
                    if (calculationOptions && calculationOptions.list.length > 1) {
                        if (calculationOptions.map[primaryIssueType]) {
                            // do nothing
                            resolve(primaryIssueType);
                        }
                        else {
                            updateUrlParam("primaryIssueType", "", "");
                            resolve(currentPrimaryIssueType = calculationOptions.list[1].type);
                        }
                        // default to the thing after release
                    }
                    else {
                        // folks can wait on the value until we know we have a valid one
                        resolve(undefined);
                    }
                }
                function setCurrentValue(value) {
                    currentPrimaryIssueType = value;
                    updateUrlParam("primaryIssueType", value, "");
                    // calculationOptions ... need to pick the right one if empty
                    resolve(value);
                }
            }
        },
        // PROPERTIES only needing primaryIssue type and what it depends on
        // looks like [{type: "initiative", calculation: "children-only"}, ...]
        // in the URL like ?timingCalculations=initiative:children-only,epic:self
        timingCalculations: {
            value: function (_a) {
                var resolve = _a.resolve, lastSet = _a.lastSet, listenTo = _a.listenTo;
                var currentValue;
                updateValue(new URL(window.location).searchParams.get("timingCalculations"));
                listenTo(lastSet, function (value) {
                    updateValue(value);
                });
                // reset when primary issue type changes
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
        // PROPERTIES from having a primaryIssueType and timingCalculations
        get firstIssueTypeWithStatuses() {
            if (this.primaryIssueType) {
                if (this.primaryIssueType !== "Release") {
                    return this.primaryIssueType;
                }
                else {
                    // timing calculations lets folks "skip" from release to some other child
                    var calculations = getImpliedTimingCalculations(this.primaryIssueType, this.allTimingCalculationOptions.map, this.timingCalculations);
                    if (calculations[0].type !== "Release") {
                        return calculations[0].type;
                    }
                    else {
                        return calculations[1].type;
                    }
                }
            }
        },
        // used to get the name of the secondary issue type
        get secondaryIssueType() {
            if (this.primaryIssueType) {
                var calculations = getImpliedTimingCalculations(this.primaryIssueType, this.allTimingCalculationOptions.map, this.timingCalculations);
                if (calculations.length) {
                    return calculations[0].type;
                }
            }
        },
        get timingCalculationMethods() {
            if (this.primaryIssueType) {
                return getImpliedTimingCalculations(this.primaryIssueType, this.allTimingCalculationOptions.map, this.timingCalculations)
                    .map(function (calc) { return calc.calculation; });
            }
        },
        get timingLevels() {
            if (this.primaryIssueType) {
                return getTimingLevels(this.allTimingCalculationOptions.map, this.primaryIssueType, this.timingCalculations);
            }
        },
        // dependent on primary issue type
        showOnlySemverReleases: saveJSONToUrl("showOnlySemverReleases", false, Boolean, booleanParsing),
        // STATUS FILTERING STUFF
        planningStatuses: {
            get default() {
                return [];
            }
        },
        // used for later filtering
        // but the options come from the issues
        statusesToRemove: {
            get default() {
                return [];
            }
        },
        statusesToShow: {
            get default() {
                return [];
            }
        }
    };
    return TimelineConfiguration;
}(StacheElement));
export { TimelineConfiguration };
// jql => 
//    
//    rawIssues => 
//        typeToIssueType
// timingCalculations 
// firstIssueTypeWithStatuses(primaryIssueType, typeToIssueType, timingCalculations)
// primaryIssueType
customElements.define("timeline-configuration", TimelineConfiguration);
/**
 * @type {{
 *   type: string,
 *   calculation: string
 * }} TimingCalculation
 */
/**
 *
 * @param {TimingCalculationsMap} issueTypeMap
 * @param {string} primaryIssueType
 * @param {Array<TimingCalculation>} timingCalculations
 * @returns
 */
function getTimingLevels(issueTypeMap, primaryIssueType, timingCalculations) {
    var primaryType = issueTypeMap[primaryIssueType];
    var currentType = primaryIssueType;
    var childrenCalculations = primaryType.timingCalculations;
    var timingLevels = [];
    var setCalculations = __spreadArray([], timingCalculations, true);
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
