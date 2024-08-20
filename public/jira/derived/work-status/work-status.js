// this is the types work can be categorized as
export const workType = ["design","dev","qa","uat"];
export const workTypes = workType;

// this is the workflow items this tool supports 

export const workflowHappyPath = ["todo","design","dev","qa","uat","done"];
export const workflowUnhappyStatuses = ["blocked"];


const inQAStatus = { "QA": true, "In QA": true, "QA Complete": true };
const inPartnerReviewStatus = { "Partner Review": true, "UAT": true };
export const inPartnerReviewStatuses = Object.keys(inPartnerReviewStatus);
export const inIdeaStatus = {"Idea": true, "To Do": true, "Open": true};
export const inIdeaStatuses =  Object.keys(inIdeaStatus);
const inDoneStatus = { "Done": true, "Cancelled": true };
const blockedStatus = { "Blocked": true, "blocked": true, "delayed": true, "Delayed": true }


const statusCategoryMap = (function(){

	const items = [
		["qa",inQAStatus],
		["uat", inPartnerReviewStatus],
		["todo", inIdeaStatus],
		["done", inDoneStatus],
		["blocked", blockedStatus]
	];
	const statusCategoryMap = {};
	for( let [category, statusMap] of items) {
		for(let prop in statusMap) {
			statusCategoryMap[prop] = category
		}
	}
	return statusCategoryMap;
})();

/**
 * 
 * @param {import("../derive").DerivedWorkIssue} issue 
 */
export function getStatusCategoryDefault(issue){
	const statusCategory = statusCategoryMap[ (issue.status || "").toLowerCase()]
	if(statusCategory) {
		return statusCategory;
	} else {
		return "dev";
	}
	
}


/**
 * @typedef {{
 *   statusType: string,
 *   workType: string 
 * }} DerivedWorkStatus
 */

/**
 * @param {NormalizedIssue} normalizedIssue 
 * @return {DerivedWorkStatus}
 */
export function getWorkStatus(
    normalizedIssue, 
    {
        getStatusType = getStatusCategoryDefault,
        getWorkType = getWorkTypeDefault
    }){
    return {
        statusType: getStatusType(normalizedIssue),
        workType: getWorkType(normalizedIssue)
    }
}


function toLowerCase(str) {
	return str.toLowerCase();
}

const workPrefix = workType.map( wt => wt+":")
/**
 * @param {NormalizedIssue} normalizedIssue 
 * @returns {String} dev, qa, uat, design
 */
function getWorkTypeDefault(normalizedIssue){
  
  let wp = workPrefix.find( wp => (normalizedIssue?.summary || "").toLowerCase().indexOf(wp) === 0);
  if(wp) {
    return wp.slice(0, -1)
  }
  
  wp = workType.find( wt => normalizedIssue.labels.map(toLowerCase).includes(wt));
  if(wp) {
    return wp;
  }
  return "dev";
}