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
import { epicTimingData } from "./date-helpers.js";
export default function (releases) {
    return releases.map(function (releaseObject) {
        return __assign(__assign({}, releaseObject), { shortName: releaseObject.release, version: releaseObject.release, shortVersion: releaseObject.release });
    }).sort(function (a, b) {
        return a.dateData.rollup.due - b.dateData.rollup.due;
    });
    /*const semverReleases = Object.keys(releasesToInitiatives).sort( (a, b)=> {
        const initiatives = releasesToInitiatives[a];

        debugger;
        epicTimingData();
        return 1;
    });

    const shortReleaseNames = uniqueTrailingNames(semverReleases);

    return semverReleases.map( (release, index)=>{

    })*/
}
