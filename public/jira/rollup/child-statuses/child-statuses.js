import { rollupGroupedHierarchy, groupIssuesByHierarchyLevelOrType, zipRollupDataOntoGroupedData } from "../rollup";
/**
 * 
 * @param {Array<import("../rollup").IssuesOrReleases>} issuesOrReleases Starting from low to high
 * @param {Array<String>} methodNames Starting from low to high
 * @return {Array<RollupDateData>}
 */
export function rollupChildStatusesForGroupedHierarchy(groupedHierarchy) {
    return rollupGroupedHierarchy(groupedHierarchy, {
        createRollupDataFromParentAndChild({key, status}, children){
            return {
                self: {key, status},
                children: children.map( child => child.self )
            };
        }
    });
}

// these functions shouldn't be used eventually for performance ...
export function rollupChildStatuses(issuesOrReleases, rollupTimingLevelsAndCalculations){
    const groupedIssues = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTimingLevelsAndCalculations);
    const rolledUpBlockers = rollupChildStatusesForGroupedHierarchy(groupedIssues);

    const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpBlockers, "childStatuses");
    return zipped.flat();
}