import { rollbackIssues } from "../raw/rollback/rollback";
import { deriveIssue } from "../derived/derive";
import { normalizeIssue } from "../normalized/normalize";
import { addRollupDates } from "../rollup/dates/dates";
import { addWorkTypeDates } from "../rolledup/work-type/work-type";
import { rollupBlockedStatusIssues } from "../rollup/blocked-status-issues/blocked-status-issues";
import { deriveReleases } from "../releases/derive";
import { normalizeReleases } from "../releases/normalize";
import { percentComplete as rollupPercentComplete, addPercentComplete } from "../rollup/percent-complete/percent-complete";
import { addReportingHierarchy } from "../rollup/rollup";
import { rollupChildStatuses } from "../rollup/child-statuses/child-statuses";
import { rollupWarningIssues } from "../rollup/warning-issues/warning-issues";

/**
 * @typedef {import("../rolledup/work-type/work-type").WorkTypeTimingReleaseOrIssue & {issue: import("../raw/rollback/rollback").RolledBackJiraIssue}} RolledBackWorkTypeTimingReleaseOrIssue
 */

/**
 * @typedef {import("../rolledup/work-type/work-type").WorkTypeTimingReleaseOrIssue & {issueLastPeriod: RolledBackWorkTypeTimingReleaseOrIssue}} IssueOrReleaseWithPreviousTiming
 */

/**
 * @param {derivedIssues} derivedIssues 
 * @param {*} configuration 
 * @param {*} when 
 * @return {IssueOrReleaseWithPreviousTiming}
 */
export function rollupAndRollback(derivedIssues, configuration, rollupTimingLevelsAndCalculations, when){
    
    // get old issues and prepare them
    const oldRawIssues = derivedIssuesToRawIssues(derivedIssues);
    const pastStatusRolledUp = rollbackNormalizeAndDeriveEverything(oldRawIssues, configuration, rollupTimingLevelsAndCalculations, when);

    // prepare current issues
    const currentStatusRolledUp = addRollups(derivedIssues, rollupTimingLevelsAndCalculations);

    const oldMap = {};
    for(let oldIssue of pastStatusRolledUp) {
        // TODO: use id in the future to handle issue keys being changed
        oldMap[oldIssue.key] = oldIssue;
    }
    // associate
    for(let newIssue of currentStatusRolledUp) {
        // as this function creates new stuff anyway ... maybe it's ok to mutate?
        newIssue.issueLastPeriod = oldMap[newIssue.key];
    }
    return currentStatusRolledUp;
}

function addRollups(derivedIssues, rollupTimingLevelsAndCalculations) {

    const normalizedReleases = normalizeReleases(derivedIssues, rollupTimingLevelsAndCalculations)
    const releases = deriveReleases(normalizedReleases);
    const reporting = addReportingHierarchy([...releases,...derivedIssues], rollupTimingLevelsAndCalculations);
    const rolledUpDates = addRollupDates(reporting, rollupTimingLevelsAndCalculations);
    const rolledUpBlockers=  rollupBlockedStatusIssues(rolledUpDates, rollupTimingLevelsAndCalculations);
    const rolledUpWarnings = rollupWarningIssues(rolledUpBlockers, rollupTimingLevelsAndCalculations);
    const percentComplete = addPercentComplete(rolledUpWarnings, rollupTimingLevelsAndCalculations);
    const childStatuses = rollupChildStatuses(percentComplete, rollupTimingLevelsAndCalculations);
    return addWorkTypeDates(childStatuses, rollupTimingLevelsAndCalculations);
    
}

export function rollbackNormalizeAndDeriveEverything(rawIssues, configuration, rollupTimingLevelsAndCalculations, when){
    const pastRawIssues = rollbackIssues(rawIssues, when);
    //const dne = pastRawIssues.filter(ri => ri.rollbackMetadata.didNotExistBefore);
    
    const pastDerived = pastRawIssues.map( (issue)=>{
        const normalized = normalizeIssue(issue,configuration);
        return deriveIssue(normalized, configuration);
    });
    return addRollups(pastDerived, rollupTimingLevelsAndCalculations)

}



function derivedIssuesToRawIssues(derivedIssues){
    return derivedIssues.map(dI => dI.issue)
}