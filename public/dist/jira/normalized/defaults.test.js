var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { expect, test } from "vitest";
import { getConfidenceDefault, getDaysPerSprintDefault, getDueDateDefault, getHierarchyLevelDefault, getLabelsDefault, getParallelWorkLimitDefault, getParentKeyDefault, getRankDefault, getReleasesDefault, getSprintsDefault, getStartDateDefault, getStatusCategoryDefault, getStatusDefault, getStoryPointsDefault, getStoryPointsMedianDefault, getTeamKeyDefault, getTypeDefault, getUrlDefault, getVelocityDefault, } from "./defaults";
var createFields = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return {
        fields: __assign({ Parent: {}, Summary: "summary", Sprint: null, Labels: [], "Issue Type": { hierarchyLevel: 1, name: "test" }, Status: { name: "status", statusCategory: { name: "category" } }, "Fix versions": [] }, overrides),
    };
};
test("getConfidenceDefault", function () {
    expect(getConfidenceDefault(__assign({}, createFields({ Confidence: 20 })))).toBe(20);
    expect(getConfidenceDefault(__assign({}, createFields({ "Story points confidence": 10 })))).toBe(10);
    expect(getConfidenceDefault(__assign({}, createFields()))).toBeNull();
    expect(getConfidenceDefault(__assign({}, createFields({ "Story points confidence": 10, Confidence: 20 })))).toBe(10);
});
test("getDueDataDefault", function () {
    var date = new Date().toString();
    expect(getDueDateDefault(__assign({}, createFields({ "Due date": date })))).toBe(date);
    expect(getDueDateDefault(__assign({}, createFields()))).toBeNull();
});
test("getHierarchyLevelDefault", function () {
    expect(getHierarchyLevelDefault(__assign({}, createFields({ "Issue Type": { name: "", hierarchyLevel: 7 } })))).toBe(7);
});
test("getParentKeyDefault", function () {
    expect(getParentKeyDefault(__assign({}, createFields({ Parent: { key: "parent" } })))).toBe("parent");
    expect(getParentKeyDefault(__assign({}, createFields({ "Parent Link": { data: { key: "link" } } })))).toBe("link");
});
test("getDaysPerSprintDefault", function () {
    expect(getDaysPerSprintDefault("")).toBe(10);
});
test("getStartDateDefault", function () {
    var date = new Date().toString();
    expect(getStartDateDefault(__assign({}, createFields({ "Start date": date })))).toBe(date);
    expect(getStartDateDefault(__assign({}, createFields()))).toBeNull();
});
test("getStoryPointsDefault", function () {
    expect(getStoryPointsDefault(__assign({}, createFields({ "Story points": 3 })))).toBe(3);
    expect(getStoryPointsDefault(__assign({}, createFields()))).toBeNull();
});
test("getStoryPointsMedianDefault", function () {
    expect(getStoryPointsMedianDefault(__assign({}, createFields({ "Story points median": 3 })))).toBe(3);
    expect(getStoryPointsMedianDefault(__assign({}, createFields()))).toBeNull();
});
test("getUrlDefault", function () {
    expect(getUrlDefault({ key: "" })).toBe("javascript://");
});
test("getTeamKeyDefault", function () {
    expect(getTeamKeyDefault({ key: "a-b-c" })).toBe("a");
});
test("getTypeDefault", function () {
    expect(getTypeDefault(__assign({}, createFields({ "Issue Type": { hierarchyLevel: 7, name: "issue type" } })))).toBe("issue type");
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
    expect(getSprintsDefault(__assign({}, createFields({ Sprint: sprints })))).toEqual([{ name: "hello", startDate: startDate, endDate: endDate }]);
    expect(getSprintsDefault(__assign({}, createFields()))).toBeNull();
});
test("getStatusDefault", function () {
    expect(getStatusDefault(__assign({}, createFields({ Status: { name: "issue type", statusCategory: { name: "" } } })))).toBe("issue type");
});
test("getLabelsDefault", function () {
    expect(getLabelsDefault(__assign({}, createFields({ Labels: ["label"] })))).toEqual(["label"]);
    expect(getLabelsDefault(__assign({}, createFields()))).toEqual([]);
});
test("getStatusCategoryDefault", function () {
    expect(getStatusCategoryDefault(__assign({}, createFields({ Status: { name: "issue type", statusCategory: { name: "category" } } })))).toBe("category");
});
test("getRankDefault", function () {
    expect(getRankDefault(__assign({}, createFields({ Rank: "1" })))).toBe("1");
    expect(getRankDefault(__assign({}, createFields()))).toBeNull();
});
test("getReleaseDefault", function () {
    expect(getReleasesDefault(__assign({}, createFields({ "Fix versions": undefined })))).toEqual([]);
    expect(getReleasesDefault(__assign({}, createFields({ "Fix versions": [] })))).toEqual([]);
    expect(getReleasesDefault(__assign({}, createFields({
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
    })))).toEqual([{ name: "release", id: "1", type: "Release", key: "SPECIAL:release-release", summary: "release" }]);
});
