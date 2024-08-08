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
import { parseDate8601String } from "../../date-helpers.js";
import { getBusinessDatesCount, getStatusCategoryDefault } from "../../status-helpers.js";
import { estimateExtraPoints, sampleExtraPoints } from "../confidence.js";
import { DAY_IN_MS } from "../../date-helpers.js";
import { parseDateISOString } from "../../date-helpers.js";
import { getStartDateAndDueDataFromFieldsOrSprints, getStartDateAndDueDataFromSprints } from "./date-data.js";
/**
 * @param {JiraIssue} issue
 * @returns {number}
 */
export function getConfidenceDefault(_a) {
    var fields = _a.fields;
    return fields["Story points confidence"] || fields.Confidence;
}
/**
 * @param {NormalizedTeam} team
 * @returns {number}
 */
export function getDefaultConfidenceDefault(team) {
    return 50;
}
/**
 * @param {string} teamKey
 * @returns {number}
 */
export function getDaysPerSprintDefault(teamKey) {
    return 10;
}
/**
 * @param {JiraIssue} issue
 * @returns {string | null}
 */
export function getDueDateDefault(_a) {
    var fields = _a.fields;
    return fields["Due date"];
}
/**
 * @param {JiraIssue} issue
 * @returns {number}
 */
export function getHierarchyLevelDefault(_a) {
    var _b;
    var fields = _a.fields;
    return (_b = fields["Issue Type"]) === null || _b === void 0 ? void 0 : _b.hierarchyLevel;
}
/**
 * @param {JiraIssue} issue
 * @returns {string}
 */
export function getIssueKeyDefault(_a) {
    var key = _a.key;
    return key;
}
/**
 * @param {JiraIssue} issue
 * @returns {string | void}
 */
export function getParentKeyDefault(_a) {
    var _b, _c, _d;
    var fields = _a.fields;
    return ((_b = fields["Parent"]) === null || _b === void 0 ? void 0 : _b.key) || ((_d = (_c = fields["Parent Link"]) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.key);
}
/**
 * @param {JiraIssue} issue
 * @returns {string | null}
 */
export function getStartDateDefault(_a) {
    var fields = _a.fields;
    return fields["Start date"];
}
/**
 * @param {JiraIssue} issue
 * @returns {string | void}
 */
export function getStoryPointsDefault(_a) {
    var fields = _a.fields;
    return fields["Story points"];
}
/**
 *
 * @param {NormalizedTeam} team
 * @returns number
 */
export function getDefaultStoryPointsDefault(team) {
    return team.velocity / team.parallelWorkLimit;
}
/**
 * @param {JiraIssue} issue
 * @returns {string | void}
 */
export function getStoryPointsMedianDefault(_a) {
    var fields = _a.fields;
    return fields["Story points median"];
}
/**
 * @param {JiraIssue} issue
 * @returns {string | void}
 */
export function getUrlDefault(_a) {
    var key = _a.key;
    return "javascript://";
}
/**
 * @param {JiraIssue} issue
 * @returns {string}
 */
export function getTeamKeyDefault(_a) {
    var key = _a.key;
    return key.replace(/-.*/, "");
}
/**
 * @param {JiraIssue} issue
 * @returns {string}
 */
export function getTypeDefault(_a) {
    var _b;
    var fields = _a.fields;
    return (_b = fields["Issue Type"]) === null || _b === void 0 ? void 0 : _b.name;
}
/**
 * @param {string} teamKey
 * @returns {number}
 */
export function getVelocityDefault(teamKey) {
    return 21;
}
export function getParallelWorkLimitDefault(teamKey) {
    return 1;
}
export function getSprintsDefault(_a) {
    var fields = _a.fields;
    if (fields.Sprint) {
        return fields.Sprint.map(function (sprint) {
            return {
                name: sprint.name,
                startDate: parseDateISOString(sprint["startDate"]),
                endDate: parseDateISOString(sprint["endDate"])
            };
        });
    }
    else {
        return null;
    }
}
export function getStatusDefault(_a) {
    var _b;
    var fields = _a.fields;
    return (_b = fields === null || fields === void 0 ? void 0 : fields.Status) === null || _b === void 0 ? void 0 : _b.name;
}
export function getLabelsDefault(_a) {
    var fields = _a.fields;
    return (fields === null || fields === void 0 ? void 0 : fields.labels) || [];
}
export function getReleasesDefault(_a) {
    var fields = _a.fields;
    return (fields["Fix versions"] || []).map(function (_a) {
        var name = _a.name, id = _a.id;
        return { name: name, id: id };
    });
}
/**
 * @typedef {{
 * fields: {
 *   Confidence: number,
 *   'Due date': string | null,
 *   'Issue Type': { hierarchyLevel: number, name: string },
 *   'Parent Link': { data: { key: string } },
 *   'Project Key': string,
 *   'Start date': string | null,
 *   Status: { name: string }
 *   'Story points': number | null | undefined,
 *   'Story points median': number | null | undefined,
 *   Summary: string
 * },
 * id: string,
 * key: string
 * }} JiraIssue
 */
/**
 * @typedef {{
*  name: string,
*  startDate: Date,
*  endDate: Date
* }} NormalizedSprint
*/
/**
 * Returns most common data used by most downstream tools
 * @param {JiraIssue}
 * @return {NormalizedIssue}
 */
export function normalizeIssue(issue, _a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.getIssueKey, getIssueKey = _c === void 0 ? getIssueKeyDefault : _c, _d = _b.getParentKey, getParentKey = _d === void 0 ? getParentKeyDefault : _d, _e = _b.getConfidence, getConfidence = _e === void 0 ? getConfidenceDefault : _e, _f = _b.getDueDate, getDueDate = _f === void 0 ? getDueDateDefault : _f, _g = _b.getHierarchyLevel, getHierarchyLevel = _g === void 0 ? getHierarchyLevelDefault : _g, _h = _b.getStartDate, getStartDate = _h === void 0 ? getStartDateDefault : _h, _j = _b.getStoryPoints, getStoryPoints = _j === void 0 ? getStoryPointsDefault : _j, _k = _b.getStoryPointsMedian, getStoryPointsMedian = _k === void 0 ? getStoryPointsMedianDefault : _k, _l = _b.getType, getType = _l === void 0 ? getTypeDefault : _l, _m = _b.getTeamKey, getTeamKey = _m === void 0 ? getTeamKeyDefault : _m, _o = _b.getUrl, getUrl = _o === void 0 ? getUrlDefault : _o, _p = _b.getVelocity, getVelocity = _p === void 0 ? getVelocityDefault : _p, _q = _b.getDaysPerSprint, getDaysPerSprint = _q === void 0 ? getDaysPerSprintDefault : _q, _r = _b.getParallelWorkLimit, getParallelWorkLimit = _r === void 0 ? getParallelWorkLimitDefault : _r, _s = _b.getSprints, getSprints = _s === void 0 ? getSprintsDefault : _s, _t = _b.getStatus, getStatus = _t === void 0 ? getStatusDefault : _t, _u = _b.getLabels, getLabels = _u === void 0 ? getLabelsDefault : _u, _v = _b.getReleases, getReleases = _v === void 0 ? getReleasesDefault : _v;
    var teamName = getTeamKey(issue), velocity = getVelocity(teamName), daysPerSprint = getDaysPerSprint(teamName), parallelWorkLimit = getParallelWorkLimit(teamName), totalPointsPerDay = velocity / daysPerSprint, pointsPerDayPerTrack = totalPointsPerDay / parallelWorkLimit;
    var data = {
        summary: issue.fields.Summary,
        key: getIssueKey(issue),
        parentKey: getParentKey(issue),
        confidence: getConfidence(issue),
        dueDate: parseDate8601String(getDueDate(issue)),
        hierarchyLevel: getHierarchyLevel(issue),
        startDate: parseDate8601String(getStartDate(issue)),
        storyPoints: getStoryPoints(issue),
        storyPointsMedian: getStoryPointsMedian(issue),
        type: getType(issue),
        sprints: getSprints(issue),
        team: {
            name: teamName,
            velocity: velocity,
            daysPerSprint: daysPerSprint,
            parallelWorkLimit: parallelWorkLimit,
            totalPointsPerDay: totalPointsPerDay,
            pointsPerDayPerTrack: pointsPerDayPerTrack
        },
        url: getUrl(issue),
        status: getStatus(issue),
        labels: getLabels(issue),
        releases: getReleases(issue),
        issue: issue
    };
    return data;
}
/**
 * @typedef {{
*  key: string,
*  summary: string,
*  parentKey: string | null,
*  confidence: number | null,
*  dueDate: Date,
*  hierarchyLevel: number,
*  startDate: Date,
*  storyPoints: number | null,
*  storyPointsMedian: number | null,
*  type: string,
*  team: NormalizedTeam,
*  url: string,
*  sprints: null | Array<NormalizedSprint>,
*  status: null | string,
*  issue: JiraIssue,
*  labels: Array<string>
* }} NormalizedIssue
*/
/**
 * @typedef {{
 *   name: string,
 *    velocity: number,
 *    daysPerSprint: number,
 *    parallelWorkLimit: number,
 *    totalPointsPerDay: number,
 *    pointsPerDayPerTrack: number
 * }} NormalizedTeam
 */
/**
 * @typedef {{
 * isConfidenceValid: boolean,
* usedConfidence: number,
* isStoryPointsValid: boolean,
* defaultOrStoryPoints: number,
* storyPointsDaysOfWork: number,
* deterministicTotalPoints: number,
* isStoryPointsMedianValid: boolean,
* defaultOrStoryPointsMedian: number,
* storyPointsMedianDaysOfWork: number,
* deterministicExtraDaysOfWork: number,
* deterministicTotalDaysOfWork: number,
* probablisticExtraDaysOfWork: number,
* probablisticTotalDaysOfWork: number,
* hasStartAndDueDate: boolean,
* hasSprintStartAndEndDate: boolean,
* sprintDaysOfWork: number | null,
* startAndDueDateDaysOfWork: number | null,
* totalDaysOfWork: number | null,
* defaultOrTotalDaysOfWork: number | null,
* completedDaysOfWork: number,
* startData: import("./date-data.js").StartData,
* dueData: import("./date-data.js").DueData,
* statusType: string,
* workType: string
* }} DerivedWork
 */
/**
 * Returns all status names
 * @param {Array<DerivedWorkIssue>} issues
 */
export function allStatusesSorted(issues) {
    var statuses = issues.map(function (issue) { return issue.status; });
    return __spreadArray([], new Set(statuses), true).sort();
}
/**
 * @typedef {NormalizedIssue & {
 *   derivedWork: DerivedWork
 * }} DerivedWorkIssue
*/
/**
 *
 * @param {Array<JiraIssue>} issues
 * @returns {Array<DerivedWorkIssue>}
 */
export function normalizeAndDeriveIssues(issues) {
    return issues.map(function (issue) { return derivedWorkIssue(normalizeIssue(issue)); });
}
/**
 * Adds derived data
 * @param {NormalizedIssue} normalizedIssue
 * @return {DerivedWorkIssue}
 */
export function derivedWorkIssue(normalizedIssue, _a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.getDefaultConfidence, getDefaultConfidence = _c === void 0 ? getDefaultConfidenceDefault : _c, _d = _b.getDefaultStoryPoints, getDefaultStoryPoints = _d === void 0 ? getDefaultStoryPointsDefault : _d, _e = _b.getStatusType, getStatusType = _e === void 0 ? getStatusCategoryDefault : _e, _f = _b.getWorkType, getWorkType = _f === void 0 ? getWorkTypeDefault : _f, _g = _b.uncertaintyWeight, uncertaintyWeight = _g === void 0 ? 80 : _g;
    var isConfidenceValid = isConfidenceValueValid(normalizedIssue.confidence), usedConfidence = isConfidenceValid ? normalizedIssue.confidence : getDefaultConfidence(normalizedIssue.team), isStoryPointsValid = isStoryPointsValueValid(normalizedIssue.storyPoints), defaultOrStoryPoints = isStoryPointsValid ? normalizedIssue.storyPoints : getDefaultStoryPoints(normalizedIssue.team), storyPointsDaysOfWork = (defaultOrStoryPoints) / normalizedIssue.team.pointsPerDayPerTrack, isStoryPointsMedianValid = isStoryPointsValueValid(normalizedIssue.storyPointsMedian), defaultOrStoryPointsMedian = isStoryPointsMedianValid ? normalizedIssue.storyPointsMedian : getDefaultStoryPoints(normalizedIssue.team), storyPointsMedianDaysOfWork = (defaultOrStoryPointsMedian) / normalizedIssue.team.pointsPerDayPerTrack, deterministicExtraPoints = estimateExtraPoints(defaultOrStoryPointsMedian, usedConfidence, uncertaintyWeight), deterministicExtraDaysOfWork = deterministicExtraPoints / normalizedIssue.team.pointsPerDayPerTrack, deterministicTotalPoints = defaultOrStoryPointsMedian + deterministicExtraPoints, deterministicTotalDaysOfWork = deterministicTotalPoints / normalizedIssue.team.pointsPerDayPerTrack, probablisticExtraPoints = sampleExtraPoints(defaultOrStoryPointsMedian, usedConfidence), probablisticExtraDaysOfWork = probablisticExtraPoints / normalizedIssue.team.pointsPerDayPerTrack, probablisticTotalPoints = defaultOrStoryPointsMedian + probablisticExtraPoints, probablisticTotalDaysOfWork = probablisticTotalPoints / normalizedIssue.team.pointsPerDayPerTrack, hasStartAndDueDate = normalizedIssue.dueDate && normalizedIssue.startDate, startAndDueDateDaysOfWork = hasStartAndDueDate ? getBusinessDatesCount(normalizedIssue.startDate, normalizedIssue.dueDate) : null;
    var _h = getStartDateAndDueDataFromSprints(normalizedIssue), sprintStartData = _h.startData, endSprintData = _h.dueData;
    var hasSprintStartAndEndDate = !!(sprintStartData && endSprintData), sprintDaysOfWork = hasSprintStartAndEndDate ? getBusinessDatesCount(sprintStartData.start, endSprintData.due) : null;
    var _j = getStartDateAndDueDataFromFieldsOrSprints(normalizedIssue), startData = _j.startData, dueData = _j.dueData;
    var totalDaysOfWork = null;
    if (startData && dueData) {
        totalDaysOfWork = getBusinessDatesCount(startData.start, dueData.due);
    }
    else if (isStoryPointsMedianValid) {
        totalDaysOfWork = deterministicTotalDaysOfWork;
    }
    else if (isStoryPointsMedianValid) {
        totalDaysOfWork = storyPointsDaysOfWork;
    }
    var defaultOrTotalDaysOfWork = totalDaysOfWork !== null ? totalDaysOfWork : deterministicTotalDaysOfWork;
    var completedDaysOfWork = getSelfCompletedDays(startData, dueData, totalDaysOfWork);
    return __assign(__assign({}, normalizedIssue), { derivedWork: __assign({ isConfidenceValid: isConfidenceValid, usedConfidence: usedConfidence, isStoryPointsValid: isStoryPointsValid, defaultOrStoryPoints: defaultOrStoryPoints, storyPointsDaysOfWork: storyPointsDaysOfWork, isStoryPointsMedianValid: isStoryPointsMedianValid, defaultOrStoryPointsMedian: defaultOrStoryPointsMedian, storyPointsMedianDaysOfWork: storyPointsMedianDaysOfWork, deterministicExtraPoints: deterministicExtraPoints, deterministicExtraDaysOfWork: deterministicExtraDaysOfWork, deterministicTotalPoints: deterministicTotalPoints, deterministicTotalDaysOfWork: deterministicTotalDaysOfWork, probablisticExtraPoints: probablisticExtraPoints, probablisticExtraDaysOfWork: probablisticExtraDaysOfWork, probablisticTotalPoints: probablisticTotalPoints, probablisticTotalDaysOfWork: probablisticTotalDaysOfWork, hasStartAndDueDate: hasStartAndDueDate, startAndDueDateDaysOfWork: startAndDueDateDaysOfWork, hasSprintStartAndEndDate: hasSprintStartAndEndDate, sprintDaysOfWork: sprintDaysOfWork, sprintStartData: sprintStartData, endSprintData: endSprintData, startData: startData, dueData: dueData, totalDaysOfWork: totalDaysOfWork, defaultOrTotalDaysOfWork: defaultOrTotalDaysOfWork, completedDaysOfWork: completedDaysOfWork }, getWorkStatus(normalizedIssue, { getStatusType: getStatusType, getWorkTypeDefault: getWorkTypeDefault })) });
}
var workType = ["dev", "qa", "uat", "design"];
var workPrefix = workType.map(function (wt) { return wt + ":"; });
/**
 * @param {NormalizedIssue} normalizedIssue
 * @returns {String} dev, qa, uat, design
 */
function getWorkTypeDefault(normalizedIssue) {
    var wp = workPrefix.find(function (wp) { var _a; return ((_a = normalizedIssue === null || normalizedIssue === void 0 ? void 0 : normalizedIssue.summary) === null || _a === void 0 ? void 0 : _a.indexOf(wp)) === 0; });
    if (wp) {
        return wp.slice(0, -1);
    }
    wp = workType.find(function (wt) { return normalizedIssue.labels.includes(wt); });
    if (wp) {
        return wp;
    }
    return "dev";
}
/**
 *
 * @param {NormalizedIssue} normalizedIssue
 */
export function getWorkStatus(normalizedIssue, _a) {
    var _b = _a.getStatusType, getStatusType = _b === void 0 ? getStatusCategoryDefault : _b, _c = _a.getWorkType, getWorkType = _c === void 0 ? getWorkTypeDefault : _c;
    return {
        statusType: getStatusType(normalizedIssue),
        workType: getWorkType(normalizedIssue)
    };
}
export function isConfidenceValueValid(value) {
    return value && value > 0 && value <= 100;
}
export function isStoryPointsValueValid(value) {
    return value && value >= 0;
}
/**
 *
 * @param {import("./date-data.js").StartData} startData
 * @param {import("./date-data.js").DueData} dueData
 * @returns number
 */
function getSelfCompletedDays(startData, dueData, daysOfWork) {
    // These are cases where the child issue (Epic) has a valid estimation
    if (startData && startData.start < new Date()) {
        if (!dueData || dueData.due > new Date()) {
            return getBusinessDatesCount(startData.start, new Date());
        }
        else {
            return getBusinessDatesCount(startData.start, dueData.due);
        }
    }
    // if there's an end date in the past ... 
    else if (dueData && dueData.due < new Date()) {
        return daysOfWork || 0;
    }
    else {
        return 0;
    }
}
/**
 *
 * @param {DerivedWorkIssue} derivedIssue
 */
export function derivedToCSVFormat(derivedIssue) {
    return __assign(__assign({}, derivedIssue.issue.fields), { changelog: derivedIssue.issue.changelog, "Project key": derivedIssue.team.name, "Issue key": derivedIssue.key, url: derivedIssue.url, "Issue Type": derivedIssue.type, "Parent Link": derivedIssue.parentKey, "Status": derivedIssue.status, workType: derivedIssue.derivedWork.workType, workingBusinessDays: derivedIssue.derivedWork.totalDaysOfWork, weightedEstimate: derivedIssue.derivedWork.deterministicTotalPoints });
}
export function rollupHierarchy(derivedWorkIssues, _a) {
    var createRollupDataForHierarchyLevel = _a.createRollupDataForHierarchyLevel, createRollupDataForIssue = _a.createRollupDataForIssue, onIssue = _a.onIssue, onEndOfHierarchy = _a.onEndOfHierarchy, rollupKey = _a.rollupKey;
    var allIssueData = derivedWorkIssues.map(function (issue) {
        var _a;
        return __assign(__assign({}, issue), (_a = {}, _a[rollupKey] = createRollupDataForIssue(issue), _a));
    });
    var group = groupIssuesByHierarchyLevel(allIssueData);
    var issueKeyToChildren = Object.groupBy(allIssueData, function (issue) { return issue.parentKey; });
    for (var hierarchyLevel = 0; hierarchyLevel < groupedIssueData.length; hierarchyLevel++) {
        var issues = groupedIssueData[hierarchyLevel];
        if (!issues) {
            continue;
        }
        // Track rollup data
        var issueTypeData = issueTypeDatas[hierarchyLevel] = createRollupDataForHierarchyLevel(hierarchyLevel, issues);
        // some data must be created, otherwise, skip
        if (!issueTypeData) {
            continue;
        }
        for (var _i = 0, allIssueData_1 = allIssueData; _i < allIssueData_1.length; _i++) {
            var issueData = allIssueData_1[_i];
            onIssue(issueData, issueKeyToChildren[issueData.key], issueTypeData);
        }
        onEndOfHierarchy(issueTypeData);
    }
}
function groupIssuesByHierarchyLevel(issues, options) {
    var sorted = issues; //.sort(sortByIssueHierarchy);
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
