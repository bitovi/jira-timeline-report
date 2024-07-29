import { makeGetChildren } from "../../rollup/rollup";
import { mergeStartAndDueData } from "../../rollup/dates/dates";

// this is more like "derived" from "rollup"

// given some "rolled up" dates ....

// Go to each item ... get it's children ... filter by work status type ...
// add those as children ...


/**
 * @typedef {import("../../rollup/dates/dates").RollupDateData & {issues: Array<WorkStatusTimingReleaseOrIssue>}} DateAndIssues
 */

/**
 * @typedef {{
 *   children: DateAndIssues,
 *   dev: DateAndIssues,
 *   qa: DateAndIssues,
 *   design: DateAndIssues,
 *   uat: DateAndIssues
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

export function rollupDatesByWorkStatus(issuesAndReleases){
    // lets make the copies b/c we are going to mutate ...
    const copies = issuesAndReleases.map( issue => {
        return {...issue}//Object.create(issue);
    })

    const getChildren = makeGetChildren(copies);

    for(let issue of copies) {
        const children = getChildren(issue);
        const workTypeRollups = {
            children: {issues: children}
        };
        
        issue.workTypeRollups = workTypeRollups;
        for(let child of children) {
            if(!workTypeRollups[child.derivedStatus.workType]) {
                workTypeRollups[child.derivedStatus.workType] = {issues: []};
            }
            workTypeRollups[child.derivedStatus.workType].issues.push(child);
        }
        for(let prop in issue.workTypeRollups) {
            const rollupDates = issue.workTypeRollups[prop].issues.map( issue => issue.rollupDates )
            Object.assign(issue.workTypeRollups[prop], mergeStartAndDueData(rollupDates))
        }
    }
    return copies;
}
