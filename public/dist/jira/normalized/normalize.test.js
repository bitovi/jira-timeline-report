import { expect, test } from "vitest";
import { getConfidenceDefault, getDueDateDefault, getHierarchyLevelDefault, getLabelsDefault, getParallelWorkLimitDefault, getRankDefault, getSprintsDefault, getStartDateDefault, getStatusCategoryDefault, getStatusDefault, getStoryPointsDefault, getStoryPointsMedianDefault, getTeamKeyDefault, getTypeDefault, getUrlDefault, getVelocityDefault, } from "./normalize";
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
    expect(getRankDefault({ fields: { Rank: 1 } })).toBe(1);
    expect(getRankDefault({ fields: {} })).toBeNull();
});
test.todo("getReleaseDefault");
test.todo("normalizeIssue");
//# sourceMappingURL=normalize.test.js.map