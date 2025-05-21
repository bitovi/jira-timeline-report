import { jStat } from 'jstat';

function toStandardDeviations({
	confidence,
	highConfidenceStds = 0,
	highConfidence = 100,
	lowConfidenceStds = 1.3,
	lowConfidence = 10
}){
	const slope = -1 * (highConfidenceStds - lowConfidenceStds) / (highConfidence - lowConfidence)
	const uncertainty = (100 - confidence);
	return  (uncertainty * slope);
}

export function toConfidenceFromStandardDeviations({
	standardDeviations,
	highConfidenceStds = 0,
	highConfidence = 100,
	lowConfidenceStds = 1.3,
	lowConfidence = 10
}) {
	const slope = -1 * (highConfidenceStds - lowConfidenceStds) / (highConfidence - lowConfidence);
	const uncertainty = standardDeviations / slope;
	return 100 - uncertainty;
}

/**
 * Given an estimate, a confidence, and an uncertainty, return the extra amount of time.
 * @param {number} estimate 
 * @param {number} confidence 
 * @param {number} uncertaintyWeight 
 * @returns {number}
 */
export function estimateExtraPoints(estimate, confidence, uncertaintyWeight) {
	var std = toStandardDeviations({confidence});
	if(uncertaintyWeight === "average") {
		return estimate * jStat.lognormal.mean( 0, std) - estimate;
	} else {
		return estimate * jStat.lognormal.inv( (uncertaintyWeight / 100) , 0, std) - estimate;
	}
	
}

/**
 * @param {number} estimate 
 * @param {number} confidence 
 * @returns {number}
 */
export function sampleExtraPoints(estimate, confidence) {
	const std = toStandardDeviations({confidence});
	const scale = jStat.lognormal.sample( 0, std );
	return estimate * scale - estimate;
}


export function toP(confidence) {
    var cd = confidence / 100;
    return 1 - 0.5 * cd;
}
