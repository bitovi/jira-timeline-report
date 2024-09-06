import { rollupGroupedHierarchy, groupIssuesByHierarchyLevelOrType, zipRollupDataOntoGroupedData } from "../rollup";
/**
 * 
 * @param {Array<import("../rollup").IssuesOrReleases>} issuesOrReleases Starting from low to high
 * @param {Array<String>} methodNames Starting from low to high
 * @return {Array<RollupDateData>}
 */
export function rollupWarningIssuesForGroupedHierarchy(groupedHierarchy) {
    return rollupGroupedHierarchy(groupedHierarchy, {
        createRollupDataFromParentAndChild(issueOrRelease, children, hierarchyLevel, metadata){
            const warningIssues = children.flat(1);
            // releases don't have a status
            const lowerCaseLabels = (issueOrRelease.labels || []).map( label => label.toLowerCase() )
            if(lowerCaseLabels.some( label => label === "warning")) {
                warningIssues.push(issueOrRelease)
            }
            return warningIssues;
        }
    });
}

// these functions shouldn't be used eventually for performance ...
export function rollupWarningIssues(issuesOrReleases, rollupTimingLevelsAndCalculations){
    const groupedIssues = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTimingLevelsAndCalculations);
    const rolledUpBlockers = rollupWarningIssuesForGroupedHierarchy(groupedIssues);

    const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpBlockers, "warningIssues");
    return zipped.flat();
}