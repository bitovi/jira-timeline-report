import { makeGetChildrenFromReportingIssues } from "../../rollup/rollup";
import { mergeStartAndDueData } from "../../rollup/dates/dates";

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

export function rollupDatesByWorkType(issuesAndReleases){
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
