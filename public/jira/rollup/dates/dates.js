
import { rollupGroupedHierarchy } from "../rollup";

const methods = {
    parentFirstThenChildren,
    childrenOnly,
    childrenFirstThenParent,
    widestRange,
    parentOnly
}


/**
 * 
 * @param {Array<import("../rollup").IssuesOrReleases>} issuesOrReleases 
 * @param {Array<String>} methodNames 
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


export function parentFirstThenChildren(getIssueDateData, getChildDateData){
    const issueDateData = getIssueDateData();
    const childrenDateData = getChildDateData();
    if(issueDateData.startData && issueDateData.dueData) {
        return issueDateData;
    }
    

    return {
        startData: issueDateData.startData || childrenDateData.startData,
        dueData: issueDateData.dueData || childrenDateData.dueData,
    }
}

export function childrenOnly(getIssueDateData, getChildDateData){
    return getChildDateData();
}

export function parentOnly(getIssueDateData, getChildDateData){
    // eventually we can look to remove these. Some code still depends on having children everywhere
    getChildDateData();
    return getIssueDateData();
}

export function childrenFirstThenParent(parentIssueOrRelease, childrenRollups){
    if(childrenRollups.length) {
        return mergeStartAndDueData(childrenRollups);
    } 
    return mergeStartAndDueData([parentIssueOrRelease.derivedTiming])
}

export function widestRange(parentIssueOrRelease, childrenRollups){
    return mergeStartAndDueData([parentIssueOrRelease.derivedTiming, ...childrenRollups]);
    
    const childrenDateData = getChildDateData();
    const issueDateData = getIssueDateData();
    // eventually might want the reason to be more the parent ... but this is fine for now
    return mergeStartAndDueData([childrenDateData, issueDateData]);
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