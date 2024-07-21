import uniqueTrailingNames from "./unique-trailing-names.js";
import semver from "semver";



function partialReleaseName(release) {
    let match = release.match(/(?:\d+\.\d+\.[\dX]+)|(?:\d+\.[\dX]+)|(?:\d+)$/);
    if (match) {
        return match[0].replace(".X", ".0");
    }
}

export function cleanedRelease(release) {
    let clean = partialReleaseName(release);
    if (clean) {
        if (clean.length === 1) {
            clean = clean + ".0.0";
        }
        if (clean.length === 3) {
            clean = clean + ".0";
        }
        if (semver.clean(clean)) {
            return clean;
        }
    }
}

export function semverSort(values) {
    const cleanMap = {};
    const cleanValues = [];
    values.forEach((release) => {
        const clean = cleanedRelease(release);
        if (clean && semver.clean(clean)) {
            cleanMap[clean] = release;
            cleanValues.push(clean);
        }

    });
    const cleanSorted = semver.sort(cleanValues);

    return cleanSorted.map(clean => cleanMap[clean]);
}
/**
 * @typedef {{
 *   semver: Boolean,
 *   version: String | null,
 *   shortVersion: String | null,
 *   shortName: String 
 * }} DerivedReleaseNames
 */
/**
 * @typedef {import("../normalized/normalize.js").NormalizedRelease & {names: DerivedReleaseNames}} DerivedRelease
 */

/**
 * 
 * @param {Array<import("../normalized/normalize.js").NormalizedRelease>} normalizedReleases 
 * @returns {DerivedRelease}
 */
export function deriveReleases(normalizedReleases){
	
    const semverNames = normalizedReleases.map(normalizedRelease => {
        const semverReleaseName = cleanedRelease(normalizedRelease.name) || null;
        const version = semverReleaseName ? semver.clean(semverReleaseName) : null;
        const shortVersion = semverReleaseName ? partialReleaseName(normalizedRelease.name) : null;

        return {
            semver: !!semverReleaseName,
            version,
            shortVersion
        }
    });

    const namesToShorten = semverNames.map( ({shortVersion}, i) => {
        return shortVersion || normalizedReleases[i].name;
    })
    const shortNames = uniqueTrailingNames(namesToShorten);
    return normalizedReleases.map( (normalizedRelease, index)=> {
        return {
            ...normalizedRelease,
            names: {
                ...semverNames[index],
                shortName: shortNames[index]
            }
        }
    });
}
