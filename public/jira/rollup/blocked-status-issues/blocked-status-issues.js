/**
 * Adds any child (or self) issues that are in the blocked status
 * 
 * Used for: Showing blocked issues in the report
 */

import { rollupGroupedHierarchy, groupIssuesByHierarchyLevelOrType, zipRollupDataOntoGroupedData } from "../rollup";
/**
 * 
 * @param {Array<import("../rollup").IssuesOrReleases>} issuesOrReleases Starting from low to high
 * @param {Array<String>} methodNames Starting from low to high
 * @return {Array<RollupDateData>}
 */
export function rollupBlockedIssuesForGroupedHierarchy(groupedHierarchy) {
    return rollupGroupedHierarchy(groupedHierarchy, {
        createRollupDataFromParentAndChild(issueOrRelease, children, hierarchyLevel, metadata){
            const blockedIssues = children.flat(1);
            // releases don't have a status
            if(issueOrRelease?.derivedStatus?.statusType === "blocked") {
                blockedIssues.push(issueOrRelease)
            }
            return blockedIssues;
        }
    });
}

// these functions shouldn't be used eventually for performance ...
export function rollupBlockedStatusIssues(issuesOrReleases, rollupTimingLevelsAndCalculations){
    const groupedIssues = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTimingLevelsAndCalculations);
    const rolledUpBlockers = rollupBlockedIssuesForGroupedHierarchy(groupedIssues);

    const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpBlockers, "blockedStatusIssues");
    return zipped.flat();
}