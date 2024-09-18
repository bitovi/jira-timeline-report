export function getConfidenceDefault(_a) {
    var fields = _a.fields;
    return fields["Story points confidence"] || fields.Confidence;
}
export function getDueDateDefault(_a) {
    var fields = _a.fields;
    return fields === null || fields === void 0 ? void 0 : fields["Due date"];
}
export function getHierarchyLevelDefault(_a) {
    var _b;
    var fields = _a.fields;
    return (_b = fields["Issue Type"]) === null || _b === void 0 ? void 0 : _b.hierarchyLevel;
}
//# sourceMappingURL=normalize.js.map