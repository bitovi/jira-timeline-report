import { rollbackIssues, RolledBackJiraIssue } from "../raw/rollback/rollback";
import { deriveIssue } from "../derived/derive";
import { normalizeIssue, NormalizeIssueConfig } from "../normalized/normalize";
import { addRollupDates } from "../rollup/dates/dates";
import { addWorkTypeDates, TimingLevelsAndCalculation, WorkTypeTimingReleaseOrIssue } from "../rolledup/work-type/work-type-typed";
import { rollupBlockedStatusIssues } from "../rollup/blocked-status-issues/blocked-status-issues";
import { DerivedRelease, deriveReleases } from "../releases/derive";
import { normalizeReleases } from "../releases/normalize";
import { percentComplete as rollupPercentComplete, addPercentComplete } from "../rollup/percent-complete/percent-complete";
import { addReportingHierarchy, IssueOrRelease } from "../rollup/rollup";
import { rollupChildStatuses } from "../rollup/child-statuses/child-statuses";
import { rollupWarningIssues } from "../rollup/warning-issues/warning-issues";
import { JiraIssue, NormalizedIssue } from "../shared/types";

export type RolledBackWorkTypeTimingReleaseOrIssue=
    WorkTypeTimingReleaseOrIssue
    &{issue: RolledBackJiraIssue}

export type IssueOrReleaseWithPreviousTiming=
    WorkTypeTimingReleaseOrIssue
    &{issueLastPeriod: RolledBackWorkTypeTimingReleaseOrIssue}

/**
 * @param {derivedIssues} derivedIssues 
 * @param {*} configuration 
 * @param {*} when 
 * @return {IssueOrReleaseWithPreviousTiming}
 */
export function rollupAndRollback(
    derivedIssues: NormalizedIssue[], 
    configuration: NormalizeIssueConfig, 
    rollupTimingLevelsAndCalculations:TimingLevelsAndCalculation[],
     when:Date
    ) {

    // get old issues and prepare them
    const oldRawIssues = derivedIssuesToRawIssues(derivedIssues);
    const pastStatusRolledUp = rollbackNormalizeAndDeriveEverything(
        oldRawIssues,
         configuration,
          rollupTimingLevelsAndCalculations,
           when);

    // prepare current issues
    const currentStatusRolledUp = addRollups(
        derivedIssues,
         rollupTimingLevelsAndCalculations);

    const oldMap = new Map<string,IssueOrReleaseWithPreviousTiming>();
    for (let oldIssue of pastStatusRolledUp) {
        // TODO: use id in the future to handle issue keys being changed
        oldMap.set(oldIssue.key,oldIssue)
    }
    // associate
    for (let newIssue of currentStatusRolledUp) {
        // as this function creates new stuff anyway ... maybe it's ok to mutate?
        if(oldMap.has(newIssue.key))
        newIssue.issueLastPeriod = oldMap.get(newIssue.key) as RolledBackWorkTypeTimingReleaseOrIssue;
    }
    return currentStatusRolledUp;
}

function addRollups(
    derivedIssues: NormalizedIssue[],
     rollupTimingLevelsAndCalculations:TimingLevelsAndCalculation[]
    ) {
    const normalizedReleases = normalizeReleases(derivedIssues, rollupTimingLevelsAndCalculations)
    const releases = deriveReleases(normalizedReleases);
    const reporting = addReportingHierarchy(
        [...releases, ...derivedIssues] as IssueOrRelease<NormalizedIssue|DerivedRelease>[], 
        rollupTimingLevelsAndCalculations);
    const rolledUpDates = addRollupDates(reporting, rollupTimingLevelsAndCalculations);
    const rolledUpBlockers = rollupBlockedStatusIssues(rolledUpDates, rollupTimingLevelsAndCalculations);
    const rolledUpWarnings = rollupWarningIssues(rolledUpBlockers, rollupTimingLevelsAndCalculations);
    const percentComplete = addPercentComplete(rolledUpWarnings, rollupTimingLevelsAndCalculations);
    const childStatuses = rollupChildStatuses(percentComplete, rollupTimingLevelsAndCalculations);

    return addWorkTypeDates(childStatuses, rollupTimingLevelsAndCalculations);
}

export function rollbackNormalizeAndDeriveEverything(
    rawIssues: JiraIssue[],
    configuration: NormalizeIssueConfig,
    rollupTimingLevelsAndCalculations:TimingLevelsAndCalculation[],
    when:Date
) {
    const pastRawIssues = rollbackIssues(rawIssues, when);
    //const dne = pastRawIssues.filter(ri => ri.rollbackMetadata.didNotExistBefore);

    const pastDerived = pastRawIssues.map((issue) => {
        const normalized = normalizeIssue(issue, configuration);
        return deriveIssue(normalized, configuration);
    });
    return addRollups(pastDerived, rollupTimingLevelsAndCalculations)
}

function derivedIssuesToRawIssues(derivedIssues: NormalizedIssue[]) {
    return derivedIssues.map(dI => dI.issue)
}