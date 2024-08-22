import { makeGetChildrenFromReportingIssues, rollupGroupedHierarchy, groupIssuesByHierarchyLevelOrType, zipRollupDataOntoGroupedData } from "../../rollup/rollup";
import { mergeStartAndDueData } from "../../rollup/dates/dates";
import { workType as workTypes} from "../../derived/work-status/work-status";

// TODO: 


// this is more like "derived" from "rollup"

// given some "rolled up" dates ....

// Go to each item ... get it's children ... filter by work status type ...
// add those as children ...


/**
 * @typedef {import("../../rollup/dates/dates").RollupDateData & {issueKeys: Array<String>}} DateAndIssueKeys
 */

/**
 * @typedef {{
 *   children: DateAndIssueKeys,
 *   dev: DateAndIssueKeys,
 *   qa: DateAndIssueKeys,
 *   design: DateAndIssueKeys,
 *   uat: DateAndIssueKeys
 * }} WorkTypeRollups
 */



/**
 * @typedef {import("../../rollup/dates/dates").RolledupDatesReleaseOrIssue & {workTypeRollups: WorkTypeRollups}} WorkTypeTimingReleaseOrIssue
 */

/**
 * Children are now recursive
 * @param {Array<import("../../rollup/dates/dates").RolledupDatesReleaseOrIssue>} issuesAndReleases 
 * @return {Array<WorkTypeTimingReleaseOrIssue>}
 */

function rollupDatesByWorkType(issuesAndReleases){
    // lets make the copies b/c we are going to mutate ...
    const copies = issuesAndReleases.map( issue => {
        return {...issue}//Object.create(issue);
    })

    // we probably don't want to assign "issues" if we want to keep things functional ...
    const getChildren = makeGetChildrenFromReportingIssues(copies);

    for(let issue of copies) {
        issue.workTypeRollups = getWorkTypeTimings(issue, getChildren);
    }
    return copies;
}

/**
 * 
 * @param {import("../../rollup/dates/dates").RolledupDatesReleaseOrIssue} issue 
 * @param {function(import("../../rollup/dates/dates").RolledupDatesReleaseOrIssue): Array<import("../../rollup/dates/dates").RolledupDatesReleaseOrIssue>} getChildren 
 */
export function getWorkTypeTimings(issue, getChildren) {
    const children = getChildren(issue);
    const workTypeRollupsStaging = {
        children: {issues: children}
    };
    const workTypeRollups = {};
        
    //issue.workTypeRollups = workTypeRollups;
    // put each child in an array determined by it's workType
    for(let child of children) {
        if(!workTypeRollupsStaging[child.derivedStatus.workType]) {
            workTypeRollupsStaging[child.derivedStatus.workType] = {issues: []};
        }
        workTypeRollupsStaging[child.derivedStatus.workType].issues.push(child);
    }
    // for the workTypes, determine the timing 
    for(let prop in workTypeRollupsStaging) {
        const rollupDates = workTypeRollupsStaging[prop].issues.map( issue => issue.rollupDates );
        workTypeRollups[prop] = mergeStartAndDueData(rollupDates);
        workTypeRollups[prop].issueKeys = workTypeRollupsStaging[prop].issues.map( issue => issue.key);
    }
    return workTypeRollups;
}


/**
 * 
 * @param {Array<import("../rollup").IssuesOrReleases>} issuesOrReleases Starting from low to high
 * @param {Array<String>} methodNames Starting from low to high
 * @return {Array<RollupDateData>}
 */
export function rollupWorkTypeDates(groupedHierarchy, {getChildren}  = {}) {
    return rollupGroupedHierarchy(groupedHierarchy, {
        createRollupDataFromParentAndChild(issueOrRelease, children, hierarchyLevel, metadata){
            //const methodName = methodNames[hierarchyLevel] || "childrenFirstThenParent";
            const method = mergeParentAndChildIfTheyHaveDates //methods[methodName];
            return method(issueOrRelease, children);
        }
    });
}
/**
 * 
 * @param {import("../rollup").IssuesOrReleases} issuesOrReleases 
 * @param {*} rollupTimingLevelsAndCalculations 
 * @return {Array<WorkTypeTimingReleaseOrIssue>}
 */
export function addWorkTypeDates(issuesOrReleases, rollupTimingLevelsAndCalculations){
    const groupedIssues = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTimingLevelsAndCalculations);
    const rollupMethods = rollupTimingLevelsAndCalculations.map( rollupData => rollupData.calculation).reverse();
    const rolledUpDates = rollupWorkTypeDates(groupedIssues);
    const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpDates, "workTypeRollups");
    return zipped.flat();
}



// the problem is that there will ALWAYS be a type ... sometimes be dates 
// so does a parent 
export function childrenFirstThenParent(parentIssueOrRelease, childrenRollups){
    const childData = mergeStartAndDueData(childrenRollups);
   

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




    if(childrenRollups.length) {
        return mergeStartAndDueData(childrenRollups);
    }


    return mergeStartAndDueData([parentIssueOrRelease.derivedTiming])
}

function copyDateProperties(obj) {
    const copy = {};
    for(let key of ["due","dueTo","start","startFrom"]){
        if(obj[key] !== undefined) {
            copy[key] = obj[key]
        }
    }
    return copy;
}


export function mergeParentAndChildIfTheyHaveDates(parentIssueOrRelease, childRollups){
    const rollup = {self: {}, children: {}, combined: {}};
    const parentData = parentIssueOrRelease?.derivedTiming;

    const parentHasStart = parentData?.start;
    const parentHasDue = parentData?.due;
    const hasStartAndDue = parentHasStart && parentHasDue;

    if(hasStartAndDue) {
        // can use the parent;
        rollup.self[parentIssueOrRelease.derivedStatus.workType] = copyDateProperties(parentData);
        rollup.self[parentIssueOrRelease.derivedStatus.workType].issueKeys = [parentIssueOrRelease.key];
    }
    if(!childRollups.length) {
        rollup.combined = rollup.self;
        return rollup;
    }
    const children = rollup.children;
    const combined = rollup.combined;
    for(let workType of workTypes) {
        // combine for children
        const rollupForWorkType = childRollups.map( childRollup => childRollup.combined?.[workType] ).filter(x => x);
        // if the children have something for this type
        if(rollupForWorkType.length) {
            const issues = new Set( rollupForWorkType.map( r => r.issueKeys ).flat(1) );
            const dates  = mergeStartAndDueData(rollupForWorkType);
            dates.issueKeys = [...issues];
            children[workType] = dates;
            // what if the parent has it also
            if(hasStartAndDue && parentIssueOrRelease.derivedStatus.workType === workType) {
                const combinedIssues = new Set( [...issues, parentIssueOrRelease.key] );
                const combinedDates = mergeStartAndDueData([dates, parentData]);
                combinedDates.issueKeys = [...combinedIssues];
                combined[workType] = combinedDates;
            } else {
                combined[workType] = dates;
            }
        } 
        // what if the parent has it
        else if(hasStartAndDue && parentIssueOrRelease.derivedStatus.workType === workType) {
            combined[workType] = rollup.self[workType];
        }
    }
    return rollup;
}



// {children: DATES FROM CHILDREN, QA, UAT, DESIGN, etc}