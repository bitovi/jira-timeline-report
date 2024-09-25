var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
/**
 * Returns all releases from all issues
 * @param {Array<NormalizedIssue>} normalizedIssues
 * @param {Array<{ type: string }>} rollupTimingLevelsAndCalculations
 * @return {Array<NormalizedRelease>}
 */
export function normalizeReleases(normalizedIssues, rollupTimingLevelsAndCalculations) {
    var e_1, _a, e_2, _b;
    var releaseIndex = rollupTimingLevelsAndCalculations.findIndex(function (calc) { return calc.type === "Release"; });
    if (releaseIndex === -1) {
        return [];
    }
    var followingCalc = rollupTimingLevelsAndCalculations[releaseIndex + 1];
    if (!followingCalc) {
        return [];
    }
    var followingType = followingCalc.type;
    var nameToRelease = {};
    try {
        for (var normalizedIssues_1 = __values(normalizedIssues), normalizedIssues_1_1 = normalizedIssues_1.next(); !normalizedIssues_1_1.done; normalizedIssues_1_1 = normalizedIssues_1.next()) {
            var normalizedIssue = normalizedIssues_1_1.value;
            if (normalizedIssue.type === followingType) {
                var releases = normalizedIssue.releases;
                try {
                    for (var releases_1 = (e_2 = void 0, __values(releases)), releases_1_1 = releases_1.next(); !releases_1_1.done; releases_1_1 = releases_1.next()) {
                        var release = releases_1_1.value;
                        if (!nameToRelease[release.name]) {
                            nameToRelease[release.name] = release;
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (releases_1_1 && !releases_1_1.done && (_b = releases_1.return)) _b.call(releases_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (normalizedIssues_1_1 && !normalizedIssues_1_1.done && (_a = normalizedIssues_1.return)) _a.call(normalizedIssues_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return Object.values(nameToRelease);
}
