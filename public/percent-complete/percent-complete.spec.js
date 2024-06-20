import { describe, expect, test, vitest } from "vitest";
import {
  getConfidence,
  getDaysPerSprint,
  getDueDate,
  getHierarchyLevel,
  getIssueKey,
  getParentKey,
  getStartDate,
  getStoryPoints,
  getStoryPointsMedian,
  getTeamKey,
  getType,
  getVelocity,
} from "../shared/issue-data/issue-data.js";
import {
  buildMap,
  setDurations,
  PercentCompleteOptions,
} from "./percent-complete";

/** @type {PercentCompleteOptions} */
const options = {
  defaultParentDurationDays: 10,
  getConfidence,
  getDaysPerSprint,
  getDueDate,
  getHierarchyLevel,
  getIssueKey,
  getParentKey,
  getStartDate,
  getStoryPoints,
  getStoryPointsMedian,
  getTeamKey,
  getType,
  getVelocity,
  includeTypes: ["Epic"],
  parentType: "Initiative",
  toWholeDay: Math.round,
  uncertaintyWeight: 75,
};

describe("buildMap", () => {
  test("includes all CompletionIssue properties", () => {
    const result = buildMap(
      [
        {
          fields: {
            Confidence: 80,
            "Due date": "2024-10-23",
            "Issue Type": { hierarchyLevel: 1, name: "Epic" },
            "Parent Link": { data: { key: "A" } },
            "Start date": "2024-10-1",
            "Story points": 3,
            "Story points median": 11,
          },
          key: "B",
        },
      ],
      options
    );

    expect(result).toMatchObject({
      A: {
        childKeys: ["B"],
      },
      B: {
        childKeys: [],
        confidence: 80,
        dueDate: "2024-10-23",
        hierarchyLevel: 1,
        key: "B",
        parentKey: "A",
        startDate: "2024-10-1",
        storyPoints: 3,
        storyPointsMedian: 11,
        type: "Epic",
      },
    });
  });
});

describe("setDurations", () => {
  test("child estimated: start and due dates", () => {
    const map = {
      A: {
        childKeys: ["B"],
        type: "Initiative",
      },
      B: {
        childKeys: [],
        confidence: 80,
        dueDate: "2024-10-23",
        hierarchyLevel: 1,
        key: "B",
        parentKey: "A",
        startDate: "2024-10-1",
        storyPoints: 9,
        storyPointsMedian: 11,
        type: "Epic",
      },
    };

    setDurations(map, options);

    expect(map).toMatchObject({
      A: {
        childKeys: ["B"],
        durationDays: 22,
        type: "Initiative",
      },
      B: {
        childKeys: [],
        confidence: 80,
        dueDate: "2024-10-23",
        durationDays: 22,
        hierarchyLevel: 1,
        key: "B",
        parentKey: "A",
        startDate: "2024-10-1",
        storyPoints: 9,
        storyPointsMedian: 11,
        type: "Epic",
      },
    });
  });

  test("child estimated: median and confidence", () => {
    const map = {
      A: {
        childKeys: ["B"],
        type: "Initiative",
      },
      B: {
        childKeys: [],
        confidence: 80,
        dueDate: null,
        hierarchyLevel: 1,
        key: "B",
        parentKey: "A",
        startDate: null,
        storyPoints: 9,
        storyPointsMedian: 11,
        type: "Epic",
      },
    };

    setDurations(map, options);

    expect(map).toMatchObject({
      A: {
        childKeys: ["B"],
        durationDays: 2,
        type: "Initiative",
      },
      B: {
        childKeys: [],
        confidence: 80,
        dueDate: null,
        durationDays: 2,
        hierarchyLevel: 1,
        key: "B",
        parentKey: "A",
        startDate: null,
        storyPointsMedian: 11,
        type: "Epic",
      },
    });
  });

  test("child estimated: story points", () => {
    const map = {
      A: {
        childKeys: ["B"],
        type: "Initiative",
      },
      B: {
        childKeys: [],
        confidence: null,
        dueDate: null,
        hierarchyLevel: 1,
        key: "B",
        parentKey: "A",
        startDate: null,
        storyPoints: 9,
        storyPointsMedian: null,
        type: "Epic",
      },
    };

    setDurations(map, options);

    expect(map).toMatchObject({
      A: {
        childKeys: ["B"],
        durationDays: 9,
        type: "Initiative",
      },
      B: {
        childKeys: [],
        confidence: null,
        dueDate: null,
        durationDays: 9,
        hierarchyLevel: 1,
        key: "B",
        parentKey: "A",
        startDate: null,
        storyPointsMedian: null,
        type: "Epic",
      },
    });
  });
});
