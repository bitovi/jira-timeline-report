// public/jira/releases/normalize.test.ts
import { describe, it, expect, test } from 'vitest'
import { normalizeReleases } from './normalize';
import { JiraIssue, NormalizedIssue } from '../normalized/normalize';

const issue: JiraIssue = {
    id: "1",
    key: "test-key",
    fields: {
        Parent: {} as JiraIssue,
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

const normalizedIssue: NormalizedIssue = {
    summary: "language packs",
    key: "test-key",
    parentKey: "IMP-5",
    confidence: null,
    dueDate: new Date("20220716"),
    hierarchyLevel: 1,
    startDate: new Date("20220715"),
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
};

const normalizedIssues = [
    { ...normalizedIssue, type: 'Epic', releases: [{ name: 'Release 1' }, { name: 'Release 2' }] },
    { ...normalizedIssue, type: 'Story', releases: [{ name: 'Release 1' }, { name: 'Release 3' }] },
];
describe('normalizeReleases', () => {
    it('should return an empty array when no releases are found', () => {
        const normalizedIssues = [];
        const rollupTimingLevelsAndCalculations = [{ type: 'Release' }];
        const result = normalizeReleases(normalizedIssues, rollupTimingLevelsAndCalculations);
        expect(result).toEqual([]);
    });

    it('should return an empty array when no releases are found for the following type', () => {
        const normalizedIssueNew: NormalizedIssue = {
            ...normalizedIssue, 
            type: 'Epic', 
            releases: [],
        };
        const rollupTimingLevelsAndCalculations = [{ type: 'Release' }, { type: 'Story' }];
        const result = normalizeReleases([normalizedIssueNew], rollupTimingLevelsAndCalculations);
        expect(result).toEqual([]);
      });

    it('should return a list of unique releases for the following type', () => {
        const normalizedIssueNew: NormalizedIssue = {
            ...normalizedIssue, 
            type: 'Release',
            releases: [
                { id: 'release-1', name: 'Release 1', key: 'SPECIAL:release-1', summary: 'Release 1', type: 'Release' },
                { id: 'release-2', name: 'Release 2', key: 'SPECIAL:release-2', summary: 'Release 2', type: 'Release' },
                { id: 'release-3', name: 'Release 3', key: 'SPECIAL:release-3', summary: 'Release 3', type: 'Release' },
            ],
        };
        const rollupTimingLevelsAndCalculations = [{ type: 'Release' }, { type: 'Release' }];
        const result = normalizeReleases([normalizedIssueNew], rollupTimingLevelsAndCalculations);
        expect(result).toEqual([
            { id: 'release-1', name: 'Release 1', key: 'SPECIAL:release-1', summary: 'Release 1', type: 'Release' },
            { id: 'release-2', name: 'Release 2', key: 'SPECIAL:release-2', summary: 'Release 2', type: 'Release' },
            { id: 'release-3', name: 'Release 3', key: 'SPECIAL:release-3', summary: 'Release 3', type: 'Release' },
        ]);
    });
});
