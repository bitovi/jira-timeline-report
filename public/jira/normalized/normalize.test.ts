import { expect, it } from "vitest";

import {
  getConfidenceDefault,
  getDueDateDefault,
  getHierarchyLevelDefault,
  getParallelWorkLimitDefault,
  getSprintsDefault,
  getStartDateDefault,
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
  expect(getConfidenceDefault({ fields: {} })).toBeUndefined();

  expect(getConfidenceDefault({ fields: { "Story points confidence": 10, Confidence: 20 } })).toBe(10);
});

it("getDueDataDefault", () => {
  const date = new Date().toString();

  expect(getDueDateDefault({ fields: { "Due date": date } })).toBe(date);
  expect(getDueDateDefault({ fields: {} })).toBeUndefined();
});

it("getHierarchyLevelDefault", () => {
  expect(getHierarchyLevelDefault({ fields: { "Issue Type": { name: "", hierarchyLevel: 7 } } })).toBe(7);
  expect(getHierarchyLevelDefault({ fields: {} })).toBeUndefined();
});

it.todo("getParentKeyDefault");

it("getStartDateDefault", () => {
  const date = new Date().toString();

  expect(getStartDateDefault({ fields: { "Start date": date } })).toBe(date);
  expect(getStartDateDefault({ fields: {} })).toBeUndefined();
});

it("getStoryPointsDefault", () => {
  expect(getStoryPointsDefault({ fields: { "Story points": 3 } })).toBe(3);
  expect(getStoryPointsDefault({ fields: {} })).toBeUndefined();
});

it("getStoryPointsMedianDefault", () => {
  expect(getStoryPointsMedianDefault({ fields: { "Story points median": 3 } })).toBe(3);
  expect(getStoryPointsMedianDefault({ fields: {} })).toBeUndefined();
});

it("getUrlDefault", () => {
  expect(getUrlDefault({ key: "" })).toBe("javascript://");
});

it("getTeamKeyDefault", () => {
  expect(getTeamKeyDefault({ key: "a-b-c" })).toBe("a");
});

it("getTypeDefault", () => {
  expect(getTypeDefault({ fields: { "Issue Type": { hierarchyLevel: 7, name: "issue type" } } })).toBe("issue type");
  expect(getTypeDefault({ fields: {} })).toBeUndefined();
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
