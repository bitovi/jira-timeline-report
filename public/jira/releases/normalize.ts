import { NormalizedIssue, NormalizedRelease } from "../normalized/normalize";

/**
 * Returns all releases from all issues
 * @param {Array<NormalizedIssue>} normalizedIssues 
 * @param {Array<{ type: string }>} rollupTimingLevelsAndCalculations 
 * @return {Array<NormalizedRelease>}
 */
export function normalizeReleases(
  normalizedIssues: Array<NormalizedIssue>,
  rollupTimingLevelsAndCalculations: Array<{ type: string }>
): Array<NormalizedRelease> {


  const releaseIndex = rollupTimingLevelsAndCalculations.findIndex(
    (calc) => calc.type === "Release"
  );
  
  if (releaseIndex === -1) {
    return [];
  }
  
  const followingCalc = rollupTimingLevelsAndCalculations[releaseIndex + 1];
  if (!followingCalc) {
    return [];
  }
  
  const followingType = followingCalc.type;

  const nameToRelease: { [key: string]: NormalizedRelease } = {};
  
  for (let normalizedIssue of normalizedIssues) {
    if (normalizedIssue.type === followingType) {
      const releases = normalizedIssue.releases;
      for (let release of releases) {
        if (!nameToRelease[release.name]) {
          nameToRelease[release.name] = release;
        }
      }
    }
  }
  
  return Object.values(nameToRelease);
}