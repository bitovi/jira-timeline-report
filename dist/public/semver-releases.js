var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import semver from "./semver.js";
import uniqueTrailingNames from "./shared/unique-trailing-names.js";
function partialReleaseName(release) {
    var match = release.match(/(?:\d+\.\d+\.[\dX]+)|(?:\d+\.[\dX]+)|(?:\d+)$/);
    if (match) {
        return match[0].replace(".X", ".0");
    }
}
export function cleanedRelease(release) {
    var clean = partialReleaseName(release);
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
    var cleanMap = {};
    var cleanValues = [];
    values.forEach(function (release) {
        var clean = cleanedRelease(release);
        if (clean && semver.clean(clean)) {
            cleanMap[clean] = release;
            cleanValues.push(clean);
        }
    });
    var cleanSorted = semver.sort(cleanValues);
    return cleanSorted.map(function (clean) { return cleanMap[clean]; });
}
export default function (unsortedReleases) {
    var releaseToReleaseObject = {};
    for (var _i = 0, unsortedReleases_1 = unsortedReleases; _i < unsortedReleases_1.length; _i++) {
        var releaseObject = unsortedReleases_1[_i];
        releaseToReleaseObject[releaseObject.release] = releaseObject;
    }
    var semverReleases = semverSort(Object.keys(releaseToReleaseObject));
    var shortReleaseNames = uniqueTrailingNames(semverReleases);
    return semverReleases.map(function (release, index) {
        return __assign(__assign({}, releaseToReleaseObject[release]), { release: release, shortName: shortReleaseNames[index], version: cleanedRelease(release), shortVersion: partialReleaseName(release) });
    });
}
