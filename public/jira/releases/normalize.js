


/**
 * Returns all releases from all issues
 * @param {Array<import("../normalized/normalize").NormalizedIssue>} normalizedIssues 
 * @return {Array<import("../normalized/normalize").NormalizedRelease>}
 */
export function normalizeReleases(normalizedIssues, rollupTimingLevelsAndCalculations){
    const releaseIndex = rollupTimingLevelsAndCalculations.findIndex( calc => calc.type === "Release");
    if(releaseIndex === -1) {
        return [];
    }
    const followingCalc = rollupTimingLevelsAndCalculations[releaseIndex+1];
    if(!followingCalc) {
        return [];
    }
    const followingType = followingCalc.type;

    const nameToRelease = {};
    for(let normalizedIssue of normalizedIssues) {
        if(normalizedIssue.type === followingType) {
            const releases = normalizedIssue.releases;
            for(let release of releases) {
                if(!nameToRelease[release.name]) {
                    nameToRelease[release.name] = release;
                }
            }
        }
    }
    return Object.values(nameToRelease);
}


