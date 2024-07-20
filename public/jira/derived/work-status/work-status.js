import { getStatusCategoryDefault } from "../../../status-helpers";

/**
 * 
 * @param {NormalizedIssue} normalizedIssue 
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



const workType = ["dev","qa","uat","design"];
const workPrefix = workType.map( wt => wt+":")
/**
 * @param {NormalizedIssue} normalizedIssue 
 * @returns {String} dev, qa, uat, design
 */
function getWorkTypeDefault(normalizedIssue){
  
  let wp = workPrefix.find( wp => normalizedIssue?.summary?.indexOf(wp) === 0);
  if(wp) {
    return wp.slice(0, -1)
  }
  wp = workType.find( wt => normalizedIssue.labels.includes(wt));
  if(wp) {
    return wp;
  }
  return "dev";
}