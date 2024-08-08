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
import { parseDateISOString } from "../date-helpers.js";
window.fieldsSet = new Set();
function getSprintNumbers(value) {
    if (value === "") {
        return null;
    }
    else {
        return value.split(",").map(function (num) { return +num; });
    }
}
function getSprintNames(value) {
    if (value === "") {
        return null;
    }
    else {
        return value.split(",").map(function (name) { return name.trim(); });
    }
}
export var fields = {
    // from will look like "1619, 1647"
    // we need to update `lastReturnValue` to have 
    // only the right sprints
    Sprint: function (lastReturnValue, change, _a) {
        var sprints = _a.sprints;
        var sprintNumbers = getSprintNumbers(change.from);
        var sprintNames = getSprintNames(change.fromString);
        if (sprintNumbers === null) {
            return null;
        }
        else {
            return sprintNumbers.map(function (number, i) {
                // REMOVE IN PROD
                if (sprints.ids.has(number)) {
                    return sprints.ids.get(number);
                }
                else if (sprints.names.has(sprintNames[i])) {
                    return sprints.names.get(sprintNames[i]);
                }
                else {
                    console.warn("Can't find sprint ", number, sprintNames[i]);
                }
            });
            return copy.filter(function (sprint) { return sprintNumbers.has(sprint.id); });
        }
    },
    "Fix versions": function (lastReturnValue, change, _a) {
        var versions = _a.versions;
        if (change.from) {
            if (versions.ids.has(change.from)) {
                return versions.ids.get(change.from);
            }
            else if (versions.names.has(change.fromString)) {
                return versions.names.get(change.fromString);
            }
            else {
                console.warn("Can't find release version ", change.from, change.fromString);
                return lastReturnValue;
            }
        }
        else {
            return [];
        }
    }
};
var fieldAlias = {
    "duedate": "Due date",
    "status": "Status",
    "labels": "Labels",
    "issuetype": "Issue Type",
    // "summary": "Summary" // we don't want to change summary
    "Fix Version": "Fix versions"
};
function getSprintsMapsFromIssues(issues) {
    var ids = new Map();
    var names = new Map();
    for (var _i = 0, issues_1 = issues; _i < issues_1.length; _i++) {
        var issue_1 = issues_1[_i];
        for (var _a = 0, _b = (issue_1.fields.Sprint || []); _a < _b.length; _a++) {
            var sprint = _b[_a];
            ids.set(sprint.id, sprint);
            names.set(sprint.name, sprint);
        }
    }
    return { ids: ids, names: names };
}
function getVersionsFromIssues(issues) {
    var ids = new Map();
    var names = new Map();
    for (var _i = 0, issues_2 = issues; _i < issues_2.length; _i++) {
        var issue_2 = issues_2[_i];
        for (var _a = 0, _b = (issue_2.fields["Fix versions"] || []); _a < _b.length; _a++) {
            var version = _b[_a];
            ids.set(version.id, version);
            names.set(version.name, version);
        }
    }
    return { ids: ids, names: names };
}
export function issues(issues, rollbackTime) {
    var sprints = getSprintsMapsFromIssues(issues);
    var versions = getVersionsFromIssues(issues);
    return issues.map(function (i) { return issue(i, rollbackTime, { sprints: sprints, versions: versions }); }).filter(function (i) { return i; });
}
var oneHourAgo = new Date(new Date() - 1000 * 60 * 60);
export function issue(issue, rollbackTime, data) {
    if (rollbackTime === void 0) { rollbackTime = oneHourAgo; }
    // ignore old issues
    if (parseDateISOString(issue.fields.Created) > rollbackTime) {
        return;
    }
    // 
    var changelog = issue.changelog, copy = __rest(issue, ["changelog"]);
    copy.fields = __assign({}, issue.fields);
    copy.rolledbackTo = rollbackTime;
    for (var _i = 0, changelog_1 = changelog; _i < changelog_1.length; _i++) {
        var _a = changelog_1[_i], items = _a.items, created = _a.created;
        // we need to go back before ... 
        if (parseDateISOString(created) < rollbackTime) {
            break;
        }
        items.forEach(function (change) {
            var field = change.field, from = change.from, to = change.to;
            var fieldName = fieldAlias[field] || field;
            if (fields[fieldName]) {
                copy.fields[fieldName] = fields[fieldName](copy[fieldName], change, data);
            }
            else {
                copy.fields[fieldName] = from;
            }
        });
    }
    return copy;
}
/*
export function collectChangelog(observableBaseIssues, priorTime) {
    const changes = observableBaseIssues.map( baseIssue => {
        return baseIssue.changelog.map( change => {
            return {...change, issue: baseIssue, createdDate: parseDateISOString(change.created) };
        })
    } ).flat().sort( (cl1, cl2) => cl1.createdDate - cl2.createdDate);

    return changes.filter( change => change.createdDate >= priorTime );
}


export function applyChangelog(changes, data) {
    for(const {items, created, issue} of changes) {

        items.forEach( (change) => {
            const {field, from, to} = change;

            if(field in issue) {
                if(fields[field]) {
                    issue[field] = fields[field](issue[field], change, data);
                } else {
                    issue[field] = from;
                }
                
            }
        })
    }
}



function sleep(time) {
    return new Promise(function(resolve){
        if(!time) {
            resolve();
        }
    })
}

const CHANGE_APPLY_AMOUNT = 2000;
export async function applyChangelogs(observableBaseIssues, priorTime) {
    const changes = collectChangelog(observableBaseIssues, priorTime);
    console.log("processing",changes.length, "changes");
    const sprints = getSprintsMapsFromIssues(observableBaseIssues);
    const batches = [];
    
    while(changes.length) {
        await sleep();
        const batch = changes.splice(0, CHANGE_APPLY_AMOUNT);
        applyChangelog(batch, {sprints});
    }
}*/ 
