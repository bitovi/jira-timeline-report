import {deriveWorkTiming} from "./work-timing/work-timing.js";
import {getWorkStatus} from "./work-status/work-status.js";
import { normalizeIssue } from "../normalized/normalize.js";

/**
 * @typedef {import("../normalized/normalize.js").NormalizedIssue & {
*   derivedTiming: import("./work-timing/work-timing.js").DerivedTiming
* } & {derivedStatus: import("./work-status/work-status.js").DerivedWorkStatus}} DerivedWorkIssue
*/


/**
* Adds derived data
* @param {NormalizedIssue} normalizedIssue 
* @return {DerivedWorkIssue} 
*/
export function deriveIssue(issue, options){
    const timing = deriveWorkTiming(issue, options);
    return {
        derivedTiming: timing,
        derivedStatus: getWorkStatus(issue, options),
        ...issue
    }
}



/**
 * 
 * @param {Array<JiraIssue>} issues 
 * @returns {Array<DerivedWorkIssue>}
 */
export function normalizeAndDeriveIssues(issues, options) {
    return issues.map( issue => deriveIssue( normalizeIssue(issue, options), options ) )
}