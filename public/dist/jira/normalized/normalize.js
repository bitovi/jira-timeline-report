var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
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
import { parseDateIntoLocalTimezone } from "../../date-helpers.js";
import * as defaults from "./defaults";
export function normalizeIssue(issue, _a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.getIssueKey, getIssueKey = _c === void 0 ? defaults.getIssueKeyDefault : _c, _d = _b.getParentKey, getParentKey = _d === void 0 ? defaults.getParentKeyDefault : _d, _e = _b.getConfidence, getConfidence = _e === void 0 ? defaults.getConfidenceDefault : _e, _f = _b.getDueDate, getDueDate = _f === void 0 ? defaults.getDueDateDefault : _f, _g = _b.getHierarchyLevel, getHierarchyLevel = _g === void 0 ? defaults.getHierarchyLevelDefault : _g, _h = _b.getStartDate, getStartDate = _h === void 0 ? defaults.getStartDateDefault : _h, _j = _b.getStoryPoints, getStoryPoints = _j === void 0 ? defaults.getStoryPointsDefault : _j, _k = _b.getStoryPointsMedian, getStoryPointsMedian = _k === void 0 ? defaults.getStoryPointsMedianDefault : _k, _l = _b.getType, getType = _l === void 0 ? defaults.getTypeDefault : _l, _m = _b.getTeamKey, getTeamKey = _m === void 0 ? defaults.getTeamKeyDefault : _m, _o = _b.getUrl, getUrl = _o === void 0 ? defaults.getUrlDefault : _o, _p = _b.getVelocity, getVelocity = _p === void 0 ? defaults.getVelocityDefault : _p, _q = _b.getDaysPerSprint, getDaysPerSprint = _q === void 0 ? defaults.getDaysPerSprintDefault : _q, _r = _b.getParallelWorkLimit, getParallelWorkLimit = _r === void 0 ? defaults.getParallelWorkLimitDefault : _r, _s = _b.getSprints, getSprints = _s === void 0 ? defaults.getSprintsDefault : _s, _t = _b.getStatus, getStatus = _t === void 0 ? defaults.getStatusDefault : _t, _u = _b.getStatusCategory, getStatusCategory = _u === void 0 ? defaults.getStatusCategoryDefault : _u, _v = _b.getLabels, getLabels = _v === void 0 ? defaults.getLabelsDefault : _v, _w = _b.getReleases, getReleases = _w === void 0 ? defaults.getReleasesDefault : _w, _x = _b.getRank, getRank = _x === void 0 ? defaults.getRankDefault : _x;
    var teamName = getTeamKey(issue);
    var velocity = getVelocity(teamName);
    var daysPerSprint = getDaysPerSprint(teamName);
    var parallelWorkLimit = getParallelWorkLimit(teamName);
    var totalPointsPerDay = velocity / daysPerSprint;
    var pointsPerDayPerTrack = totalPointsPerDay / parallelWorkLimit;
    return {
        // .summary can come from a "parent"'s fields
        // TODO check what this was supposed to be flag^v
        summary: issue.fields.Summary || "",
        key: getIssueKey(issue),
        parentKey: getParentKey(issue),
        confidence: getConfidence(issue),
        dueDate: parseDateIntoLocalTimezone(getDueDate(issue)),
        hierarchyLevel: getHierarchyLevel(issue),
        startDate: parseDateIntoLocalTimezone(getStartDate(issue)),
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
            pointsPerDayPerTrack: pointsPerDayPerTrack,
        },
        url: getUrl(issue),
        status: getStatus(issue),
        statusCategory: getStatusCategory(issue),
        labels: getLabels(issue),
        releases: getReleases(issue),
        rank: getRank(issue),
        issue: issue,
    };
}
export function allStatusesSorted(issues) {
    var statuses = issues.map(function (issue) { return issue.status; });
    return __spreadArray([], __read(new Set(statuses)), false).sort();
}
export function allReleasesSorted(issues) {
    var releases = issues.map(function (issue) { return issue.releases.map(function (r) { return r.name; }); }).flat(1);
    return __spreadArray([], __read(new Set(releases)), false).sort();
}
/**
 * For Justin
 * - todo types
 * - mapped types
 * - Ryans PR
 */
//# sourceMappingURL=normalize.js.map