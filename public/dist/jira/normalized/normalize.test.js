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
import { expect, test } from "vitest";
import { normalizeIssue } from "./normalize";
import { parseDateIntoLocalTimezone } from "../../date-helpers";
var issue = {
    id: "1",
    key: "test-key",
    fields: {
        Parent: {},
        Summary: "language packs",
        "Issue Type": { hierarchyLevel: 1, name: "Epic" },
        Created: "2023-02-03T10:58:38.994-0600",
        Sprint: null,
        "Fix versions": [
            {
                id: "10006",
                name: "SHARE_R1",
                archived: false,
                description: "description",
                released: false,
                self: "self-string",
            },
        ],
        "Epic Link": null,
        Labels: ["JTR-Testing"],
        "Start date": "20220715",
        "Parent Link": { data: { key: "IMP-5" } },
        Rank: "0|hzzzzn:",
        "Due date": "20220716",
        Status: { name: "Done", statusCategory: { name: "Done" } },
        "Project key": "ORDER",
        "Issue key": "ORDER-15",
        url: "https://bitovi-training.atlassian.net/browse/ORDER-15",
        workType: "dev",
        workingBusinessDays: 27,
        weightedEstimate: null,
    },
};
var startDate = new Date("20220715");
var dueDate = new Date("20220716");
test("normalizeIssue", function () {
    expect(normalizeIssue(issue)).toEqual({
        summary: "language packs",
        key: "test-key",
        parentKey: "IMP-5",
        confidence: null,
        dueDate: dueDate,
        hierarchyLevel: 1,
        startDate: startDate,
        storyPoints: null,
        storyPointsMedian: null,
        type: "Epic",
        sprints: null,
        team: {
            name: "test",
            velocity: 21,
            daysPerSprint: 10,
            parallelWorkLimit: 1,
            totalPointsPerDay: 2.1,
            pointsPerDayPerTrack: 2.1,
        },
        url: "javascript://",
        status: "Done",
        statusCategory: "Done",
        labels: ["JTR-Testing"],
        releases: [
            {
                name: "SHARE_R1",
                id: "10006",
                type: "Release",
                key: "SPECIAL:release-SHARE_R1",
                summary: "SHARE_R1",
            },
        ],
        rank: "0|hzzzzn:",
        issue: issue,
    });
});
test("normalizeIssue with custom getters", function () {
    var modifiedIssue = __assign(__assign({}, issue), { fields: __assign(__assign({}, issue.fields), { mockParentKey: "mock", mockConfidence: 10, mockLevel: 1, newMedian: 9, mockStatus: "nice" }) });
    var overrides = {
        getIssueKey: function (_a) {
            var key = _a.key;
            return key + "1";
        },
        getParentKey: function (_a) {
            var fields = _a.fields;
            if (typeof fields.mockParentKey === "string") {
                return fields.mockParentKey;
            }
            return null;
        },
        getConfidence: function (_a) {
            var fields = _a.fields;
            if (typeof fields.mockConfidence === "number") {
                return fields.mockConfidence;
            }
            return null;
        },
        getDueDate: function (_a) {
            var fields = _a.fields;
            return "2023-02-17T16:58:00.000Z";
        },
        getHierarchyLevel: function (_a) {
            var fields = _a.fields;
            if (typeof fields.mockLevel === "number") {
                return fields.mockLevel;
            }
            throw new Error("Level must be provided");
        },
        getStartDate: function (_a) {
            var fields = _a.fields;
            return "2023-02-17T16:58:00.000Z";
        },
        getStoryPoints: function (_a) {
            var fields = _a.fields;
            if (typeof fields.shouldNotBeInIssue === "number") {
                return fields.shouldNotBeInIssue;
            }
            return null;
        },
        getStoryPointsMedian: function (_a) {
            var fields = _a.fields;
            if (typeof fields.newMedian === "number") {
                return fields.newMedian;
            }
            return null;
        },
        getType: function (_a) {
            var fields = _a.fields;
            return "bug";
        },
        getTeamKey: function (_a) {
            var key = _a.key;
            return "new fake team key";
        },
        getUrl: function (_a) {
            var key = _a.key;
            return "fake url";
        },
        getVelocity: function () {
            return 1;
        },
        getDaysPerSprint: function () {
            return 20;
        },
        getParallelWorkLimit: function () {
            return 1;
        },
        getSprints: function (_a) {
            var fields = _a.fields;
            return [];
        },
        getStatus: function (_a) {
            var fields = _a.fields;
            if (typeof fields.mockStatus === "string") {
                return fields.mockStatus;
            }
            return null;
        },
        getStatusCategory: function (_a) {
            var fields = _a.fields;
            return null;
        },
        getLabels: function (_a) {
            var fields = _a.fields;
            return ["label1"];
        },
        getReleases: function () {
            return [
                {
                    id: "release-1",
                    key: "17",
                    name: "mock release",
                    summary: "its a release",
                    type: "Release",
                },
            ];
        },
        getRank: function (_a) {
            var fields = _a.fields;
            return null;
        },
    };
    expect(normalizeIssue(modifiedIssue, overrides)).toEqual({
        summary: "language packs",
        key: "test-key1",
        parentKey: "mock",
        confidence: 10,
        dueDate: parseDateIntoLocalTimezone("2023-02-17T16:58:00.000Z"),
        hierarchyLevel: 1,
        startDate: parseDateIntoLocalTimezone("2023-02-17T16:58:00.000Z"),
        storyPoints: null,
        storyPointsMedian: 9,
        type: "bug",
        sprints: [],
        team: {
            name: "new fake team key",
            velocity: 1,
            daysPerSprint: 20,
            parallelWorkLimit: 1,
            totalPointsPerDay: 0.05,
            pointsPerDayPerTrack: 0.05,
        },
        url: "fake url",
        status: "nice",
        statusCategory: null,
        labels: ["label1"],
        releases: [
            {
                id: "release-1",
                key: "17",
                name: "mock release",
                summary: "its a release",
                type: "Release",
            },
        ],
        rank: null,
        issue: modifiedIssue,
    });
});
test.todo("allStatusSorted");
test.todo("allReleasesSorted");
