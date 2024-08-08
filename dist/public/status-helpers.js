var inQAStatus = { "QA": true, "In QA": true, "QA Complete": true };
var inPartnerReviewStatus = { "Partner Review": true, "UAT": true };
export var inPartnerReviewStatuses = Object.keys(inPartnerReviewStatus);
export var inIdeaStatus = { "Idea": true, "To Do": true, "Open": true };
export var inIdeaStatuses = Object.keys(inIdeaStatus);
var inDoneStatus = { "Done": true, "Cancelled": true };
var blockedStatus = { "Blocked": true, "blocked": true, "delayed": true, "Delayed": true };
var statusCategoryMap = (function () {
    var items = [
        ["qa", inQAStatus],
        ["uat", inPartnerReviewStatus],
        ["todo", inIdeaStatus],
        ["done", inDoneStatus],
        ["blocked", blockedStatus]
    ];
    var statusCategoryMap = {};
    for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
        var _a = items_1[_i], category = _a[0], statusMap = _a[1];
        for (var prop in statusMap) {
            statusCategoryMap[prop] = category;
        }
    }
    return statusCategoryMap;
})();
var WIGGLE_ROOM = 0;
// clean up warnings
function warn() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    console.warn.apply(console, args.map(function (arg) {
        if (arg && typeof arg === "object" && arg.Summary || arg.release) {
            return '"' + (arg.Summary || arg.release) + '"' + (arg.url ? " (" + arg.url + ")" : "");
        }
        else {
            return arg;
        }
    }));
}
/**
 *
 * @param {import("./shared/issue-data/issue-data").DerivedWorkIssue} issue
 */
export function getStatusCategoryDefault(issue) {
    if (statusCategoryMap[issue.status]) {
        return statusCategoryMap[issue.status];
    }
    else {
        return "dev";
    }
}
/**
 *
 * @param {import("./shared/issue-data/issue-data").NormalizedIssue} issue
 */
export function addStatusCategory(issue) {
}
export function addStatusToRelease(release) {
    Object.assign(release.dateData.rollup, getReleaseStatus(release));
    Object.assign(release.dateData.dev, getReleaseDevStatus(release));
    Object.assign(release.dateData.qa, getReleaseQaStatus(release));
    Object.assign(release.dateData.uat, getReleaseUatStatus(release));
    return release;
}
function getReleaseStatus(release) {
    // if everything is complete
    var issuesNotComplete = release.dateData.children.issues.filter(function (i) {
        return i.dateData.rollup.status !== "complete";
    });
    if (issuesNotComplete.length === 0) {
        return {
            status: "complete",
            statusData: {
                message: "All initiatives are complete"
            }
        };
    }
    return getInitiativeStatus(release);
}
function getReleaseDevStatus(release) {
    return getInitiativeDevStatus(release);
}
function getReleaseQaStatus(release) {
    return getInitiativeQaStatus(release);
}
function getReleaseUatStatus(release) {
    return getInitiativeUatStatus(release);
}
export function addStatusToInitiative(initiative) {
    Object.assign(initiative.dateData.rollup, getInitiativeStatus(initiative));
    Object.assign(initiative.dateData.dev, getInitiativeDevStatus(initiative));
    Object.assign(initiative.dateData.qa, getInitiativeQaStatus(initiative));
    Object.assign(initiative.dateData.uat, getInitiativeUatStatus(initiative));
    return initiative;
}
export function addStatusToIssueAndChildren(issue) {
    var _a, _b, _c;
    addStatusToInitiative(issue);
    if ((_c = (_b = (_a = issue.dateData) === null || _a === void 0 ? void 0 : _a.children) === null || _b === void 0 ? void 0 : _b.issues) === null || _c === void 0 ? void 0 : _c.length) {
        issue.dateData.children.issues.forEach(function (child) {
            Object.assign(child.dateData.rollup, getInitiativeStatus(child));
        });
    }
    return issue;
}
function getInitiativeStatus(initiative) {
    var _a, _b, _c, _d;
    if (initiative["Issue key"] === "DRD-8370") {
        debugger;
    }
    if (inDoneStatus[initiative.Status]) {
        return {
            status: "complete",
            statusData: {
                message: "Status is `DONE`"
            }
        };
    }
    var devStatus = getInitiativeDevStatus(initiative).status, qaStatus = getInitiativeQaStatus(initiative).status, uatStatus = getInitiativeUatStatus(initiative).status, statuses = [devStatus, qaStatus, uatStatus];
    if (statuses.every(function (s) { return s === "complete"; })) {
        return {
            status: "complete",
            statusData: {
                warning: true,
                message: "Some epics have due dates in the past, but are not `DONE`"
            }
        };
    }
    if (statuses.some(function (s) { return s.toLowerCase() === "blocked"; }) || (initiative.Status && initiative.Status.toLowerCase() === "blocked")) {
        return {
            status: "blocked",
            statusData: {
                message: "Some epics are blocked"
            }
        };
    }
    var timedTeamStatus = timedStatus(initiative.dateData.rollup);
    var warning = timedTeamStatus === "complete" &&
        ((_b = (_a = initiative.dateData.rollup) === null || _a === void 0 ? void 0 : _a.issues) === null || _b === void 0 ? void 0 : _b.length) && ((_d = (_c = initiative.dateData.rollup) === null || _c === void 0 ? void 0 : _c.issues) === null || _d === void 0 ? void 0 : _d.every(function (epic) { return !isStatusUatComplete(epic); }));
    return {
        status: timedTeamStatus,
        statusData: {
            warning: warning,
            message: warning ? "Some epics have due dates in the past, but are not `DONE`" : null
        }
    };
}
function isStatusDevComplete(item) {
    return inQAStatus[item.Status] || isStatusQAComplete(item);
}
function isStatusQAComplete(item) {
    return inPartnerReviewStatus[item.Status] || isStatusUatComplete(item);
}
function isStatusUatComplete(item) {
    return inDoneStatus[item.Status];
}
function timedStatus(timedRecord) {
    if (!timedRecord.due) {
        return "unknown";
    }
    // if now is after the complete date
    // we force complete ... however, we probably want to warn if this isn't in the
    // completed state
    else if ((+timedRecord.due) < new Date()) {
        return "complete";
    }
    else if (timedRecord.lastPeriod &&
        ((+timedRecord.due) > WIGGLE_ROOM + (+timedRecord.lastPeriod.due))) {
        return "behind";
    }
    else if (timedRecord.lastPeriod &&
        ((+timedRecord.due) + WIGGLE_ROOM < (+timedRecord.lastPeriod.due))) {
        return "ahead";
    }
    else if (!timedRecord.lastPeriod) {
        return "new";
    }
    if (timedRecord.start > new Date()) {
        return "notstarted";
    }
    else {
        return "ontrack";
    }
}
export function getInitiativeDevStatus(initiative) {
    var _a, _b, _c, _d, _e;
    // check if epic statuses are complete
    if (isStatusDevComplete(initiative)) {
        return {
            status: "complete",
            statusData: { message: "initiative status is `DEV` complete" }
        };
    }
    var devDateData = initiative.dateData.dev;
    if (((_a = devDateData === null || devDateData === void 0 ? void 0 : devDateData.issues) === null || _a === void 0 ? void 0 : _a.length) && ((_b = devDateData === null || devDateData === void 0 ? void 0 : devDateData.issues) === null || _b === void 0 ? void 0 : _b.every(function (epic) { return isStatusDevComplete(epic); }))) {
        // Releases don't have a status so we shouldn't throw this warning.
        return {
            status: "complete",
            statusData: {
                warning: !!initiative.Status,
                message: "All epics are dev complete. Move the issue to a `QA` status"
            }
        };
        return "complete";
    }
    if ((_c = devDateData === null || devDateData === void 0 ? void 0 : devDateData.issues) === null || _c === void 0 ? void 0 : _c.some(function (epic) { return epic.Status.toLowerCase() === "blocked"; })) {
        return {
            status: "blocked",
            statusData: {
                message: "An epic is blocked"
            }
        };
    }
    if (!devDateData) {
        return {
            status: "unknown",
            statusData: {
                warning: false,
                message: "Did not break down dev work on this level"
            }
        };
    }
    var timedDevStatus = timedStatus(devDateData);
    var warning = timedDevStatus === "complete" &&
        ((_d = devDateData === null || devDateData === void 0 ? void 0 : devDateData.issues) === null || _d === void 0 ? void 0 : _d.length) && ((_e = devDateData === null || devDateData === void 0 ? void 0 : devDateData.issues) === null || _e === void 0 ? void 0 : _e.every(function (epic) { return !isStatusDevComplete(epic); }));
    return {
        status: timedDevStatus,
        statusData: {
            warning: warning,
            message: warning ? "Some epics have due dates in the past, but are not `DEV` complete" : null
        }
    };
}
function getInitiativeQaStatus(initiative) {
    var _a, _b, _c, _d;
    if (isStatusQAComplete(initiative)) {
        return {
            status: "complete",
            statusData: { message: "initiative status is `QA` complete" }
        };
    }
    var qaDateData = initiative.dateData.qa;
    if (!qaDateData) {
        return {
            status: "unknown",
            statusData: {
                warning: false,
                message: "Did not break down qa work within this issue"
            }
        };
    }
    if (qaDateData.issues.length && qaDateData.issues.every(function (epic) { return isStatusQAComplete(epic); })) {
        return {
            status: "complete",
            statusData: {
                warning: !!initiative.Status,
                message: "All QA epics are `QA` complete. Move the initiative to a `UAT` status"
            }
        };
    }
    if ((_b = (_a = initiative === null || initiative === void 0 ? void 0 : initiative.qa) === null || _a === void 0 ? void 0 : _a.issues) === null || _b === void 0 ? void 0 : _b.some(function (epic) { return epic.Status.toLowerCase() === "blocked"; })) {
        return {
            status: "blocked",
            statusData: {
                message: "An epic is blocked"
            }
        };
    }
    var timedQAStatus = timedStatus(qaDateData);
    var warning = timedQAStatus === "complete" &&
        ((_c = qaDateData === null || qaDateData === void 0 ? void 0 : qaDateData.issues) === null || _c === void 0 ? void 0 : _c.length) && ((_d = qaDateData === null || qaDateData === void 0 ? void 0 : qaDateData.issues) === null || _d === void 0 ? void 0 : _d.every(function (epic) { return !isStatusQAComplete(epic); }));
    return {
        status: timedQAStatus,
        statusData: {
            warning: warning,
            message: warning ? "Some epics have due dates in the past, but are not `QA` complete" : null
        }
    };
}
function getInitiativeUatStatus(initiative) {
    var _a, _b, _c;
    if (isStatusUatComplete(initiative)) {
        return {
            status: "complete",
            statusData: { message: "initiative status is `UAT` complete" }
        };
    }
    var uatDateData = initiative.dateData.uat;
    if (!uatDateData) {
        return {
            status: "unknown",
            statusData: {
                warning: false,
                message: "Did not break down uat work within this issue"
            }
        };
    }
    if (uatDateData.issues.length && uatDateData.issues.every(function (epic) { return isStatusUatComplete(epic); })) {
        // Releases don't have a status so we shouldn't throw this warning.
        return {
            status: "complete",
            statusData: {
                warning: !!initiative.Status,
                message: "All UAT epics are `UAT` complete. Move the initiative to a `DONE` status"
            }
        };
    }
    if ((_a = uatDateData === null || uatDateData === void 0 ? void 0 : uatDateData.issues) === null || _a === void 0 ? void 0 : _a.some(function (epic) { return epic.Status.toLowerCase() === "blocked"; })) {
        return {
            status: "blocked",
            statusData: {
                message: "An epic is blocked"
            }
        };
    }
    // should timed status be able to look at the actual statuses?
    // lets say the UAT is "ontrack" (epicStatus won't report this currently)
    // should we say there is a missmatch?
    var statusFromTiming = timedStatus(uatDateData);
    var warning = statusFromTiming === "complete" &&
        ((_b = uatDateData === null || uatDateData === void 0 ? void 0 : uatDateData.issues) === null || _b === void 0 ? void 0 : _b.length) && ((_c = uatDateData === null || uatDateData === void 0 ? void 0 : uatDateData.issues) === null || _c === void 0 ? void 0 : _c.every(function (epic) { return !isStatusUatComplete(epic); }));
    return {
        status: statusFromTiming,
        statusData: {
            warning: warning,
            message: warning ? "Some epics have due dates in the past, but are not `UAT` complete" : null
        }
    };
}
/*
export function getEpicStatus(epic) {
    debugger;
        if (inQAStatus[epic.Status] || inPartnerReviewStatus[epic.Status] || inDoneStatus[epic.Status]) {
                return "complete";
        } else if (!epic["Due date"]) {
                return "unknown"
        } else if (new Date(epic["Due date"]) > WIGGLE_ROOM + (+epic.dueLastPeriod)) {
                return "behind"
        } else {
                return "ontrack";
        }
}

export function addStatusToEpic(epic) {
        return {
                ...epic,
                status: getEpicStatus(epic)
        };
}*/
export function getBusinessDatesCount(startDate, endDate) {
    var count = 0;
    var curDate = new Date(startDate.getTime());
    while (curDate <= endDate) {
        var dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6)
            count++;
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
}
