


/**
 * Returns all releases from all issues
 * @param {Array<import("../normalized/normalize").NormalizedIssue>} normalizedIssues 
 * @return {Array<import("../normalized/normalize").NormalizedRelease>}
 */
function normalizedReleases(normalizedIssues){
    const idToRelease = {};
    for(let normalizedIssue of normalizedIssues) {
        const releases = normalizedIssue.releases;
        for(let release of releases) {
            if(!idToRelease[release.id]) {
                idToRelease[release.id] = release;
            }
        }
    }
    return Object.values(idToRelease);
}


