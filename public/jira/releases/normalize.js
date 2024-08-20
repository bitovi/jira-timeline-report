


/**
 * Returns all releases from all issues
 * @param {Array<import("../normalized/normalize").NormalizedIssue>} normalizedIssues 
 * @return {Array<import("../normalized/normalize").NormalizedRelease>}
 */
export function normalizeReleases(normalizedIssues){
    const nameToRelease = {};
    for(let normalizedIssue of normalizedIssues) {
        const releases = normalizedIssue.releases;
        for(let release of releases) {
            if(!nameToRelease[release.name]) {
                nameToRelease[release.name] = release;
            }
        }
    }
    return Object.values(nameToRelease);
}


