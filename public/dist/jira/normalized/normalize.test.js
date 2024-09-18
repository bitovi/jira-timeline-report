import { expect, it } from "vitest";
import { getConfidenceDefault, getDueDateDefault, getHierarchyLevelDefault } from "./normalize.js";
it("getConfidenceDefault", function () {
    expect(getConfidenceDefault({ fields: { Confidence: 20 } })).toBe(20);
    expect(getConfidenceDefault({ fields: { "Story points confidence": 10 } })).toBe(10);
    expect(getConfidenceDefault({ fields: {} })).toBeUndefined();
    expect(getConfidenceDefault({ fields: { "Story points confidence": 10, Confidence: 20 } })).toBe(10);
});
it("getDueDataDefault", function () {
    var date = new Date().toString();
    expect(getDueDateDefault({ fields: { "Due date": date } })).toBe(date);
    expect(getDueDateDefault({ fields: {} })).toBeUndefined();
});
it("getHierarchyLevelDefault", function () {
    expect(getHierarchyLevelDefault({ fields: { "Issue Type": { name: "", hierarchyLevel: 7 } } })).toBe(7);
    expect(getHierarchyLevelDefault({ fields: {} })).toBeUndefined();
});
//# sourceMappingURL=normalize.test.js.map