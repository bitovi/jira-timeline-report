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
import { ObservableObject, value, Reflect } from "../can.js";
import { normalizeIssue, derivedWorkIssue } from "../shared/issue-data/issue-data.js";
import bitoviTrainingData from "../examples/bitovi-training.js";
/*
class IssueData extends ObservableObject {
    static props = {
        jql: saveJSONToUrl("jql", "", String, {parse: x => ""+x, stringify: x => ""+x}),
        isLoggedIn: Boolean,
    }
}*/
var typesToHierarchyLevel = { Epic: 1, Story: 0, Initiative: 2 };
export function csvToRawIssues(csvIssues) {
    var res = csvIssues.map(function (issue) {
        return __assign(__assign({}, issue), { fields: __assign(__assign({}, issue), { "Parent Link": { data: issue["Parent Link"] }, "Issue Type": { name: issue["Issue Type"], hierarchyLevel: typesToHierarchyLevel[issue["Issue Type"]] } }), key: issue["Issue key"] });
    });
    return res;
}
export function rawIssuesRequestData(_a, _b) {
    var jql = _a.jql, isLoggedIn = _a.isLoggedIn, loadChildren = _a.loadChildren, jiraHelpers = _a.jiraHelpers;
    var listenTo = _b.listenTo, resolve = _b.resolve;
    var progressData = value.with(null);
    var promise = value.returnedBy(function rawIssuesPromise() {
        if (isLoggedIn.value === false || !jql.value) {
            return bitoviTrainingData(new Date()).then(csvToRawIssues);
        }
        progressData.value = null;
        var loadIssues = loadChildren.value ?
            jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields.bind(jiraHelpers) :
            jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields.bind(jiraHelpers);
        return loadIssues({
            jql: jql.value,
            fields: ["summary",
                "Rank",
                "Start date",
                "Due date",
                "Issue Type",
                "Fix versions",
                "Story points",
                "Story points median",
                "Confidence",
                "Story points confidence",
                "Product Target Release", // TODO comment this out ...
                "Labels", "Status", "Sprint", "Epic Link", "Created", "Parent"],
            expand: ["changelog"]
        }, function (receivedProgressData) {
            progressData.value = __assign({}, receivedProgressData);
        });
    });
    listenTo(promise, function (value) {
        resolve({
            progressData: progressData,
            issuesPromise: value
        });
    });
    resolve({
        progressData: progressData,
        issuesPromise: promise.value
    });
}
function resolve(value) {
    if (value instanceof Promise) {
        return value;
    }
    else {
        return Reflect.getValue(value);
    }
}
export function configurationPromise(_a) {
    var serverInfoPromise = _a.serverInfoPromise, teamConfigurationPromise = _a.teamConfigurationPromise;
    // we will give pending until we have both promises 
    var info = resolve(serverInfoPromise), team = resolve(teamConfigurationPromise);
    if (!info || !team) {
        return new Promise(function () { });
    }
    return Promise.all([info, team]).then(
    /**
     *
     * @param {[Object, TeamConfiguration]} param0
     * @returns
     */
    function (_a) {
        var serverInfo = _a[0], teamData = _a[1];
        return {
            getConfidence: function (_a) {
                var fields = _a.fields;
                return fields.Confidence;
            },
            getStoryPointsMedian: function (_a) {
                var fields = _a.fields;
                return fields["Story points median"];
            },
            getUrl: function (_a) {
                var key = _a.key;
                return serverInfo.baseUrl + "/browse/" + key;
            },
            getVelocity: function (team) {
                return teamData.getVelocityForTeam(team);
            },
            getDaysPerSprint: function (team) {
                return teamData.getDaysPerSprintForTeam(team);
            },
            getParallelWorkLimit: function (team) {
                return teamData.getTracksForTeam(team);
            },
        };
    });
}
export function derivedIssuesRequestData(_a, _b) {
    var rawIssuesRequestData = _a.rawIssuesRequestData, configurationPromise = _a.configurationPromise;
    var listenTo = _b.listenTo, resolve = _b.resolve;
    var promise = value.returnedBy(function derivedIssuesPromise() {
        if (rawIssuesRequestData.value.issuesPromise && configurationPromise.value) {
            return Promise.all([
                rawIssuesRequestData.value.issuesPromise,
                configurationPromise.value
            ]).then(function (_a) {
                var rawIssues = _a[0], configuration = _a[1];
                console.log({ rawIssues: rawIssues });
                return rawIssues.map(function (issue) {
                    var normalized = normalizeIssue(issue, configuration);
                    var derived = derivedWorkIssue(normalized, configuration);
                    return derived;
                });
            });
        }
        else {
            // make a pending promise ...
            var promise_1 = new Promise(function () { });
            promise_1.__isAlwaysPending = true;
            return promise_1;
        }
    });
    listenTo(promise, function (derivedIssues) {
        resolve({
            issuesPromise: derivedIssues,
            progressData: rawIssuesRequestData.value.progressData
        });
    });
    resolve({
        issuesPromise: promise.value,
        progressData: rawIssuesRequestData.value.progressData
    });
}
