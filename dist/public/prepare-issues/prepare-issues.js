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
import { estimateExtraPoints } from "../confidence.js";
import { addStatusToInitiative, addStatusToRelease, getBusinessDatesCount, inPartnerReviewStatuses, addStatusToIssueAndChildren } from "../status-helpers.js";
import { howMuchHasDueDateMovedForwardChangedSince, DAY_IN_MS, parseDateISOString, epicTimingData } from "../date-helpers.js";
import { issues as rollbackIssues } from "../rollback/rollback.js";
import { getIssueWithDateData, rollupDatesFromRollups } from "./date-data.js";
export function partition(arr, predicate) {
    var passed = [];
    var failed = [];
    for (var _i = 0, arr_1 = arr; _i < arr_1.length; _i++) {
        var item = arr_1[_i];
        if (predicate(item)) {
            passed.push(item);
        }
        else {
            failed.push(item);
        }
    }
    return { passed: passed, failed: failed };
}
;
function toCVSFormat(issues, serverInfo) {
    return issues.map(function (issue) {
        var _a, _b, _c, _d;
        return __assign(__assign({}, issue.fields), { changelog: issue.changelog, "Project key": issue.key.replace(/-.*/, ""), "Issue key": issue.key, url: serverInfo.baseUrl + "/browse/" + issue.key, "Issue Type": issue.fields["Issue Type"].name, "Product Target Release": (_a = issue.fields["Product Target Release"]) === null || _a === void 0 ? void 0 : _a[0], "Parent Link": (_c = (_b = issue.fields["Parent Link"]) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.key, "Status": (_d = issue.fields["Status"]) === null || _d === void 0 ? void 0 : _d.name });
    });
}
function addWorkingBusinessDays(issues) {
    return issues.map(function (issue) {
        var weightedEstimate = null;
        if (issue["Story Points"]) {
            if (issue["Confidence"]) {
                weightedEstimate = issue["Story Points"] + Math.round(estimateExtraPoints(issue["Story Points"], issue["Confidence"]));
            }
            else {
                weightedEstimate = issue["Story Points"];
            }
        }
        return __assign(__assign({}, issue), { workType: isQAWork(issue) ? "qa" : (isPartnerReviewWork(issue) ? "uat" : "dev"), workingBusinessDays: issue["Due date"] && issue["Start date"] ?
                getBusinessDatesCount(new Date(issue["Start date"]), new Date(issue["Due date"])) : null, weightedEstimate: weightedEstimate });
    });
}
// This is the "base" format everything else will use
export function rawIssuesToBaseIssueFormat(rawIssues, serverInfo) {
    return addWorkingBusinessDays(toCVSFormat(rawIssues, serverInfo));
}
export function isInitiative(issue) {
    return issue["Issue Type"].includes("Initiative");
}
export function filterOutStatuses(issues, statuses) {
    return issues.filter(function (issue) { return !statuses.includes(issue.Status); });
}
export function filterOutInitiativeStatuses(issues, statuses) {
    return issues.filter(function (issue) { return !isInitiative(issue) || !statuses.includes(issue.Status); });
}
// as long as it includes the word initiative
function filterInitiatives(issues) {
    return issues.filter(isInitiative);
}
function getIssuesMappedByParentKey(baseIssues) {
    var map = {};
    for (var _i = 0, baseIssues_1 = baseIssues; _i < baseIssues_1.length; _i++) {
        var issue = baseIssues_1[_i];
        var parentKeyValue = issue["Parent Link"] || issue["Epic Link"];
        if (parentKeyValue) {
            if (!map[parentKeyValue]) {
                map[parentKeyValue] = [];
            }
            map[parentKeyValue].push(issue);
        }
    }
    return map;
}
function getIssueMap(baseIssues) {
    var map = {};
    for (var _i = 0, baseIssues_2 = baseIssues; _i < baseIssues_2.length; _i++) {
        var issue = baseIssues_2[_i];
        var keyValue = issue["Issue key"];
        map[keyValue] = issue;
    }
    return map;
}
/**
 * @param {*} baseEpic
 * @param {*} issuesMappedByParentKey
 * @returns An epic with {start, due, children, startFrom, endTo}
 */
function getEpicTiming(baseEpic, issuesMappedByParentKey) {
    var children = issuesMappedByParentKey[baseEpic["Issue key"]];
    var _a = getStartDateAndDueDataDirectlyFromIssue(baseEpic), startData = _a.startData, dueData = _a.dueData;
    if (startData && dueData) {
        return __assign(__assign(__assign(__assign({}, baseEpic), startData), dueData), { children: children });
    }
    else {
        // lets try to get timing from stories and sprints
        if (children) {
            var datesFromStories = getStartAndDueDatesFromStoriesAndSprints(children);
            if (datesFromStories) {
                startData = startData || { start: datesFromStories.start, startFrom: datesFromStories.startFrom };
                dueData = dueData || { due: datesFromStories.due, dueTo: datesFromStories.dueTo };
                return __assign(__assign(__assign(__assign({}, baseEpic), startData), dueData), { children: children });
            }
        }
    }
    //console.warn("Unable to find timing information for", baseEpic.Summary, baseEpic.url);
    return __assign(__assign({}, baseEpic), { start: null, due: null });
}
export function filterQAWork(issues) {
    return filterByLabel(issues, "QA");
}
export function isQAWork(issue) {
    return filterQAWork([issue]).length > 0;
}
export function filterPartnerReviewWork(issues) {
    return filterByLabel(issues, "UAT");
}
export function isPartnerReviewWork(issue) {
    return filterPartnerReviewWork([issue]).length > 0;
}
function filterByLabel(issues, label) {
    return issues.filter(function (issue) { return (issue.Labels || []).filter(function (l) { return l.includes(label); }).length; });
}
function getWorkTypeBreakdown(timedEpics) {
    var qaEpics = new Set(filterQAWork(timedEpics));
    var uatEpics = new Set(filterPartnerReviewWork(timedEpics));
    var devEpics = timedEpics.filter(function (epic) { return !qaEpics.has(epic) && !uatEpics.has(epic); });
    return {
        children: epicTimingData(timedEpics),
        dev: epicTimingData(__spreadArray([], devEpics, true)),
        qa: epicTimingData(__spreadArray([], qaEpics, true)),
        uat: epicTimingData(__spreadArray([], uatEpics, true))
    };
}
export function reportedIssueTypeTimingWithChildrenBreakdown(_a) {
    var baseIssues = _a.baseIssues, _b = _a.reportedIssueType, reportedIssueType = _b === void 0 ? "Initiative" : _b, _c = _a.reportedStatuses, reportedStatuses = _c === void 0 ? function (status) {
        return !["Done"].includes(status);
    } : _c, timingMethods = _a.timingMethods, getChildWorkBreakdown = _a.getChildWorkBreakdown;
    var issuesMappedByParentKey = getIssuesMappedByParentKey(baseIssues);
    // get items we are reporting
    var reportedIssues = baseIssues.filter(function (issue) { return issue["Issue Type"].includes(reportedIssueType) && reportedStatuses(issue.Status); });
    return reportedIssues.map(function (issue) {
        var reportedIssueWithTiming = getIssueWithDateData(issue, issuesMappedByParentKey, timingMethods);
        addWorkBreakdownToDateData(reportedIssueWithTiming.dateData, reportedIssueWithTiming.dateData.children.issues || [], getChildWorkBreakdown);
        return reportedIssueWithTiming;
    });
}
function addWorkBreakdownToDateData(dateData, issues, getChildWorkBreakdown) {
    var workBreakdown = getChildWorkBreakdown(issues);
    return Object.assign(dateData, {
        dev: rollupDatesFromRollups(__spreadArray([], workBreakdown.devWork, true)),
        qa: rollupDatesFromRollups(__spreadArray([], workBreakdown.qaWork, true)),
        uat: rollupDatesFromRollups(__spreadArray([], workBreakdown.uatWork, true))
    });
}
function getAllChildren(issues) {
    var _a, _b;
    var allChildren = __spreadArray([], issues, true);
    for (var _i = 0, issues_1 = issues; _i < issues_1.length; _i++) {
        var issue = issues_1[_i];
        var children = (_b = (_a = issue.dateData) === null || _a === void 0 ? void 0 : _a.children) === null || _b === void 0 ? void 0 : _b.issues;
        if (children) {
            allChildren.push.apply(allChildren, getAllChildren(children));
        }
    }
    return allChildren;
}
function reportedIssueTiming(options) {
    var baseIssues = options.baseIssues, priorTime = options.priorTime, reportedIssueType = options.reportedIssueType, reportedStatuses = options.reportedStatuses, timingMethods = options.timingMethods;
    var currentInitiatives = reportedIssueTypeTimingWithChildrenBreakdown(options);
    var rolledBackBaseIssues = rollbackIssues(baseIssues, priorTime);
    // OFTEN, a prior initiative is rolled back b/c of status
    // we don't explain this well why it would now be new
    var priorInitiatives = reportedIssueTypeTimingWithChildrenBreakdown(__assign(__assign({}, options), { baseIssues: rolledBackBaseIssues }));
    // copy prior initiative timing information over 
    var allCurrentIssues = getAllChildren(currentInitiatives);
    // FURTHERMORE, epics could have existed for a while, but 
    // that we only get children of "priorInitiatives" means we
    // probably show as new a lot more initiatives than we should 
    var allPastIssues = getAllChildren(priorInitiatives);
    var pastIssueMap = getIssueMap(allPastIssues);
    for (var _i = 0, allCurrentIssues_1 = allCurrentIssues; _i < allCurrentIssues_1.length; _i++) {
        var currentIssue = allCurrentIssues_1[_i];
        var pastIssue = pastIssueMap[currentIssue["Issue key"]];
        assignPriorIssueBreakdowns(currentIssue, pastIssue);
    }
    return {
        currentInitiativesWithStatus: currentInitiatives.map(addStatusToIssueAndChildren),
        priorInitiatives: priorInitiatives
    };
}
function assignPriorIssueBreakdowns(currentIssue, priorIssue) {
    var curDateData = currentIssue.dateData;
    if (priorIssue) {
        // copy timing
        currentIssue.lastPeriod = priorIssue;
        var priorDateData = priorIssue.dateData;
        curDateData.rollup.lastPeriod = priorDateData.rollup;
        curDateData.children.lastPeriod = priorDateData.children;
        if (curDateData.dev) {
            curDateData.dev.lastPeriod = priorDateData.dev;
        }
        if (curDateData.qa) {
            curDateData.qa.lastPeriod = priorDateData.qa;
        }
        if (curDateData.uat) {
            curDateData.uat.lastPeriod = priorDateData.uat;
        }
    }
    else {
        // it's missing leave timing alone
        currentIssue.lastPeriod = null;
    }
}
export function initiativesWithPriorTiming(baseIssues, priorTime) {
    return priorInitiativeTiming(baseIssues, priorTime).currentInitiativesWithStatus;
}
;
function getReleaseData(issue) {
    var _a, _b, _c, _d;
    return { releaseName: (_b = (_a = issue === null || issue === void 0 ? void 0 : issue["Fix versions"]) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.name, releaseId: (_d = (_c = issue === null || issue === void 0 ? void 0 : issue["Fix versions"]) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.id };
}
function filterReleases(issues) {
    return issues.filter(function (issue) { return getReleaseData(issue).releaseName; });
}
function mapOfReleaseIdsToNames(initiatives) {
    var map = new Map();
    for (var _i = 0, initiatives_1 = initiatives; _i < initiatives_1.length; _i++) {
        var initiative = initiatives_1[_i];
        var _a = getReleaseData(initiative), releaseId = _a.releaseId, releaseName = _a.releaseName;
        if (releaseId) {
            map.set(releaseId, releaseName);
        }
    }
    return map;
}
function mapOfReleaseNamesToReleasesWithInitiatives(initiatives) {
    var map = new Map();
    for (var _i = 0, initiatives_2 = initiatives; _i < initiatives_2.length; _i++) {
        var initiative = initiatives_2[_i];
        var releaseName = getReleaseData(initiative).releaseName;
        if (releaseName) {
            if (!map.has(releaseName)) {
                map.set(releaseName, makeRelease(releaseName));
            }
            map.get(releaseName).dateData.children.issues.push(initiative);
        }
    }
    return map;
}
function makeRelease(releaseName) {
    var release = { Summary: releaseName, release: releaseName, lastPeriod: null, dateData: { children: { issues: [] } } };
    release.dateData.rollup = release.dateData.children;
    return release;
}
// SIDE EFFECTS
function addWorkTypeBreakdownForRelease(release, getChildWorkBreakdown) {
    // children is a release's direct children, but we really need the children's children as we are ignoring epic
    // dimensions .... 
    var children = release.dateData.children.issues;
    var grandChildren = children.map(function (child) { return child.dateData.children.issues; }).flat();
    release.dateData.rollup = /*release.dateData.children =*/ rollupDatesFromRollups(children);
    addWorkBreakdownToDateData(release.dateData, grandChildren, getChildWorkBreakdown);
}
export function releasesAndInitiativesWithPriorTiming(options) {
    var _a = reportedIssueTiming(options), currentInitiativesWithStatus = _a.currentInitiativesWithStatus, priorInitiatives = _a.priorInitiatives;
    var currentInitiativesWithARelease = filterReleases(currentInitiativesWithStatus);
    var priorInitiativesWithARelease = filterReleases(priorInitiatives);
    // Make a map where we can look for prior releases's initiatives
    // {1234: "ALPHA", 4321: "ALPHA"}
    var currentReleaseIdsToNames = mapOfReleaseIdsToNames(currentInitiativesWithARelease);
    // {"ALPHA": {release: "ALPHA", initiatives: []}}
    var releaseMap = mapOfReleaseNamesToReleasesWithInitiatives(currentInitiativesWithARelease);
    // Add prior initiatives to each release
    for (var _i = 0, priorInitiativesWithARelease_1 = priorInitiativesWithARelease; _i < priorInitiativesWithARelease_1.length; _i++) {
        var priorInitiative = priorInitiativesWithARelease_1[_i];
        var _b = getReleaseData(priorInitiative), releaseId = _b.releaseId, releaseName = _b.releaseName;
        var release = releaseMap.get(releaseName);
        if (!release) {
            var releaseNameForId = currentReleaseIdsToNames.get(releaseId);
            if (releaseNameForId) {
                release = releaseMap.get(releaseNameForId);
            }
        }
        if (!release) {
            console.warn("Unable to find current release matching old release", releaseName + ".", "The initiative", '"' + priorInitiative.Summary + '"', "timing will be ignored");
        }
        else {
            // mark this release as having a lastPeriod if it doesn't already
            if (!release.lastPeriod) {
                release.lastPeriod = makeRelease("PRIOR " + release.release);
            }
            release.lastPeriod.dateData.children.issues.push(priorInitiative);
        }
    }
    // now go and add timing data to each release in the release map ...
    for (var _c = 0, releaseMap_1 = releaseMap; _c < releaseMap_1.length; _c++) {
        var _d = releaseMap_1[_c], releaseName = _d[0], release = _d[1];
        addWorkTypeBreakdownForRelease(release, options.getChildWorkBreakdown);
        if (release.lastPeriod) {
            addWorkTypeBreakdownForRelease(release.lastPeriod, options.getChildWorkBreakdown);
            assignPriorIssueBreakdowns(release, release.lastPeriod);
        }
    }
    return {
        releases: __spreadArray([], releaseMap.values(), true).map(addStatusToRelease),
        initiatives: currentInitiativesWithStatus
    };
}
;
