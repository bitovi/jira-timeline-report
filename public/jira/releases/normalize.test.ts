import { describe, it, expect } from "vitest";
import { normalizeReleases } from "./normalize";
import { normalizeIssue } from "../normalized/normalize";
import { JiraIssue, NormalizedIssue, ParentIssue } from "../shared/types";

const issue: JiraIssue = {
  id: "1",
  key: "test-key",
  fields: {
    Team: null,
    Parent: {} as ParentIssue,
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
    Status: { id: "1", name: "Done", statusCategory: { name: "Done" } },
    "Project key": "ORDER",
    "Issue key": "ORDER-15",
    url: "https://bitovi-training.atlassian.net/browse/ORDER-15",
    workType: "dev",
    workingBusinessDays: 27,
    weightedEstimate: null,
  },
};

const rollupTimingLevelsAndCalculations = [
  {
    type: "Release",
    hierarchyLevel: null,
    calculation: "childrenOnly",
  },
  {
    type: "Epic",
    hierarchyLevel: 1,
    calculation: "parentFirstThenChildren",
  },
  {
    type: "Story",
    hierarchyLevel: 0,
    calculation: "parentOnly",
  },
];

const derivedIssues = normalizeIssue(issue, {});

describe("normalizeReleases", () => {
  it("should return an empty array when no releases are found", () => {
    const normalizedIssues: Array<NormalizedIssue> = [];
    const result = normalizeReleases(normalizedIssues, rollupTimingLevelsAndCalculations);
    expect(result).toEqual([]);
  });

  it('should normalize releases when the type "Release" exists in rollupTimingLevelsAndCalculations', () => {
    const normalizedIssues = [normalizeIssue(issue, {})];

    const result = normalizeReleases(normalizedIssues, rollupTimingLevelsAndCalculations);

    expect(result).toEqual([
      {
        id: "10006",
        name: "SHARE_R1",
        key: "SPECIAL:release-SHARE_R1",
        summary: "SHARE_R1",
        type: "Release",
      },
    ]);
  });

  it('should return an empty array when there is no "Release" type in rollupTimingLevelsAndCalculations', () => {
    const timingLevelsWithoutRelease = [
      {
        type: "Epic",
        hierarchyLevel: 1,
        calculation: "parentFirstThenChildren",
      },
      {
        type: "Story",
        hierarchyLevel: 0,
        calculation: "parentOnly",
      },
    ];

    const normalizedIssues = [normalizeIssue(issue, {})];

    const result = normalizeReleases(normalizedIssues, timingLevelsWithoutRelease);

    expect(result).toEqual([]);
  });

  it('should return an empty array when there is no following type after "Release"', () => {
    const timingLevelsWithOnlyRelease = [
      {
        type: "Release",
        hierarchyLevel: null,
        calculation: "childrenOnly",
      },
    ];

    const normalizedIssues = [normalizeIssue(issue, {})];

    const result = normalizeReleases(normalizedIssues, timingLevelsWithOnlyRelease);

    expect(result).toEqual([]);
  });

  it("should normalize multiple releases correctly", () => {
    const issueWithMultipleReleases = {
      ...issue,
      fields: {
        ...issue.fields,
        "Fix versions": [
          {
            id: "10006",
            name: "SHARE_R1",
            archived: false,
            description: "description",
            released: false,
            self: "self-string",
          },
          {
            id: "10007",
            name: "SHARE_R2",
            archived: false,
            description: "description for R2",
            released: false,
            self: "self-string-2",
          },
        ],
      },
    };

    const normalizedIssues = [normalizeIssue(issueWithMultipleReleases, {})];

    const result = normalizeReleases(normalizedIssues, rollupTimingLevelsAndCalculations);

    expect(result).toEqual([
      {
        id: "10006",
        name: "SHARE_R1",
        key: "SPECIAL:release-SHARE_R1",
        summary: "SHARE_R1",
        type: "Release",
      },
      {
        id: "10007",
        name: "SHARE_R2",
        key: "SPECIAL:release-SHARE_R2",
        summary: "SHARE_R2",
        type: "Release",
      },
    ]);
  });
});
