
import { rollupGroupedHierarchy, groupIssuesByHierarchyLevelOrType, zipRollupDataOntoGroupedData } from "../rollup";


export const methods = {
    parentFirstThenChildren,
    childrenOnly,
    childrenFirstThenParent,
    widestRange,
    parentOnly
}




/**
 * 
 * @param {Array<import("../rollup").IssuesOrReleases>} issuesOrReleases Starting from low to high
 * @param {Array<String>} methodNames Starting from low to high
 * @return {Array<RollupDateData>}
 */
export function rollupDates(groupedHierarchy, methodNames, {getChildren}  = {}) {
    return rollupGroupedHierarchy(groupedHierarchy, {
        createRollupDataFromParentAndChild(issueOrRelease, children, hierarchyLevel, metadata){
            const methodName = methodNames[hierarchyLevel] || "childrenFirstThenParent";
            const method = methods[methodName];
            return method(issueOrRelease, children);
        }
    });
}

/**
 * @typedef {{
 *   due: Date,
 *   dueTo: {message: String, reference: Object},
 *   start: Date,
 *   startFrom: {message: String, reference: Object}
 * } | {}} RollupDateData
 */

/**
 * @typedef {import("../rollup").IssueOrRelease & {rollupDates: RollupDateData}} RolledupDatesReleaseOrIssue
 */


/**
 * 
 * @param {import("../rollup").IssuesOrReleases} issuesOrReleases 
 * @param {{type: String, hierarchyLevel: Number, calculation: String}} rollupTimingLevelsAndCalculations 
 * @return {Array<RolledupDatesReleaseOrIssue>}
 */
export function addRollupDates(issuesOrReleases, rollupTimingLevelsAndCalculations){
    const groupedIssues = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTimingLevelsAndCalculations);
    const rollupMethods = rollupTimingLevelsAndCalculations.map( rollupData => rollupData.calculation).reverse();
    const rolledUpDates = rollupDates(groupedIssues, rollupMethods);
    const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpDates, "rollupDates");
    return zipped.flat();
}

function makeQuickCopyDefinedProperties(keys) {
    return function copy(source) {
        const obj = {};
        for(let key of keys) {
            if(source[key] !== undefined) {
                obj[key] = source[key];
            }
        }
        return obj;
    }
}
// makes testing easier if we don't create a bunch of "undefined" properties
const getStartData = makeQuickCopyDefinedProperties(["start","startFrom"])
const getDueData = makeQuickCopyDefinedProperties(["due","dueTo"])

export function mergeStartAndDueData(records){
    
    const startData = records.filter( record => record?.start ).map(getStartData);
    const dueData = records.filter( record => record?.due ).map( getDueData );

    return {
        ... (startData.length ? startData.sort( (d1, d2) => d1.start - d2.start )[0] : {}),
        ... (dueData.length ? dueData.sort( (d1, d2) => d2.due - d1.due )[0] : {})
    }
}

/**
 * 
 * @param {import("../rollup").IssueOrRelease} parentIssueOrRelease 
 * @param {*} childrenRollups 
 * @returns 
 */
export function parentFirstThenChildren(parentIssueOrRelease, childrenRollups){

    const childData = mergeStartAndDueData(childrenRollups);
    const parentData = parentIssueOrRelease?.derivedTiming;

    const parentHasStart = parentData?.start;
    const parentHasDue = parentData?.due;

    const combinedData = {
        start: parentHasStart ? parentData?.start : childData?.start,
        startFrom: parentHasStart ? parentData?.startFrom : childData?.startFrom,
        due: parentHasDue ? parentData?.due : childData?.due,
        dueTo: parentHasDue ? parentData?.dueTo : childData?.dueTo
    }

    return {
        ...getStartData(combinedData),
        ...getDueData(combinedData)
    };
}

export function childrenOnly(parentIssueOrRelease, childrenRollups){
    return mergeStartAndDueData(childrenRollups);
}

export function parentOnly(parentIssueOrRelease, childrenRollups){
    return {
        ...getStartData(parentIssueOrRelease.derivedTiming),
        ...getDueData(parentIssueOrRelease.derivedTiming)
    };
}

export function childrenFirstThenParent(parentIssueOrRelease, childrenRollups){
    if(childrenRollups.length) {
        return mergeStartAndDueData(childrenRollups);
    } 
    return mergeStartAndDueData([parentIssueOrRelease.derivedTiming])
}

export function widestRange(parentIssueOrRelease, childrenRollups){
    return mergeStartAndDueData([parentIssueOrRelease.derivedTiming, ...childrenRollups]);
}



export const calculationKeysToNames = {
    parentFirstThenChildren: function(parent, child){
        return `From ${parent.type}, then ${child.plural}`
    },
    childrenOnly: function(parent, child){
        return `From ${child.plural}`
    },
    childrenFirstThenParent: function(parent, child){
        return `From ${child.plural}, then ${parent.type}`
    },
    widestRange: function(parent, child){
        return `From ${parent.type} or ${child.plural} (earliest to latest)`
    },
    parentOnly: function(parent, child){
        return `From ${parent.type}`
    }
}