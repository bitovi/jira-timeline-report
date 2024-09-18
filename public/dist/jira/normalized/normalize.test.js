import { expect, test } from "vitest";
import { getConfidenceDefault, getDueDateDefault, getHierarchyLevelDefault, getLabelsDefault, getParallelWorkLimitDefault, getRankDefault, getSprintsDefault, getStartDateDefault, getStatusCategoryDefault, getStatusDefault, getStoryPointsDefault, getStoryPointsMedianDefault, getTeamKeyDefault, getTypeDefault, getUrlDefault, getVelocityDefault, normalizeIssue, } from "./normalize";
test("getConfidenceDefault", function () {
    expect(getConfidenceDefault({ fields: { Confidence: 20 } })).toBe(20);
    expect(getConfidenceDefault({ fields: { "Story points confidence": 10 } })).toBe(10);
    expect(getConfidenceDefault({ fields: {} })).toBeNull();
    expect(getConfidenceDefault({ fields: { "Story points confidence": 10, Confidence: 20 } })).toBe(10);
});
test("getDueDataDefault", function () {
    var date = new Date().toString();
    expect(getDueDateDefault({ fields: { "Due date": date } })).toBe(date);
    expect(getDueDateDefault({ fields: {} })).toBeNull();
});
test("getHierarchyLevelDefault", function () {
    expect(getHierarchyLevelDefault({ fields: { "Issue Type": { name: "", hierarchyLevel: 7 } } })).toBe(7);
    expect(getHierarchyLevelDefault({ fields: {} })).toBeNull();
});
test.todo("getParentKeyDefault");
test("getStartDateDefault", function () {
    var date = new Date().toString();
    expect(getStartDateDefault({ fields: { "Start date": date } })).toBe(date);
    expect(getStartDateDefault({ fields: {} })).toBeNull();
});
test("getStoryPointsDefault", function () {
    expect(getStoryPointsDefault({ fields: { "Story points": 3 } })).toBe(3);
    expect(getStoryPointsDefault({ fields: {} })).toBeNull();
});
test("getStoryPointsMedianDefault", function () {
    expect(getStoryPointsMedianDefault({ fields: { "Story points median": 3 } })).toBe(3);
    expect(getStoryPointsMedianDefault({ fields: {} })).toBeNull();
});
test("getUrlDefault", function () {
    expect(getUrlDefault({ key: "" })).toBe("javascript://");
});
test("getTeamKeyDefault", function () {
    expect(getTeamKeyDefault({ key: "a-b-c" })).toBe("a");
});
test("getTypeDefault", function () {
    expect(getTypeDefault({ fields: { "Issue Type": { hierarchyLevel: 7, name: "issue type" } } })).toBe("issue type");
    expect(getTypeDefault({ fields: {} })).toBeNull();
});
test("getVelocityDefault", function () {
    expect(getVelocityDefault("")).toBe(21);
});
test("getParallelWorkLimitDefault", function () {
    expect(getParallelWorkLimitDefault("")).toBe(1);
});
test("getSprintsDefault", function () {
    var sprints = [{ name: "hello", startDate: "20220715", endDate: "20220716" }];
    var startDate = new Date("20220715");
    var endDate = new Date("20220716");
    expect(getSprintsDefault({ fields: { Sprint: sprints } })).toEqual([{ name: "hello", startDate: startDate, endDate: endDate }]);
    expect(getSprintsDefault({ fields: {} })).toBeNull();
});
test("getStatusDefault", function () {
    expect(getStatusDefault({ fields: { Status: { name: "issue type", statusCategory: { name: "" } } } })).toBe("issue type");
    expect(getStatusDefault({ fields: {} })).toBeNull();
});
test("getLabelsDefault", function () {
    expect(getLabelsDefault({ fields: { Labels: ["label"] } })).toEqual(["label"]);
    expect(getLabelsDefault({ fields: {} })).toEqual([]);
});
test("getStatusCategoryDefault", function () {
    expect(getStatusCategoryDefault({ fields: { Status: { name: "issue type", statusCategory: { name: "category" } } } })).toBe("category");
    expect(getStatusCategoryDefault({ fields: {} })).toBeNull();
});
test("getRankDefault", function () {
    expect(getRankDefault({ fields: { Rank: "1" } })).toBe("1");
    expect(getRankDefault({ fields: {} })).toBeNull();
});
test.todo("getReleaseDefault");
test.only("normalizeIssue", function () {
    var startDate = new Date("20220715");
    var dueDate = new Date("20220716");
    var issue = {
        id: "1",
        key: "test-key",
        fields: {
            Summary: "language packs",
            "Issue Type": "Epic",
            Created: "2023-02-03T10:58:38.994-0600",
            Sprint: null,
            "Fix versions": [
                {
                    self: "https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/3/version/10006",
                    id: "10006",
                    description: "",
                    name: "SHARE_R1",
                    archived: false,
                    released: false,
                },
            ],
            "Epic Link": null,
            Labels: ["JTR-Testing"],
            "Start date": "20220715",
            "Parent Link": "IMP-5",
            Rank: "0|hzzzzn:",
            "Due date": "20220716",
            Status: "Done",
            "Project key": "ORDER",
            "Issue key": "ORDER-15",
            url: "https://bitovi-training.atlassian.net/browse/ORDER-15",
            workType: "dev",
            workingBusinessDays: 27,
            weightedEstimate: null,
        },
    };
    expect(normalizeIssue(issue)).toEqual({
        summary: "language packs",
        key: "test-key",
        parentKey: "IMP-5",
        confidence: null,
        dueDate: dueDate,
        hierarchyLevel: null,
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
        statusCategory: null,
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
test.todo("allStatusSorted");
test.todo("allReleasesSorted");
//# sourceMappingURL=normalize.test.js.map