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
// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache } from "./can.js";
import { showTooltip, showTooltipContent } from "./issue-tooltip.js";
import { percentComplete } from "./percent-complete/percent-complete.js";
/*
import { getCalendarHtml, getQuarter, getQuartersAndMonths } from "./quarter-timeline.js";
import { howMuchHasDueDateMovedForwardChangedSince, DAY_IN_MS } from "./date-helpers.js";

const dateFormatter = new Intl.DateTimeFormat('en-US', { day: "numeric", month: "short" })

const inQAStatus = { "QA": true, "In QA": true };
const inDevStatus = { "In Development": true, "Development": true };
const inPartnerReviewStatus = { "Partner Review": true };
const inDoneStatus = { "Done": true };

import SimpleTooltip from "./shared/simple-tooltip.js";

const TOOLTIP = new SimpleTooltip();
document.body.append(TOOLTIP);*/
var percentCompleteTooltip = stache("\n    <button class=\"remove-button\">\u274C</button>\n    <div class=\"grid gap-2\" style=\"grid-template-columns: auto repeat(4, auto);\">\n\n            <div class=\"font-bold\">Summary</div>\n            <div class=\"font-bold\">Percent Complete</div>\n            <div class=\"font-bold\">Completed Working Days</div>\n            <div class=\"font-bold\">Remaining Working Days</div>\n            <div class=\"font-bold\">Total Working Days</div>\n        \n            <div class=\"truncate max-w-96\">{{this.issue.Summary}}</div>\n            <div class=\"text-right\">{{this.getPercentComplete(this.issue)}}</div>\n            <div class=\"text-right\">{{this.round( this.issue.completionRollup.completedWorkingDays) }}</div>\n            <div class=\"text-right\">{{this.round(this.issue.completionRollup.remainingWorkingDays)}}</div>\n            <div class=\"text-right\">{{this.round(this.issue.completionRollup.totalWorkingDays)}}</div>\n        \n        {{# for(child of this.children) }}\n       \n            <div class=\"pl-4 truncate max-w-96\"><a href=\"{{child.url}}\" class=\"link\">{{child.summary}}</a></div>\n            <div class=\"text-right\">{{this.getPercentComplete(child)}}</div>\n            <div class=\"text-right\">{{this.round(child.completionRollup.completedWorkingDays)}}</div>\n            <div class=\"text-right\">{{this.round(child.completionRollup.remainingWorkingDays)}}</div>\n            <div class=\"text-right\">{{this.round(child.completionRollup.totalWorkingDays)}}</div>\n       \n        {{/ for }}\n   </div>\n");
import { rollupDatesFromRollups } from "./prepare-issues/date-data.js";
import { getQuartersAndMonths } from "./quarter-timeline.js";
// loops through and creates 
var GanttGrid = /** @class */ (function (_super) {
    __extends(GanttGrid, _super);
    function GanttGrid() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Object.defineProperty(GanttGrid.prototype, "percentComplete", {
        get: function () {
            if (this.derivedIssues) {
                return percentComplete(this.derivedIssues);
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(GanttGrid.prototype, "issuesWithPercentComplete", {
        get: function () {
            if (this.showPercentComplete && this.percentComplete) {
                var percentComplete_1 = this.percentComplete;
                var idToIssue_1 = {};
                for (var _i = 0, _a = percentComplete_1.issues; _i < _a.length; _i++) {
                    var issue = _a[_i];
                    issue.completionRollup.totalWorkingDays;
                    idToIssue_1[issue.key] = issue;
                }
                return this.issues.map(function (issue) {
                    var issueData = idToIssue_1[issue["Issue key"]];
                    return __assign(__assign({}, issue), { completionRollup: issueData ? issueData.completionRollup : {} });
                });
            }
            else {
                return this.issues;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(GanttGrid.prototype, "lotsOfIssues", {
        get: function () {
            return this.issues.length > 20 && !this.breakdown;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(GanttGrid.prototype, "textSize", {
        get: function () {
            return this.lotsOfIssues ? "text-xs pt-1 pb-0.5 px-1" : "p-1";
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(GanttGrid.prototype, "bigBarSize", {
        get: function () {
            return this.lotsOfIssues ? "h-4" : "h-6";
        },
        enumerable: false,
        configurable: true
    });
    GanttGrid.prototype.getPercentComplete = function (issue) {
        if (this.showPercentComplete && this.percentComplete) {
            return Math.round(issue.completionRollup.completedWorkingDays * 100 / issue.completionRollup.totalWorkingDays) + "%";
        }
        else {
            return "";
        }
    };
    GanttGrid.prototype.showTooltip = function (event, issue) {
        showTooltip(event.currentTarget, issue);
    };
    GanttGrid.prototype.showPercentCompleteTooltip = function (event, issue) {
        // we should get all the children ...
        var keyToChildren = Object.groupBy(this.percentComplete.issues, function (i) { return i.parentKey; });
        var children = keyToChildren[issue["Issue key"]];
        showTooltipContent(event.currentTarget, percentCompleteTooltip({ issue: issue, children: children, getPercentComplete: this.getPercentComplete.bind(this),
            round: Math.round }));
    };
    GanttGrid.prototype.classForSpecialStatus = function (status) {
        if (status === "complete") {
            return "color-text-" + status;
        }
        else if (status === "blocked") {
            return "color-text-" + status;
        }
        else {
            return "";
        }
    };
    GanttGrid.prototype.plus = function (first, second) {
        return first + second;
    };
    GanttGrid.prototype.lastRowBorder = function (index) {
        return index === this.quartersAndMonths.months.length - 1 ? "border-r-solid-1px-slate-900" : "";
    };
    Object.defineProperty(GanttGrid.prototype, "quartersAndMonths", {
        get: function () {
            var _a = rollupDatesFromRollups(this.issues), start = _a.start, due = _a.due;
            // nothing has timing
            if (!start) {
                start = new Date();
            }
            if (!due) {
                due = new Date(start.getTime() + 1000 * 60 * 60 * 24 * 90);
            }
            return getQuartersAndMonths(new Date(), due);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(GanttGrid.prototype, "todayMarginLeft", {
        get: function () {
            var _a = this.quartersAndMonths, firstDay = _a.firstDay, lastDay = _a.lastDay;
            var totalTime = (lastDay - firstDay);
            return (new Date() - firstDay - 1000 * 60 * 60 * 24 * 2) / totalTime * 100;
        },
        enumerable: false,
        configurable: true
    });
    GanttGrid.prototype.getReleaseTimeline = function (release, index) {
        var base = {
            gridColumn: '3 / span ' + this.quartersAndMonths.months.length,
            gridRow: "".concat(index + 3),
        };
        var background = document.createElement("div");
        Object.assign(background.style, __assign(__assign({}, base), { zIndex: 0 }));
        background.className = (index % 2 ? "color-bg-gray-20" : "");
        var root = document.createElement("div");
        var lastPeriodRoot = document.createElement("div");
        root.appendChild(lastPeriodRoot);
        Object.assign(root.style, __assign(__assign({}, base), { position: "relative", zIndex: 20 }));
        root.className = "py-1";
        Object.assign(lastPeriodRoot.style, {
            position: "absolute",
            top: "0",
            left: "0",
            right: "0",
            bottom: "0",
        });
        lastPeriodRoot.className = "py-1 lastPeriod";
        var _a = this.quartersAndMonths, firstDay = _a.firstDay, lastDay = _a.lastDay;
        var totalTime = (lastDay - firstDay);
        if (release.dateData.rollup.start && release.dateData.rollup.due) {
            function getPositions(work) {
                if (work.start == null && work.due == null) {
                    return {
                        start: 0, end: Infinity, startExtends: false, endExtends: false,
                        style: {
                            marginLeft: "1px",
                            marginRight: "1px"
                        }
                    };
                }
                var start = Math.max(firstDay, work.start);
                var end = Math.min(lastDay, work.due);
                var startExtends = work.start < firstDay;
                var endExtends = work.due > lastDay;
                return {
                    start: start,
                    end: end,
                    startExtends: startExtends,
                    endExtends: endExtends,
                    style: {
                        width: Math.max((((end - start) / totalTime) * 100), 0) + "%",
                        marginLeft: "max(" + (((start - firstDay) / totalTime) * 100) + "%, 1px)"
                    }
                };
            }
            function makeLastPeriodElement(status, timing) {
                var behindTime = document.createElement("div");
                behindTime.style.backgroundClip = "content-box";
                behindTime.style.opacity = "0.9";
                behindTime.style.position = "relative";
                behindTime.className = "border-y-solid-1px";
                if (timing && status === "behind") {
                    Object.assign(behindTime.style, getPositions(timing || {}).style);
                    behindTime.style.zIndex = 1;
                    behindTime.classList.add("color-text-and-bg-behind-last-period");
                }
                if (timing && status === "ahead") {
                    Object.assign(behindTime.style, getPositions(timing || {}).style);
                    behindTime.classList.add("color-text-and-bg-ahead-last-period");
                    behindTime.style.zIndex = -1;
                }
                return behindTime;
            }
            if (this.breakdown) {
                var lastDev = makeLastPeriodElement(release.dateData.dev.status, release.dateData.dev.lastPeriod);
                lastDev.classList.add("h-2", "py-[2px]");
                lastPeriodRoot.appendChild(lastDev);
                var dev = document.createElement("div");
                dev.className = "dev_time h-2 border-y-solid-1px-white color-text-and-bg-" + release.dateData.dev.status;
                Object.assign(dev.style, getPositions(release.dateData.dev).style);
                root.appendChild(dev);
                if (this.hasQAEpic) {
                    var lastQA = makeLastPeriodElement(release.dateData.qa.status, release.dateData.qa.lastPeriod);
                    lastQA.classList.add("h-2", "py-[2px]");
                    lastPeriodRoot.appendChild(lastQA);
                    var qa = document.createElement("div");
                    qa.className = "qa_time h-2 border-y-solid-1px-white color-text-and-bg-" + release.dateData.qa.status;
                    Object.assign(qa.style, getPositions(release.dateData.qa).style);
                    root.appendChild(qa);
                }
                if (this.hasUATEpic) {
                    var lastUAT = makeLastPeriodElement(release.dateData.uat.status, release.dateData.uat.lastPeriod);
                    lastUAT.classList.add("h-2", "py-[2px]");
                    lastPeriodRoot.appendChild(lastUAT);
                    var uat = document.createElement("div");
                    uat.className = "uat_time h-2 border-y-solid-1px-white color-text-and-bg-" + release.dateData.uat.status;
                    Object.assign(uat.style, getPositions(release.dateData.uat).style);
                    root.appendChild(uat);
                }
            }
            else {
                var behindTime = makeLastPeriodElement(release.dateData.rollup.status, release.dateData.rollup.lastPeriod);
                behindTime.classList.add(this.bigBarSize, "py-1");
                lastPeriodRoot.appendChild(behindTime);
                var team = document.createElement("div");
                team.className = this.bigBarSize + " border-y-solid-1px-white color-text-and-bg-" + release.dateData.rollup.status;
                Object.assign(team.style, getPositions(release.dateData.rollup).style);
                team.style.opacity = "0.9";
                root.appendChild(team);
            }
        }
        var frag = document.createDocumentFragment();
        frag.appendChild(background);
        frag.appendChild(root);
        return stache.safeString(frag);
    };
    Object.defineProperty(GanttGrid.prototype, "hasQAEpic", {
        get: function () {
            if (this.issues) {
                return this.issues.some(function (initiative) { return initiative.dateData.qa.issues.length; });
            }
            else {
                return true;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(GanttGrid.prototype, "hasUATEpic", {
        get: function () {
            if (this.issues) {
                return this.issues.some(function (initiative) { return initiative.dateData.uat.issues.length; });
            }
            else {
                return true;
            }
        },
        enumerable: false,
        configurable: true
    });
    GanttGrid.view = "\n        <div style=\"display: grid; grid-template-columns: auto auto repeat({{this.quartersAndMonths.months.length}}, [col] 1fr); grid-template-rows: repeat({{this.issues.length}}, auto)\"\n            class='p-2 mb-10'>\n            <div></div><div></div>\n\n            {{# for(quarter of this.quartersAndMonths.quarters) }}\n                <div style=\"grid-column: span 3\" class=\"text-center\">{{quarter.name}}</div>\n            {{ / for }}\n\n            <div></div><div></div>\n            {{# for(month of this.quartersAndMonths.months)}}\n                <div class='border-b border-neutral-80 text-center'>{{month.name}}</div>\n            {{/ for }}\n\n            <!-- CURRENT TIME BOX -->\n            <div style=\"grid-column: 3 / span {{this.quartersAndMonths.months.length}}; grid-row: 3 / span {{this.issues.length}};\">\n                <div class='today' style=\"margin-left: {{this.todayMarginLeft}}%; width: 1px; background-color: orange; z-index: 1000; position: relative; height: 100%;\"></div>\n            </div>\n\n\n            <!-- VERTICAL COLUMNS -->\n            {{# for(month of this.quartersAndMonths.months)}}\n                <div style=\"grid-column: {{ plus(scope.index, 3) }}; grid-row: 3 / span {{this.issues.length}}; z-index: 10\"\n                    class='border-l border-b border-neutral-80 {{this.lastRowBorder(scope.index)}}'></div>\n            {{/ for }}\n\n            <!-- Each of the issues -->\n            {{# for(issue of this.issuesWithPercentComplete) }}\n                <div on:click='this.showTooltip(scope.event, issue)' \n                    class='pointer border-y-solid-1px-white text-right {{this.classForSpecialStatus(issue.dateData.rollup.status)}} truncate max-w-96 {{this.textSize}}'>\n                    {{issue.Summary}}\n                </div>\n                <div style=\"grid-column: 2\" class=\"{{this.textSize}} text-right pointer\"\n                    on:click=\"this.showPercentCompleteTooltip(scope.event, issue)\">{{this.getPercentComplete(issue)}}\n                </div>\n                {{ this.getReleaseTimeline(issue, scope.index) }}\n            {{/ for }}\n        </div>\n    ";
    GanttGrid.props = {
        breakdown: Boolean,
        showPercentComplete: {
            get default() {
                return !!localStorage.getItem("showPercentComplete");
            }
        }
    };
    return GanttGrid;
}(StacheElement));
export { GanttGrid };
customElements.define("gantt-grid", GanttGrid);
