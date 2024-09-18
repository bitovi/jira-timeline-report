import { expect, it } from "vitest";
import { getConfidenceDefault, getDueDateDefault, getHierarchyLevelDefault, getLabelsDefault, getParallelWorkLimitDefault, getRankDefault, getSprintsDefault, getStartDateDefault, getStatusCategoryDefault, getStatusDefault, getStoryPointsDefault, getStoryPointsMedianDefault, getTeamKeyDefault, getTypeDefault, getUrlDefault, getVelocityDefault, } from "./normalize";
it("getConfidenceDefault", function () {
    expect(getConfidenceDefault({ fields: { Confidence: 20 } })).toBe(20);
    expect(getConfidenceDefault({ fields: { "Story points confidence": 10 } })).toBe(10);
    expect(getConfidenceDefault({ fields: {} })).toBeNull();
    expect(getConfidenceDefault({ fields: { "Story points confidence": 10, Confidence: 20 } })).toBe(10);
});
it("getDueDataDefault", function () {
    var date = new Date().toString();
    expect(getDueDateDefault({ fields: { "Due date": date } })).toBe(date);
    expect(getDueDateDefault({ fields: {} })).toBeNull();
});
it("getHierarchyLevelDefault", function () {
    expect(getHierarchyLevelDefault({ fields: { "Issue Type": { name: "", hierarchyLevel: 7 } } })).toBe(7);
    expect(getHierarchyLevelDefault({ fields: {} })).toBeNull();
});
it.todo("getParentKeyDefault");
it("getStartDateDefault", function () {
    var date = new Date().toString();
    expect(getStartDateDefault({ fields: { "Start date": date } })).toBe(date);
    expect(getStartDateDefault({ fields: {} })).toBeNull();
});
it("getStoryPointsDefault", function () {
    expect(getStoryPointsDefault({ fields: { "Story points": 3 } })).toBe(3);
    expect(getStoryPointsDefault({ fields: {} })).toBeNull();
});
it("getStoryPointsMedianDefault", function () {
    expect(getStoryPointsMedianDefault({ fields: { "Story points median": 3 } })).toBe(3);
    expect(getStoryPointsMedianDefault({ fields: {} })).toBeNull();
});
it("getUrlDefault", function () {
    expect(getUrlDefault({ key: "" })).toBe("javascript://");
});
it("getTeamKeyDefault", function () {
    expect(getTeamKeyDefault({ key: "a-b-c" })).toBe("a");
});
it("getTypeDefault", function () {
    expect(getTypeDefault({ fields: { "Issue Type": { hierarchyLevel: 7, name: "issue type" } } })).toBe("issue type");
    expect(getTypeDefault({ fields: {} })).toBeNull();
});
it("getVelocityDefault", function () {
    expect(getVelocityDefault("")).toBe(21);
});
it("getParallelWorkLimitDefault", function () {
    expect(getParallelWorkLimitDefault("")).toBe(1);
});
it("getSprintsDefault", function () {
    var sprints = [{ name: "hello", startDate: "20220715", endDate: "20220716" }];
    var startDate = new Date("20220715");
    var endDate = new Date("20220716");
    expect(getSprintsDefault({ fields: { Sprint: sprints } })).toEqual([{ name: "hello", startDate: startDate, endDate: endDate }]);
    expect(getSprintsDefault({ fields: {} })).toBeNull();
});
it("getStatusDefault", function () {
    expect(getStatusDefault({ fields: { Status: { name: "issue type", statusCategory: { name: "" } } } })).toBe("issue type");
    expect(getStatusDefault({ fields: {} })).toBeNull();
});
it("getLabelsDefault", function () {
    expect(getLabelsDefault({ fields: { Labels: ["label"] } })).toEqual(["label"]);
    expect(getLabelsDefault({ fields: {} })).toEqual([]);
});
it("getStatusCategoryDefault", function () {
    expect(getStatusCategoryDefault({ fields: { Status: { name: "issue type", statusCategory: { name: "category" } } } })).toBe("category");
    expect(getStatusCategoryDefault({ fields: {} })).toBeNull();
});
it("getRankDefault", function () {
    expect(getRankDefault({ fields: { Rank: 1 } })).toBe(1);
    expect(getRankDefault({ fields: {} })).toBeNull();
});
//# sourceMappingURL=normalize.test.js.map