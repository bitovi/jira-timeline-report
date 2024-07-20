
import { rollupHierarchy } from "../rollup.js";


/**
 * @param { JiraIssue[] } issues
 * @param { PercentCompleteOptions } options
 */
export function percentComplete(derivedWorkIssues) {
  return completionRollup(derivedWorkIssues);
}

function groupIssuesByHierarchyLevel(issues, options) {
  const sorted = issues 
  const group = [];
  for(let issue of sorted) {
    if(!group[issue.hierarchyLevel]) {
      group[issue.hierarchyLevel] = [];
    }
    group[issue.hierarchyLevel].push(issue)
  }
  return group;
}

const BASE_HIERARCHY_LEVEL = 1;


/**
 * @typedef {import("../../derived/work-timing/work-timing.js").DerivedWorkIssue & {
 *   completionRollup: {
 *    totalWorkingDays: number, 
 *    completedWorkingDays: number,
 *    remainingWorkingDays: number
 *   }
 * }} RolledupCompletionIssue
 */

/**
 * 
 * @param {import("../../derived/work-timing/work-timing.js").DerivedWorkIssue} issues 
 * @returns {Array<RolledupCompletionIssue>}
 */
function toCompletionRollups(issues){
  return issues.map( issue => {
    return {...issue, completionRollup: {totalWorkingDays: 0, completedWorkingDays: 0}}
  })
}
/**
 * @typedef {{
 *  needsAverageSet: Array<RolledupCompletionIssue>,
 *  issues: Array<RolledupCompletionIssue>,
 *  averageChildCount: number | undefined
 * }} IssueTypeData
 */

/**
 * 
 * @param {import("../../derived/work-timing/work-timing.js").DerivedWorkIssue} allIssueData 
 * @param {*} options 
 * @returns {{issues: Array<RolledupCompletionIssue>, hierarchyData: Array<IssueTypeData>}}
 */
function completionRollup(allIssueData){
  const completionRollups = toCompletionRollups(allIssueData);

  const groupedIssueData = groupIssuesByHierarchyLevel(completionRollups);
  const issueKeyToChildren = Object.groupBy(completionRollups, issue => issue.parentKey);

  // Store information for each level of of the hierarchy 
  const issueTypeDatas = [];
  
  // for each level of the hierarchy, starting with the bottom
  for( let hierarchyLevel = BASE_HIERARCHY_LEVEL; hierarchyLevel < groupedIssueData.length; hierarchyLevel++) {
    /**
     * @type {Array<RolledupCompletionIssue>}
     */
    let issues = groupedIssueData[hierarchyLevel];
    
    if(issues) {

      // Track rollup data
      /**
       * @type {IssueTypeData}
       */
      let issueTypeData = issueTypeDatas[hierarchyLevel] = {
        // how many children on average
        childCounts: [],
        
        // an array of the total of the number of days of work. Used to calculate the average
        totalDaysOfWorkForAverage: [],
        // which items need their average set after the average is calculated
        needsAverageSet: [],
        // this will be set later
        averageTotalDays: null,
        averageChildCount: null,

        issues: issues
      }

      // for issues on that level
      for(let issueData of issues) {
        if(hierarchyLevel === BASE_HIERARCHY_LEVEL) {

          // if it has self-calculated total days ..
          if( issueData.derivedWork.totalDaysOfWork ) {
            // add those days to the average
            issueTypeData.totalDaysOfWorkForAverage.push( issueData.derivedWork.totalDaysOfWork );
            // set the rollup value
            issueData.completionRollup.totalWorkingDays = issueData.derivedWork.totalDaysOfWork;
          } 
          else {
            // add this issue to what needs its average
            issueTypeData.needsAverageSet.push(issueData);
          }
          // we roll this up no matter what ... it's ok to roll up 0
          issueData.completionRollup.completedWorkingDays = issueData.derivedWork.completedDaysOfWork;
        }
        // initiatives and above
        if( hierarchyLevel > BASE_HIERARCHY_LEVEL ) {
          // handle "parent-like" issue
          handleInitiative(issueData,{issueTypeData, issueKeyToChildren})
        }
      }

      // calculate the average 
      let ave = average( issueTypeData.totalDaysOfWorkForAverage ) || 30;
      issueTypeData.averageTotalDays = ave;

      issueTypeData.averageChildCount = average( issueTypeData.childCounts )

      // set average on children that need it
      issueTypeData.needsAverageSet.forEach( issueData => {
        issueData.completionRollup.totalWorkingDays = ave;
        issueData.completionRollup.remainingWorkingDays = issueData.completionRollup.totalWorkingDays- 
          issueData.completionRollup.completedWorkingDays;
      })
    }
  }

  return {
    issues: completionRollups,
    hierarchyData: issueTypeDatas
  };
}
function sum(arr) {
  return arr.reduce((partialSum, a) => partialSum + a, 0)
}
function average(arr){
  return arr.length > 0 ? sum(arr) / arr.length : undefined;
}

/**
 * 
 * @param {RolledupCompletionIssue} issueData 
 * @param {*} param1 
 * @param {*} options 
 * @returns 
 */
function handleInitiative(issueData,{issueTypeData, issueKeyToChildren}) {
  

  // Empty
  if(! issueKeyToChildren[issueData.key] ) {
    issueTypeData.needsAverageSet.push(issueData);
    return;
  }

  /**
   * @type {Array<RolledupCompletionIssue>}
   */
  const children = issueKeyToChildren[issueData.key];
  const totalDays = children.map(child => child.completionRollup.totalWorkingDays);
  const completedDays = children.map(child => child.completionRollup.completedWorkingDays);
  issueTypeData.childCounts.push(children.length);

  // Fully Estimated
  if(children.every( child => child.totalDays )) {
    // we probably want a better signal ... but this will do for now
    issueData.completionRollup.totalWorkingDays = sum(totalDays);

    // Add so average can be calculated
    issueTypeData.totalDaysOfWorkForAverage.push(issueData.completionRollup.totalWorkingDays);
    

    
  } 
  // Partially estimated
  else {
    // Do nothing
  }

  // Roll up the days from the children
  // This works b/c children that originally had no estimate will already have their rollup total days 
  // set to the average.  
  issueData.completionRollup.completedWorkingDays = sum(completedDays);
  issueData.completionRollup.totalWorkingDays = sum(totalDays);  
  issueData.completionRollup.remainingWorkingDays = issueData.completionRollup.totalWorkingDays - issueData.completionRollup.completedWorkingDays
}





// to look at later ....
function altRollupWorkingDays(issues) {
  return rollupHierarchy(issues, {
    createRollupDataForHierarchyLevel: (level, issues)=> {
      return {
        // how many children on average
        childCounts: [],
        
        // an array of the total of the number of days of work. Used to calculate the average
        totalDaysOfWorkForAverage: [],
        // which items need their average set after the average is calculated
        needsAverageSet: [],
        // this will be set later
        averageTotalDays: null,
        averageChildCount: null,

        normalizedIssues: issues
      }
    },
    createRollupDataForIssue: () => {
      return {totalDays: 0, completedDays: 0};
    },
    
    /**
     * 
     * @param {DerivedWorkIssue} issueData 
     * @param {*} children 
     * @param {*} issueTypeData 
     */
    onIssue: (issueData, children, issueTypeData) => {
      
      if(hierarchyLevel === BASE_HIERARCHY_LEVEL) {

        // if it has self-calculated total days ..
        if( issueData.totalDays ) {
          // add those days to the average
          issueTypeData.totalDaysOfWorkForAverage.push( issueData.totalDays );
          // set the rollup value
          issueData.rollups.totalDays = issueData.totalDays;
        } 
        else {
          // add this issue to what needs its average
          issueTypeData.needsAverageSet.push(issueData);
        }
        // we roll this up no matter what ... it's ok to roll up 0
        issueData.rollups.completedDays = issueData.completedDays;
      }
      // initiatives and above
      if( hierarchyLevel > BASE_HIERARCHY_LEVEL ) {
        // handle "parent-like" issue
        handleInitiative(issueData,{issueTypeData, issueKeyToChildren})
      }
    }
  })
}