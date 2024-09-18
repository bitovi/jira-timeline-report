import { expect, test } from "vitest";
import { normalizeIssue } from "./normalize";
test("normalizeIssue", function () {
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