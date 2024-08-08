import { jStat } from 'jstat';
function toStandardDeviations(_a) {
    var confidence = _a.confidence, _b = _a.highConfidenceStds, highConfidenceStds = _b === void 0 ? 0 : _b, _c = _a.highConfidence, highConfidence = _c === void 0 ? 100 : _c, _d = _a.lowConfidenceStds, lowConfidenceStds = _d === void 0 ? 1.3 : _d, _e = _a.lowConfidence, lowConfidence = _e === void 0 ? 10 : _e;
    var slope = -1 * (highConfidenceStds - lowConfidenceStds) / (highConfidence - lowConfidence);
    var uncertainty = (100 - confidence);
    return (uncertainty * slope);
}
/**
 * Given an estimate, a confidence, and an uncertainty, return the extra amount of time.
 * @param {number} estimate
 * @param {number} confidence
 * @param {number} uncertaintyWeight
 * @returns {number}
 */
export function estimateExtraPoints(estimate, confidence, uncertaintyWeight) {
    var std = toStandardDeviations({ confidence: confidence });
    if (uncertaintyWeight === "average") {
        return estimate * jStat.lognormal.mean(0, std) - estimate;
    }
    else {
        return estimate * jStat.lognormal.inv((uncertaintyWeight / 100), 0, std) - estimate;
    }
}
/**
 * @param {number} estimate
 * @param {number} confidence
 * @returns {number}
 */
export function sampleExtraPoints(estimate, confidence) {
    var std = toStandardDeviations({ confidence: confidence });
    var scale = jStat.lognormal.sample(0, std);
    return estimate * scale - estimate;
}
export function toP(confidence) {
    var cd = confidence / 100;
    return 1 - 0.5 * cd;
}
