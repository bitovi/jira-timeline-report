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
//import { JiraIssue } from "../shared/issue-data/issue-data.js";
import { estimateExtraPoints } from "../confidence.js";
import { millisecondsToDay, parseDate8601String } from "../date-helpers.js";
import { normalizeIssue, derivedWorkIssue, rollupHierarchy } from "../shared/issue-data/issue-data.js";
/** @import { DerivedWorkIssue } from '../shared/issue-data/issue-data.js' */
/**
 * @param { JiraIssue[] } issues
 * @param { PercentCompleteOptions } options
 */
export function percentComplete(derivedWorkIssues) {
    return completionRollup(derivedWorkIssues);
}
function groupIssuesByHierarchyLevel(issues, options) {
    var sorted = issues;
    var group = [];
    for (var _i = 0, sorted_1 = sorted; _i < sorted_1.length; _i++) {
        var issue = sorted_1[_i];
        if (!group[issue.hierarchyLevel]) {
            group[issue.hierarchyLevel] = [];
        }
        group[issue.hierarchyLevel].push(issue);
    }
    return group;
}
var BASE_HIERARCHY_LEVEL = 1;
/**
 * @typedef {import("../shared/issue-data/issue-data.js").DerivedWorkIssue & {
 *   completionRollup: {
 *    totalWorkingDays: number,
 *    completedWorkingDays: number,
 *    remainingWorkingDays: number
 *   }
 * }} RolledupCompletionIssue
 */
/**
 *
 * @param {import("../shared/issue-data/issue-data.js").DerivedWorkIssue} issues
 * @returns {Array<RolledupCompletionIssue>}
 */
function toCompletionRollups(issues) {
    return issues.map(function (issue) {
        return __assign(__assign({}, issue), { completionRollup: { totalWorkingDays: 0, completedWorkingDays: 0 } });
    });
}
/**
 * @typedef {{
 *  needsAverageSet: Array<RolledupCompletionIssue>,
 *  issues: Array<RolledupCompletionIssue>,
 *  averageChildCount: number | undefined
 * }} IssueTypeData
 */
/**
 *
 * @param {import("../shared/issue-data/issue-data.js").DerivedWorkIssue} allIssueData
 * @param {*} options
 * @returns {{issues: Array<RolledupCompletionIssue>, hierarchyData: Array<IssueTypeData>}}
 */
function completionRollup(allIssueData) {
    var completionRollups = toCompletionRollups(allIssueData);
    var groupedIssueData = groupIssuesByHierarchyLevel(completionRollups);
    var issueKeyToChildren = Object.groupBy(completionRollups, function (issue) { return issue.parentKey; });
    // Store information for each level of of the hierarchy 
    var issueTypeDatas = [];
    var _loop_1 = function (hierarchyLevel) {
        /**
         * @type {Array<RolledupCompletionIssue>}
         */
        var issues = groupedIssueData[hierarchyLevel];
        if (issues) {
            // Track rollup data
            /**
             * @type {IssueTypeData}
             */
            var issueTypeData = issueTypeDatas[hierarchyLevel] = {
                // how many children on average
                childCounts: [],
                // an array of the total of the number of days of work. Used to calculate the average
                totalDaysOfWorkForAverage: [],
                // which items need their average set after the average is calculated
                needsAverageSet: [],
                // this will be set later
                averageTotalDays: null,
                averageChildCount: null,
                issues: issues
            };
            // for issues on that level
            for (var _i = 0, issues_1 = issues; _i < issues_1.length; _i++) {
                var issueData = issues_1[_i];
                if (hierarchyLevel === BASE_HIERARCHY_LEVEL) {
                    // if it has self-calculated total days ..
                    if (issueData.derivedWork.totalDaysOfWork) {
                        // add those days to the average
                        issueTypeData.totalDaysOfWorkForAverage.push(issueData.derivedWork.totalDaysOfWork);
                        // set the rollup value
                        issueData.completionRollup.totalWorkingDays = issueData.derivedWork.totalDaysOfWork;
                    }
                    else {
                        // add this issue to what needs its average
                        issueTypeData.needsAverageSet.push(issueData);
                    }
                    // we roll this up no matter what ... it's ok to roll up 0
                    issueData.completionRollup.completedWorkingDays = issueData.derivedWork.completedDaysOfWork;
                }
                // initiatives and above
                if (hierarchyLevel > BASE_HIERARCHY_LEVEL) {
                    // handle "parent-like" issue
                    handleInitiative(issueData, { issueTypeData: issueTypeData, issueKeyToChildren: issueKeyToChildren });
                }
            }
            // calculate the average 
            var ave_1 = average(issueTypeData.totalDaysOfWorkForAverage) || 30;
            issueTypeData.averageTotalDays = ave_1;
            issueTypeData.averageChildCount = average(issueTypeData.childCounts);
            // set average on children that need it
            issueTypeData.needsAverageSet.forEach(function (issueData) {
                issueData.completionRollup.totalWorkingDays = ave_1;
                issueData.completionRollup.remainingWorkingDays = issueData.completionRollup.totalWorkingDays -
                    issueData.completionRollup.completedWorkingDays;
            });
        }
    };
    // for each level of the hierarchy, starting with the bottom
    for (var hierarchyLevel = BASE_HIERARCHY_LEVEL; hierarchyLevel < groupedIssueData.length; hierarchyLevel++) {
        _loop_1(hierarchyLevel);
    }
    return {
        issues: completionRollups,
        hierarchyData: issueTypeDatas
    };
}
function sum(arr) {
    return arr.reduce(function (partialSum, a) { return partialSum + a; }, 0);
}
function average(arr) {
    return arr.length > 0 ? sum(arr) / arr.length : undefined;
}
/**
 *
 * @param {RolledupCompletionIssue} issueData
 * @param {*} param1
 * @param {*} options
 * @returns
 */
function handleInitiative(issueData, _a) {
    var issueTypeData = _a.issueTypeData, issueKeyToChildren = _a.issueKeyToChildren;
    // Empty
    if (!issueKeyToChildren[issueData.key]) {
        issueTypeData.needsAverageSet.push(issueData);
        return;
    }
    /**
     * @type {Array<RolledupCompletionIssue>}
     */
    var children = issueKeyToChildren[issueData.key];
    var totalDays = children.map(function (child) { return child.completionRollup.totalWorkingDays; });
    var completedDays = children.map(function (child) { return child.completionRollup.completedWorkingDays; });
    issueTypeData.childCounts.push(children.length);
    // Fully Estimated
    if (children.every(function (child) { return child.totalDays; })) {
        // we probably want a better signal ... but this will do for now
        issueData.completionRollup.totalWorkingDays = sum(totalDays);
        // Add so average can be calculated
        issueTypeData.totalDaysOfWorkForAverage.push(issueData.completionRollup.totalWorkingDays);
    }
    // Partially estimated
    else {
        // Do nothing
    }
    // Roll up the days from the children
    // This works b/c children that originally had no estimate will already have their rollup total days 
    // set to the average.  
    issueData.completionRollup.completedWorkingDays = sum(completedDays);
    issueData.completionRollup.totalWorkingDays = sum(totalDays);
    issueData.completionRollup.remainingWorkingDays = issueData.completionRollup.totalWorkingDays - issueData.completionRollup.completedWorkingDays;
}
// to look at later ....
function altRollupWorkingDays(issues) {
    return rollupHierarchy(issues, {
        createRollupDataForHierarchyLevel: function (level, issues) {
            return {
                // how many children on average
                childCounts: [],
                // an array of the total of the number of days of work. Used to calculate the average
                totalDaysOfWorkForAverage: [],
                // which items need their average set after the average is calculated
                needsAverageSet: [],
                // this will be set later
                averageTotalDays: null,
                averageChildCount: null,
                normalizedIssues: issues
            };
        },
        createRollupDataForIssue: function () {
            return { totalDays: 0, completedDays: 0 };
        },
        /**
         *
         * @param {DerivedWorkIssue} issueData
         * @param {*} children
         * @param {*} issueTypeData
         */
        onIssue: function (issueData, children, issueTypeData) {
            if (hierarchyLevel === BASE_HIERARCHY_LEVEL) {
                // if it has self-calculated total days ..
                if (issueData.totalDays) {
                    // add those days to the average
                    issueTypeData.totalDaysOfWorkForAverage.push(issueData.totalDays);
                    // set the rollup value
                    issueData.rollups.totalDays = issueData.totalDays;
                }
                else {
                    // add this issue to what needs its average
                    issueTypeData.needsAverageSet.push(issueData);
                }
                // we roll this up no matter what ... it's ok to roll up 0
                issueData.rollups.completedDays = issueData.completedDays;
            }
            // initiatives and above
            if (hierarchyLevel > BASE_HIERARCHY_LEVEL) {
                // handle "parent-like" issue
                handleInitiative(issueData, { issueTypeData: issueTypeData, issueKeyToChildren: issueKeyToChildren });
            }
        }
    });
}
