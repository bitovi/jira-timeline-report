import { expect, it } from "vitest";

import {
  getConfidenceDefault,
  getDueDateDefault,
  getHierarchyLevelDefault,
  getLabelsDefault,
  getParallelWorkLimitDefault,
  getRankDefault,
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
} from "./normalize";

it("getConfidenceDefault", () => {
  expect(getConfidenceDefault({ fields: { Confidence: 20 } })).toBe(20);
  expect(getConfidenceDefault({ fields: { "Story points confidence": 10 } })).toBe(10);
  expect(getConfidenceDefault({ fields: {} })).toBeNull();

  expect(getConfidenceDefault({ fields: { "Story points confidence": 10, Confidence: 20 } })).toBe(10);
});

it("getDueDataDefault", () => {
  const date = new Date().toString();

  expect(getDueDateDefault({ fields: { "Due date": date } })).toBe(date);
  expect(getDueDateDefault({ fields: {} })).toBeNull();
});

it("getHierarchyLevelDefault", () => {
  expect(getHierarchyLevelDefault({ fields: { "Issue Type": { name: "", hierarchyLevel: 7 } } })).toBe(7);
  expect(getHierarchyLevelDefault({ fields: {} })).toBeNull();
});

it.todo("getParentKeyDefault");

it("getStartDateDefault", () => {
  const date = new Date().toString();

  expect(getStartDateDefault({ fields: { "Start date": date } })).toBe(date);
  expect(getStartDateDefault({ fields: {} })).toBeNull();
});

it("getStoryPointsDefault", () => {
  expect(getStoryPointsDefault({ fields: { "Story points": 3 } })).toBe(3);
  expect(getStoryPointsDefault({ fields: {} })).toBeNull();
});

it("getStoryPointsMedianDefault", () => {
  expect(getStoryPointsMedianDefault({ fields: { "Story points median": 3 } })).toBe(3);
  expect(getStoryPointsMedianDefault({ fields: {} })).toBeNull();
});

it("getUrlDefault", () => {
  expect(getUrlDefault({ key: "" })).toBe("javascript://");
});

it("getTeamKeyDefault", () => {
  expect(getTeamKeyDefault({ key: "a-b-c" })).toBe("a");
});

it("getTypeDefault", () => {
  expect(getTypeDefault({ fields: { "Issue Type": { hierarchyLevel: 7, name: "issue type" } } })).toBe("issue type");
  expect(getTypeDefault({ fields: {} })).toBeNull();
});

it("getVelocityDefault", () => {
  expect(getVelocityDefault("")).toBe(21);
});

it("getParallelWorkLimitDefault", () => {
  expect(getParallelWorkLimitDefault("")).toBe(1);
});

it("getSprintsDefault", () => {
  const sprints = [{ name: "hello", startDate: "20220715", endDate: "20220716" }];

  const startDate = new Date("20220715");
  const endDate = new Date("20220716");

  expect(getSprintsDefault({ fields: { Sprint: sprints } })).toEqual([{ name: "hello", startDate, endDate }]);
  expect(getSprintsDefault({ fields: {} })).toBeNull();
});

it("getStatusDefault", () => {
  expect(getStatusDefault({ fields: { Status: { name: "issue type", statusCategory: { name: "" } } } })).toBe(
    "issue type"
  );

  expect(getStatusDefault({ fields: {} })).toBeNull();
});

it("getLabelsDefault", () => {
  expect(getLabelsDefault({ fields: { Labels: ["label"] } })).toEqual(["label"]);
  expect(getLabelsDefault({ fields: {} })).toEqual([]);
});

it("getStatusCategoryDefault", () => {
  expect(
    getStatusCategoryDefault({ fields: { Status: { name: "issue type", statusCategory: { name: "category" } } } })
  ).toBe("category");

  expect(getStatusCategoryDefault({ fields: {} })).toBeNull();
});

it("getRankDefault", () => {
  expect(getRankDefault({ fields: { Rank: 1 } })).toBe(1);
  expect(getRankDefault({ fields: {} })).toBeNull();
});
