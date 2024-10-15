import { makeGetChildrenFromReportingIssues, rollupGroupedHierarchy, groupIssuesByHierarchyLevelOrType, zipRollupDataOntoGroupedData, ReportingHierarchyIssueOrRelease ,IssueOrRelease} from "../../rollup/rollup";
import { workType as workTypes} from "../../derived/work-status/work-status";
import { mergeStartAndDueData, RolledupDatesReleaseOrIssue, RollupDateData } from "../../rollup/dates/dates-typed";
import { DerivedIssue } from "../../derived/derive";

// TODO: 


// this is more like "derived" from "rollup"

// given some "rolled up" dates ....

// Go to each item ... get it's children ... filter by work status type ...
// add those as children ...


export type DateAndIssueKeys=RollupDateData&{issueKeys: Array<string>}

export type WorkTypeRollups={
    children: DateAndIssueKeys,
    dev: DateAndIssueKeys,
    qa: DateAndIssueKeys,
    design: DateAndIssueKeys,
    uat: DateAndIssueKeys
}

export type WorkTypeTimingReleaseOrIssue = RolledupDatesReleaseOrIssue  & {workTypeRollups:WorkTypeRollups}

export interface TimingLevelsAndCalculation {
    type: string;
    hierarchyLevel: number;
    calculation: string;
}

/**
 * Children are now recursive
 * @param {Array<RolledupDatesReleaseOrIssue>} issuesAndReleases 
 * @return {Array<WorkTypeTimingReleaseOrIssue>}
 */

export function rollupDatesByWorkType(
    issuesAndReleases:ReportingHierarchyIssueOrRelease<{rollupDates: RollupDateData}>[]
){
    // lets make the copies b/c we are going to mutate ...
    const copies = issuesAndReleases.map( issue => {
        return {...issue}//Object.create(issue);
    })

    // we probably don't want to assign "issues" if we want to keep things functional ...
    const getChildren = makeGetChildrenFromReportingIssues<{rollupDates: RollupDateData}>(copies);

    return copies.map(issue=>({...issue,workTypeRollups:getWorkTypeTimings(issue, getChildren)} as WorkTypeTimingReleaseOrIssue))
    // for(let issue of copies) {
    //     issue.workTypeRollups = getWorkTypeTimings(issue, getChildren);
    // }
    // return copies;
}

/**
 * 
 * @param {RolledupDatesReleaseOrIssue} issue 
 * @param {function(RolledupDatesReleaseOrIssue): Array<RolledupDatesReleaseOrIssue>} getChildren 
 */
export function getWorkTypeTimings(
    issue:RolledupDatesReleaseOrIssue, 
    getChildren:(x:RolledupDatesReleaseOrIssue)=>RolledupDatesReleaseOrIssue[]
) {
    const children = getChildren(issue);
    const workTypeRollupsStaging:{[key:string]:{issues:RolledupDatesReleaseOrIssue[]}} = {
        children: {issues: children}
    };
    const workTypeRollups:{[key:string]:DateAndIssueKeys} = {};
        
    //issue.workTypeRollups = workTypeRollups;
    // put each child in an array determined by it's workType
    for(let child of children) {
        const workType = (child as DerivedIssue).derivedStatus.workType;
        if(!workTypeRollupsStaging[workType]) {
            workTypeRollupsStaging[workType] = {issues: []};
        }
        workTypeRollupsStaging[workType].issues.push(child);
    }
    // for the workTypes, determine the timing 
    for(let prop in workTypeRollupsStaging) {
        const rollupDates = workTypeRollupsStaging[prop].issues.map( issue => issue.rollupDates );
        workTypeRollups[prop] = mergeStartAndDueData(rollupDates);
        workTypeRollups[prop].issueKeys = workTypeRollupsStaging[prop].issues.map( issue => issue.key);
    }
    return workTypeRollups as WorkTypeRollups;
}


/**
 * 
 * @param {Array<IssueOrReleases>} issuesOrReleases Starting from low to high
 * @param {Array<String>} methodNames Starting from low to high
 * @return {Array<RollupDateData>}
 */
export function rollupWorkTypeDates(groupedHierarchy:IssueOrRelease[]) {
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
 * @param {Array<IssuesOrReleases>} issuesOrReleases 
 * @param {Array<TimingLevelsAndCalculation>} rollupTimingLevelsAndCalculations 
 * @return {Array<WorkTypeTimingReleaseOrIssue>}
 */
export function addWorkTypeDates(
    issuesOrReleases:IssueOrRelease[], 
    rollupTimingLevelsAndCalculations: TimingLevelsAndCalculation[]
){
    const groupedIssues = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTimingLevelsAndCalculations);
    const rolledUpDates = rollupWorkTypeDates(groupedIssues);
    const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpDates, "workTypeRollups");
    return zipped.flat();
}


// TODO this function is identical to rollup/dates.parentFirstThenChildren, is it needed?
// the problem is that there will ALWAYS be a type ... sometimes be dates 
// so does a parent 
export function childrenFirstThenParent(parentIssueOrRelease:IssueOrRelease, childrenRollups){
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
;



// {children: DATES FROM CHILDREN, QA, UAT, DESIGN, etc}