import { parseDateISOString } from "../../date-helpers.js";
export function getDueDateDefault(_a) {
    var fields = _a.fields;
    return fields["Due date"] || null;
}
export function getStartDateDefault(_a) {
    var fields = _a.fields;
    return fields["Start date"] || null;
}
export function getStoryPointsDefault(_a) {
    var fields = _a.fields;
    return fields["Story points"] || null;
}
export function getStoryPointsMedianDefault(_a) {
    var fields = _a.fields;
    return fields["Story points median"] || null;
}
export function getRankDefault(_a) {
    var fields = _a.fields;
    return (fields === null || fields === void 0 ? void 0 : fields.Rank) || null;
}
export function getConfidenceDefault(_a) {
    var fields = _a.fields;
    return fields["Story points confidence"] || (fields === null || fields === void 0 ? void 0 : fields.Confidence) || null;
}
export function getHierarchyLevelDefault(_a) {
    var fields = _a.fields;
    if (typeof fields["Issue Type"] === "string") {
        return parseInt(fields["Issue Type"], 10);
    }
    return fields["Issue Type"].hierarchyLevel;
}
export function getIssueKeyDefault(_a) {
    var key = _a.key;
    return key;
}
export function getParentKeyDefault(_a) {
    var _b, _c, _d;
    var fields = _a.fields;
    if ((_b = fields === null || fields === void 0 ? void 0 : fields.Parent) === null || _b === void 0 ? void 0 : _b.key) {
        return fields.Parent.key;
    }
    if (typeof fields["Parent Link"] === "string") {
        return fields["Parent Link"];
    }
    // this last part is probably a mistake ...
    return ((_d = (_c = fields["Parent Link"]) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.key) || null;
}
export function getUrlDefault(_a) {
    var key = _a.key;
    return "javascript://";
}
export function getTeamKeyDefault(_a) {
    var key = _a.key;
    return key.replace(/-.*/, "");
}
export function getTypeDefault(_a) {
    var fields = _a.fields;
    if (typeof fields["Issue Type"] === "string") {
        return fields["Issue Type"];
    }
    return fields["Issue Type"].name;
}
export function getSprintsDefault(_a) {
    var fields = _a.fields;
    if (!fields.Sprint) {
        return null;
    }
    return fields.Sprint.map(function (sprint) {
        return {
            name: sprint.name,
            startDate: parseDateISOString(sprint["startDate"]),
            endDate: parseDateISOString(sprint["endDate"]),
        };
    });
}
export function getStatusDefault(_a) {
    var _b;
    var fields = _a.fields;
    if (typeof (fields === null || fields === void 0 ? void 0 : fields.Status) === "string") {
        return fields.Status;
    }
    return ((_b = fields === null || fields === void 0 ? void 0 : fields.Status) === null || _b === void 0 ? void 0 : _b.name) || null;
}
export function getLabelsDefault(_a) {
    var fields = _a.fields;
    return (fields === null || fields === void 0 ? void 0 : fields.Labels) || [];
}
export function getStatusCategoryDefault(_a) {
    var _b, _c;
    var fields = _a.fields;
    if (typeof (fields === null || fields === void 0 ? void 0 : fields.Status) === "string") {
        return null;
    }
    return ((_c = (_b = fields === null || fields === void 0 ? void 0 : fields.Status) === null || _b === void 0 ? void 0 : _b.statusCategory) === null || _c === void 0 ? void 0 : _c.name) || null;
}
export function getReleasesDefault(_a) {
    var fields = _a.fields;
    var fixVersions = fields["Fix versions"];
    if (typeof fixVersions === "string") {
        return [];
    }
    if (!fixVersions) {
        fixVersions = [];
    }
    return fixVersions.map(function (_a) {
        var name = _a.name, id = _a.id;
        return { name: name, id: id, type: "Release", key: "SPECIAL:release-" + name, summary: name };
    });
}
export function getVelocityDefault(teamKey) {
    return 21;
}
export function getParallelWorkLimitDefault(teamKey) {
    return 1;
}
export function getDaysPerSprintDefault(teamKey) {
    return 10;
}
//# sourceMappingURL=defaults.js.map