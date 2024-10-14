import { expect, test } from "vitest";

import {
  getConfidenceDefault,
  getDaysPerSprintDefault,
  getDueDateDefault,
  getHierarchyLevelDefault,
  getLabelsDefault,
  getParallelWorkLimitDefault,
  getParentKeyDefault,
  getRankDefault,
  getReleasesDefault,
  getSprintsDefault,
  getStartDateDefault,
  getStatusCategoryDefault,
  getStatusDefault,
  getStoryPointsDefault,
  getStoryPointsMedianDefault,
  getTeamKeyDefault,
  getTypeDefault,
  getUrlDefault,
  getVelocityDefault,
} from "./defaults";
import { IssueFields, JiraIssue, ParentIssue } from "../shared/types";

const createFields = (overrides: Partial<IssueFields> = {}): Pick<JiraIssue, "fields"> => {
  return {
    fields: {
      Parent: {} as ParentIssue,
      Summary: "summary",
      Sprint: null,
      Labels: [],
      "Issue Type": { hierarchyLevel: 1, name: "test" },
      Status: { id: "1", name: "status", statusCategory: { name: "category" } },
      "Fix versions": [],
      Team: null,
      ...overrides,
    },
  };
};

test("getConfidenceDefault", () => {
  expect(getConfidenceDefault({ ...createFields({ Confidence: 20 }) })).toBe(20);
  expect(getConfidenceDefault({ ...createFields({ "Story points confidence": 10 }) })).toBe(10);
  expect(getConfidenceDefault({ ...createFields() })).toBeNull();

  expect(
    getConfidenceDefault({
      ...createFields({ "Story points confidence": 10, Confidence: 20 }),
    })
  ).toBe(10);
});

test("getDueDataDefault", () => {
  const date = new Date().toString();

  expect(getDueDateDefault({ ...createFields({ "Due date": date }) })).toBe(date);
  expect(getDueDateDefault({ ...createFields() })).toBeNull();
});

test("getHierarchyLevelDefault", () => {
  expect(
    getHierarchyLevelDefault({
      ...createFields({ "Issue Type": { name: "", hierarchyLevel: 7 } }),
    })
  ).toBe(7);
});

test("getParentKeyDefault", () => {
  expect(
    getParentKeyDefault({
      ...createFields({
        Parent: {
          key: "parent",
          id: "",
          fields: {
            issuetype: { name: "", hierarchyLevel: 8 },
            summary: "",
            status: { name: "" },
          },
        },
      }),
    })
  ).toBe("parent");
  expect(
    getParentKeyDefault({
      ...createFields({ "Parent Link": { data: { key: "link" } } }),
    })
  ).toBe("link");
});

test("getDaysPerSprintDefault", () => {
  expect(getDaysPerSprintDefault("")).toBe(10);
});

test("getStartDateDefault", () => {
  const date = new Date().toString();

  expect(getStartDateDefault({ ...createFields({ "Start date": date }) })).toBe(date);
  expect(getStartDateDefault({ ...createFields() })).toBeNull();
});

test("getStoryPointsDefault", () => {
  expect(getStoryPointsDefault({ ...createFields({ "Story points": 3 }) })).toBe(3);
  expect(getStoryPointsDefault({ ...createFields() })).toBeNull();
});

test("getStoryPointsMedianDefault", () => {
  expect(
    getStoryPointsMedianDefault({
      ...createFields({ "Story points median": 3 }),
    })
  ).toBe(3);
  expect(getStoryPointsMedianDefault({ ...createFields() })).toBeNull();
});

test("getUrlDefault", () => {
  expect(getUrlDefault({ key: "" })).toBe("javascript://");
});

test("getTeamKeyDefault", () => {
  expect(getTeamKeyDefault({ key: "a-b-c", ...createFields() })).toBe("a");
});

test("getTypeDefault", () => {
  expect(
    getTypeDefault({
      ...createFields({
        "Issue Type": { hierarchyLevel: 7, name: "issue type" },
      }),
    })
  ).toBe("issue type");
});

test("getVelocityDefault", () => {
  expect(getVelocityDefault("")).toBe(21);
});

test("getParallelWorkLimitDefault", () => {
  expect(getParallelWorkLimitDefault("")).toBe(1);
});

test("getSprintsDefault", () => {
  const sprints = [{ id: "1", name: "hello", startDate: "20220715", endDate: "20220716" }];

  const startDate = new Date("20220715");
  const endDate = new Date("20220716");

  expect(getSprintsDefault({ ...createFields({ Sprint: sprints }) })).toEqual([{ name: "hello", startDate, endDate }]);
  expect(getSprintsDefault({ ...createFields() })).toBeNull();
});

test("getStatusDefault", () => {
  expect(
    getStatusDefault({
      ...createFields({
        Status: { id: "1", name: "issue type", statusCategory: { name: "" } },
      }),
    })
  ).toBe("issue type");
});

test("getLabelsDefault", () => {
  expect(getLabelsDefault({ ...createFields({ Labels: ["label"] }) })).toEqual(["label"]);
  expect(getLabelsDefault({ ...createFields() })).toEqual([]);
});

test("getStatusCategoryDefault", () => {
  expect(
    getStatusCategoryDefault({
      ...createFields({
        Status: {
          id: "1",
          name: "issue type",
          statusCategory: { name: "category" },
        },
      }),
    })
  ).toBe("category");
});

test("getRankDefault", () => {
  expect(getRankDefault({ ...createFields({ Rank: "1" }) })).toBe("1");
  expect(getRankDefault({ ...createFields() })).toBeNull();
});

test("getReleaseDefault", () => {
  expect(getReleasesDefault({ ...createFields({ "Fix versions": undefined }) })).toEqual([]);
  expect(getReleasesDefault({ ...createFields({ "Fix versions": [] }) })).toEqual([]);
  expect(
    getReleasesDefault({
      ...createFields({
        "Fix versions": [
          {
            id: "1",
            name: "release",
            archived: false,
            description: "description",
            released: false,
            self: "self-string",
          },
        ],
      }),
    })
  ).toEqual([
    {
      name: "release",
      id: "1",
      type: "Release",
      key: "SPECIAL:release-release",
      summary: "release",
    },
  ]);
});
