import { rollbackIssues } from "../raw/rollback/rollback";
import { deriveIssue } from "../derived/derive";
import { normalizeIssue } from "../normalized/normalize";
import { addRollupDates } from "../rollup/dates/dates";
import { rollupDatesByWorkStatus } from "../rolledup/work-type/work-type";
import { rollupBlockedStatusIssues } from "../rollup/blocked-status-issues/blocked-status-issues";

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
        oldMap[oldIssue.id] = oldIssue;
    }
    // associate
    for(let newIssue of currentStatusRolledUp) {
        // as this function creates new stuff anyway ... maybe it's ok to mutate?
        newIssue.issueLastPeriod = oldMap[newIssue.id];
    }
    return currentStatusRolledUp;
}

function addRollups(derivedIssues, rollupTimingLevelsAndCalculations) {
    const rolledUpDates = addRollupDates(derivedIssues, rollupTimingLevelsAndCalculations);
    const rolledUpBlockers=  rollupBlockedStatusIssues(rolledUpDates, rollupTimingLevelsAndCalculations);
    return rollupDatesByWorkStatus(rolledUpBlockers);
    
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