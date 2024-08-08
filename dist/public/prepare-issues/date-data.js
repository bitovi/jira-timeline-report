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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { parseDateISOString, parseDateIntoLocalTimezone } from "../date-helpers.js";
import { mostCommonElement } from "../shared/array-helpers.js";
// GET DATA FROM PLACES DIRECTLY RELATED TO ISSUE
export function getStartDateAndDueDataFromFields(issue) {
    var startData, dueData;
    if (issue["Start date"]) {
        startData = {
            start: parseDateIntoLocalTimezone(issue["Start date"]),
            startFrom: {
                message: "start date",
                reference: issue
            }
        };
    }
    if (issue["Due date"]) {
        dueData = {
            due: parseDateIntoLocalTimezone(issue["Due date"]),
            dueTo: {
                message: "due date",
                reference: issue
            }
        };
    }
    return { startData: startData, dueData: dueData };
}
export function getStartDateAndDueDataFromSprints(story) {
    var records = [];
    if (story.Sprint) {
        for (var _i = 0, _a = story.Sprint; _i < _a.length; _i++) {
            var sprint = _a[_i];
            if (sprint) {
                records.push({
                    startData: {
                        start: parseDateISOString(sprint["startDate"]),
                        startFrom: {
                            message: "".concat(sprint.name),
                            reference: story
                        }
                    },
                    dueData: {
                        due: parseDateISOString(sprint["endDate"]),
                        dueTo: {
                            message: "".concat(sprint.name),
                            reference: story
                        }
                    }
                });
            }
            else {
            }
        }
    }
    return mergeStartAndDueData(records);
}
export function mergeStartAndDueData(records) {
    var startData = records.filter(function (record) { return record === null || record === void 0 ? void 0 : record.startData; }).map(function (record) { return record.startData; });
    var dueData = records.filter(function (record) { return record === null || record === void 0 ? void 0 : record.dueData; }).map(function (record) { return record.dueData; });
    return {
        startData: startData.sort(function (d1, d2) { return d1.start - d2.start; })[0],
        dueData: dueData.sort(function (d1, d2) { return d2.due - d1.due; })[0]
    };
}
export function getStartDateAndDueDataFromFieldsOrSprints(issue) {
    return mergeStartAndDueData([
        getStartDateAndDueDataFromFields(issue),
        getStartDateAndDueDataFromSprints(issue)
    ]);
}
export function parentFirstThenChildren(getIssueDateData, getChildDateData) {
    var issueDateData = getIssueDateData();
    var childrenDateData = getChildDateData();
    if (issueDateData.startData && issueDateData.dueData) {
        return issueDateData;
    }
    return {
        startData: issueDateData.startData || childrenDateData.startData,
        dueData: issueDateData.dueData || childrenDateData.dueData,
    };
}
export function childrenOnly(getIssueDateData, getChildDateData) {
    return getChildDateData();
}
export function parentOnly(getIssueDateData, getChildDateData) {
    // eventually we can look to remove these. Some code still depends on having children everywhere
    getChildDateData();
    return getIssueDateData();
}
export function childrenFirstThenParent(getIssueDateData, getChildDateData) {
    var childrenDateData = getChildDateData();
    if (childrenDateData.startData && childrenDateData.dueData) {
        return childrenDateData;
    }
    var issueDateData = getIssueDateData();
    return {
        startData: childrenDateData.startData || issueDateData.startData,
        dueData: childrenDateData.dueData || issueDateData.dueData,
    };
}
export function widestRange(getIssueDateData, getChildDateData) {
    var childrenDateData = getChildDateData();
    var issueDateData = getIssueDateData();
    // eventually might want the reason to be more the parent ... but this is fine for now
    return mergeStartAndDueData([childrenDateData, issueDateData]);
}
var methods = {
    parentFirstThenChildren: parentFirstThenChildren,
    childrenOnly: childrenOnly,
    childrenFirstThenParent: childrenFirstThenParent,
    widestRange: widestRange,
    parentOnly: parentOnly
};
export var calculationKeysToNames = {
    parentFirstThenChildren: function (parent, child) {
        return "From ".concat(parent.type, ", then ").concat(child.plural);
    },
    childrenOnly: function (parent, child) {
        return "From ".concat(child.plural);
    },
    childrenFirstThenParent: function (parent, child) {
        return "From ".concat(child.plural, ", then ").concat(parent.type);
    },
    widestRange: function (parent, child) {
        return "From ".concat(parent.type, " or ").concat(child.plural, " (earliest to latest)");
    },
    parentOnly: function (parent, child) {
        return "From ".concat(parent.type);
    }
};
export function getIssueWithDateData(issue, childMap, methodNames, index) {
    if (methodNames === void 0) { methodNames = ["childrenOnly", "parentFirstThenChildren"]; }
    if (index === void 0) { index = 0; }
    // by default we stop recursion
    var methodName = methodNames[index] ? methodNames[index] : "parentOnly";
    index++;
    var method = methods[methodName];
    var issueClone = __assign(__assign({}, issue), { dateData: {
            rollup: {}
        } });
    var dateData = method(function getParentData() {
        var selfDates = getStartDateAndDueDataFromFieldsOrSprints(issue);
        issueClone.dateData.self = addDateDataTo({}, selfDates);
        return selfDates;
    }, function getChildrenData() {
        var children = childMap[issue["Issue key"]] || [];
        var datedChildren = children.map(function (child) {
            return getIssueWithDateData(child, childMap, methodNames, index);
        });
        var childrenData = mergeStartAndDueData(datedChildren.map(getDataDataFromDatedIssue));
        issueClone.dateData.children = addDateDataTo({
            issues: datedChildren
        }, childrenData);
        return childrenData;
    });
    addDateDataTo(issueClone.dateData.rollup, dateData);
    return issueClone;
}
function addDateDataTo(object, dateData) {
    if (object === void 0) { object = {}; }
    Object.assign(object, dateData.startData);
    Object.assign(object, dateData.dueData);
    return object;
}
function getDataDataFromDatedIssue(issue) {
    var startData, dueData;
    if (issue.dateData.rollup.start) {
        startData = { start: issue.dateData.rollup.start, startFrom: issue.dateData.rollup.startFrom };
    }
    if (issue.dateData.rollup.due) {
        dueData = { due: issue.dateData.rollup.due, dueTo: issue.dateData.rollup.dueTo };
    }
    return { startData: startData, dueData: dueData };
}
// provides an object with rolled updates
export function rollupDatesFromRollups(issues) {
    var dateData = mergeStartAndDueData(issues.map(getDataDataFromDatedIssue));
    return __assign(__assign(__assign({}, dateData.startData), dateData.dueData), { issues: issues });
}
/**
 *
 * @param {Array<import("../shared/issue-data/issue-data.js").NormalizedIssue>} normalizedIssues
 * @returns {Array<{type: string, hierarchyLevel: number}>}
 */
function issueHierarchy(normalizedIssues) {
    var levelsToNames = [];
    for (var _i = 0, normalizedIssues_1 = normalizedIssues; _i < normalizedIssues_1.length; _i++) {
        var issue = normalizedIssues_1[_i];
        if (!levelsToNames[issue.hierarchyLevel]) {
            levelsToNames[issue.hierarchyLevel] = [];
        }
        levelsToNames[issue.hierarchyLevel].push(issue.type);
    }
    return levelsToNames.map(function (names, i) {
        return { type: mostCommonElement(names), hierarchyLevel: i };
    }).filter(function (i) { return i; });
}
/**
 * @type {{
 *  child: String,
 *  parent: String,
 *  calculation: string,
 *  name: string
 * }} ChildCalculationOption
 */
/**
 * @type {{
 *   type: string,
 *   plural: string,
 *   children: Array<string>,
 *   availableTimingCalculations: Array<String>,
 *   denormalizedChildren: Array<IssueDateRollupObject>,
 *   timingCalculations: Array<{child: string, calculations: Array<ChildCalculationOption>}>,
 *   timingCalculationsMap: Object<string, Array<ChildCalculationOption>>
 * }} IssueDateRollupObject
 */
/**
 * @type {Object<string, IssueDateRollupObject>} TimingCalculationsMap
 */
/**
 *
 * @param {import("../shared/issue-data/issue-data.js").NormalizedIssue} normalizedIssues
 * @returns {Array<IssueDateRollupObject> & {typeToIssueType: IssueDateRollupObject}}
 */
export function allTimingCalculationOptions(normalizedIssues) {
    var hierarchy = issueHierarchy(normalizedIssues).reverse();
    var issueOnlyHierarchy = hierarchy.map(function (_a, index) {
        var type = _a.type, hierarchyLevel = _a.hierarchyLevel;
        // if the last thing
        if (!hierarchy[index + 1]) {
            return { type: type, hierarchyLevel: hierarchyLevel, plural: type + "s", children: [], availableTimingCalculations: ["parentOnly"] };
        }
        else {
            return { type: type, hierarchyLevel: hierarchyLevel, plural: type + "s", children: [hierarchy[index + 1].type], availableTimingCalculations: "*" };
        }
    });
    var base = __spreadArray([
        { type: "Release", plural: "Releases", children: hierarchy.map(function (h) { return h.type; }), availableTimingCalculations: ["childrenOnly"] }
    ], issueOnlyHierarchy, true);
    // the base object
    var typeToIssueType = {};
    for (var _i = 0, base_1 = base; _i < base_1.length; _i++) {
        var issueType = base_1[_i];
        typeToIssueType[issueType.type] = issueType;
    }
    var allCalculations = Object.keys(calculationKeysToNames);
    var _loop_1 = function (issueType) {
        // add the denormalized children, so they can be references back to the original object
        issueType.denormalizedChildren = issueType.children.map(function (typeName) { return typeToIssueType[typeName]; });
        var calcNames = issueType.availableTimingCalculations === "*" ? allCalculations : issueType.availableTimingCalculations;
        var childToTimingMap = {};
        issueType.timingCalculations = [];
        var _loop_2 = function (issueTypeName) {
            // for each child issue, create a map of each type
            childToTimingMap[issueTypeName] = calcNames.map(function (calculationName) {
                return {
                    child: issueTypeName, parent: issueType.type,
                    calculation: calculationName, name: calculationKeysToNames[calculationName](issueType, typeToIssueType[issueTypeName])
                };
            });
            // an array of what's above
            issueType.timingCalculations.push({ child: issueTypeName, calculations: childToTimingMap[issueTypeName] });
        };
        for (var _b = 0, _c = issueType.children; _b < _c.length; _b++) {
            var issueTypeName = _c[_b];
            _loop_2(issueTypeName);
        }
        issueType.timingCalculationsMap = childToTimingMap;
    };
    for (var _a = 0, base_2 = base; _a < base_2.length; _a++) {
        var issueType = base_2[_a];
        _loop_1(issueType);
    }
    return {
        list: base,
        map: typeToIssueType
    };
}
export function denormalizedIssueHierarchy(normalizedIssues) {
    var hierarchy = issueHierarchy(normalizedIssues).reverse();
    var issueOnlyHierarchy = hierarchy.map(function (_a, index) {
        var type = _a.type, hierarchyLevel = _a.hierarchyLevel;
        // if the last thing
        if (!hierarchy[index + 1]) {
            return { type: type, hierarchyLevel: hierarchyLevel, plural: type + "s", children: [], availableTimingCalculations: ["parentOnly"] };
        }
        else {
            return { type: type, hierarchyLevel: hierarchyLevel, plural: type + "s", children: [hierarchy[index + 1].type], availableTimingCalculations: "*" };
        }
    });
    var base = __spreadArray([
        { type: "Release", plural: "Releases", children: hierarchy.map(function (h) { return h.type; }), availableTimingCalculations: ["childrenOnly"] }
    ], issueOnlyHierarchy, true);
    /*
    const base = [
      { type: "Release",    plural: "Releases", children: ["Initiative","Epic","Story"], availableTimingCalculations: ["childrenOnly"]},
      { type: "Initiative", plural: "Initiatives", children: ["Epic"], availableTimingCalculations: "*" },
      { type: "Epic", plural: "Epics", children: ["Story"], availableTimingCalculations: "*" },
      { type: "Story", plural: "Stories", children: [], availableTimingCalculations: ["parentOnly"] }
    ];*/
    // the base object
    var typeToIssueType = {};
    for (var _i = 0, base_3 = base; _i < base_3.length; _i++) {
        var issueType = base_3[_i];
        typeToIssueType[issueType.type] = issueType;
    }
    var allCalculations = Object.keys(calculationKeysToNames);
    var _loop_3 = function (issueType) {
        // add the denormalized children, so they can be references back to the original object
        issueType.denormalizedChildren = issueType.children.map(function (typeName) { return typeToIssueType[typeName]; });
        var calcNames = issueType.availableTimingCalculations === "*" ? allCalculations : issueType.availableTimingCalculations;
        var childToTimingMap = {};
        issueType.timingCalculations = [];
        var _loop_4 = function (issueTypeName) {
            // for each child issue, create a map of each type
            childToTimingMap[issueTypeName] = calcNames.map(function (calculationName) {
                return {
                    child: issueTypeName, parent: issueType.type,
                    calculation: calculationName, name: calculationKeysToNames[calculationName](issueType, typeToIssueType[issueTypeName])
                };
            });
            // an array of what's above
            issueType.timingCalculations.push({ child: issueTypeName, calculations: childToTimingMap[issueTypeName] });
        };
        for (var _b = 0, _c = issueType.children; _b < _c.length; _b++) {
            var issueTypeName = _c[_b];
            _loop_4(issueTypeName);
        }
        issueType.timingCalculationsMap = childToTimingMap;
    };
    for (var _a = 0, base_4 = base; _a < base_4.length; _a++) {
        var issueType = base_4[_a];
        _loop_3(issueType);
    }
    base.typeToIssueType = typeToIssueType;
    return base;
}
export function getImpliedTimingCalculations(primaryIssueType, issueTypeMap, currentTimingCalculations) {
    var primaryType = issueTypeMap[primaryIssueType];
    // can happen while data is loading
    if (!primaryType) {
        return [];
    }
    var currentType = primaryIssueType;
    var childrenCalculations = primaryType.timingCalculations;
    var timingLevels = [];
    var setCalculations = __spreadArray([], currentTimingCalculations, true);
    var impliedTimingCalculations = [];
    while (childrenCalculations.length) {
        // this is the calculation that should be selected for that level
        var setLevelCalculation = setCalculations.shift() ||
            {
                type: childrenCalculations[0].child,
                calculation: childrenCalculations[0].calculations[0].calculation
            };
        impliedTimingCalculations.push(setLevelCalculation);
        currentType = setLevelCalculation.type;
        childrenCalculations = issueTypeMap[currentType].timingCalculations;
    }
    return impliedTimingCalculations;
}
