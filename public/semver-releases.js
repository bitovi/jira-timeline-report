import semver from "./semver.js";
import uniqueTrailingNames from "./shared/unique-trailing-names.js";

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


export default function(unsortedReleases){
	const releaseToReleaseObject = {};
	for(let releaseObject of unsortedReleases) {
		releaseToReleaseObject[releaseObject.release] = releaseObject;
	}

	const semverReleases = semverSort(Object.keys(releaseToReleaseObject));

	const shortReleaseNames = uniqueTrailingNames(semverReleases);

	return semverReleases.map( (release, index)=>{
		return {
				...releaseToReleaseObject[release],
				release: release,
				shortName: shortReleaseNames[index],
				version: cleanedRelease(release),
				shortVersion: partialReleaseName(release),

		};
	})
}
