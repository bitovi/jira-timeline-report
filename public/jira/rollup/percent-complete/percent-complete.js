import { rollupGroupedHierarchy, groupIssuesByHierarchyLevelOrType, zipRollupDataOntoGroupedData } from "../rollup";


export function addPercentComplete(issuesOrReleases, rollupTimingLevelsAndCalculations) {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTimingLevelsAndCalculations);
  const rollupMethods = rollupTimingLevelsAndCalculations.map( rollupData => rollupData.calculation).reverse();
  const rolledUpDates = rollupPercentComplete(groupedIssues, rollupMethods);
  const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpDates, "completionRollup");
  return zipped.flat();
}

/**
 * 
 * @param {Array<import("../rollup").IssuesOrReleases>} issuesOrReleases Starting from low to high
 * @param {Array<String>} methodNames Starting from low to high
 * @return {Array<Object>}
 */
export function rollupPercentComplete(groupedHierarchy, methodNames, {getChildren}  = {}) {
  return rollupGroupedHierarchy(groupedHierarchy, {
      createMetadataForHierarchyLevel(hierarchyLevel){
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
        }
      },
      finalizeMetadataForHierarchyLevel(metadata, rollupData) {
        let ave = average( metadata.totalDaysOfWorkForAverage ) || 30;
        metadata.averageTotalDays = ave;

        //metadata.averageChildCount = average( metadata.childCounts )
        // set average on children that need it
        metadata.needsAverageSet.forEach( data => {
          data.totalWorkingDays = ave;
        })
      },
      createRollupDataFromParentAndChild(issueOrRelease, children, hierarchyLevel, metadata){
        const methodName = /*methodNames[hierarchyLevel] ||*/ "childrenFirstThenParent";
        const method = methods[methodName];
        return method(issueOrRelease, children, hierarchyLevel, metadata);
      }
  });
}

function emptyRollup(){
  return {
    completedWorkingDays: 0,
    totalWorkingDays: 0,
    userSpecifiedValues: false,
    get remainingWorkingDays(){
      return this.totalWorkingDays - this.completedWorkingDays
    }
  }
}

function sumChildRollups(children){
  const userSpecifiedValues = children.every( d => d.userSpecifiedValues );
  const totalDays = children.map(child => child.totalWorkingDays);
  const completedDays = children.map(child => child.completedWorkingDays);
  return {
    completedWorkingDays: sum(completedDays),
    totalWorkingDays: sum(totalDays),
    userSpecifiedValues: userSpecifiedValues,
    get remainingWorkingDays(){
      return this.totalWorkingDays - this.completedWorkingDays
    }
  }
}

const methods = {
  parentFirstThenChildren,
  childrenOnly,
  childrenFirstThenParent,
  widestRange,
  parentOnly
};


/**
 * 
 * @param {import("../rollup").IssueOrRelease} parentIssueOrRelease 
 * @param {*} childrenRollups 
 * @returns 
 */
export function parentFirstThenChildren(parentIssueOrRelease, childrenRollups,hierarchyLevel, metadata){
  debugger;
  // if there is hard parent data, use it
  var data;
  if(parentIssueOrRelease?.derivedTiming?.totalDaysOfWork) {
    data = {
      completedWorkingDays: parentIssueOrRelease.derivedTiming.completedDaysOfWork,
      totalWorkingDays: parentIssueOrRelease.derivedTiming.totalDaysOfWork,
      userSpecifiedValues: true,
      get remainingWorkingDays(){
        return this.totalWorkingDays - this.completedWorkingDays
      }
    }
    // make sure we can build an average from it 
    metadata.totalDaysOfWorkForAverage.push( data.totalWorkingDays );
    return data;
  } 
  // if there is hard child data, use it
  else if(childrenRollups.length && childrenRollups.every( d => d.userSpecifiedValues )) {
    data = sumChildRollups(childrenRollups);
    metadata.totalDaysOfWorkForAverage.push( data.totalWorkingDays );
    return data;
  }
  // if there is weak children data, use it, but don't use it for other averages
  else if(childrenRollups.length) {
    data = sumChildRollups(childrenRollups);
    return data;
  }
  // if there are no children, add to get the uncertainty
  else {
    data = emptyRollup();
    metadata.needsAverageSet.push(data);
    return data;
  }
}

export function childrenOnly(parentIssueOrRelease, childrenRollups){
  return mergeStartAndDueData(childrenRollups);
}

export function parentOnly(parentIssueOrRelease, childrenRollups){
  return {
      ...getStartData(parentIssueOrRelease.derivedTiming),
      ...getDueData(parentIssueOrRelease.derivedTiming)
  };
}

export function childrenFirstThenParent(parentIssueOrRelease, childrenRollups,hierarchyLevel, metadata){
  var data;
  // if there is hard child data, use it
  if(childrenRollups.length && childrenRollups.every( d => d.userSpecifiedValues )) {
    data = sumChildRollups(childrenRollups);
    metadata.totalDaysOfWorkForAverage.push( data.totalWorkingDays );
    return data;
  }
  // if there is hard parent data, use it
  else if(parentIssueOrRelease?.derivedTiming?.totalDaysOfWork) {
    data = {
      completedWorkingDays: parentIssueOrRelease.derivedTiming.completedDaysOfWork,
      totalWorkingDays: parentIssueOrRelease.derivedTiming.totalDaysOfWork,
      userSpecifiedValues: true,
      get remainingWorkingDays(){
        return this.totalWorkingDays - this.completedWorkingDays
      }
    }
    // make sure we can build an average from it 
    metadata.totalDaysOfWorkForAverage.push( data.totalWorkingDays );
    return data;
  } 
  
  // if there is weak children data, use it, but don't use it for other averages
  else if(childrenRollups.length) {
    data = sumChildRollups(childrenRollups);
    return data;
  }
  // if there are no children, add to get the uncertainty
  else {
    data = emptyRollup();
    metadata.needsAverageSet.push(data);
    return data;
  }
}

export function widestRange(parentIssueOrRelease, childrenRollups){
  return mergeStartAndDueData([parentIssueOrRelease.derivedTiming, ...childrenRollups]);
  
  const childrenDateData = getChildDateData();
  const issueDateData = getIssueDateData();
  // eventually might want the reason to be more the parent ... but this is fine for now
  return mergeStartAndDueData([childrenDateData, issueDateData]);
}






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
          // we roll this up no matter what ... it's ok to roll up 0
          issueData.completionRollup.completedWorkingDays = issueData.derivedTiming.completedDaysOfWork;

          // if it has self-calculated total days ..
          if( issueData.derivedTiming.totalDaysOfWork ) {
            // add those days to the average
            issueTypeData.totalDaysOfWorkForAverage.push( issueData.derivedTiming.totalDaysOfWork );
            // set the rollup value
            issueData.completionRollup.totalWorkingDays = issueData.derivedTiming.totalDaysOfWork;
            issueData.completionRollup.remainingWorkingDays = issueData.completionRollup.totalWorkingDays - issueData.completionRollup.completedWorkingDays;
          } 
          else {
            // add this issue to what needs its average
            issueTypeData.needsAverageSet.push(issueData);
          }
          
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
        issueData.completionRollup.remainingWorkingDays = issueData.completionRollup.totalWorkingDays - issueData.completionRollup.completedWorkingDays;
      })
    }
  }
  console.log(issueTypeDatas);
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
  issueData.completionRollup.remainingWorkingDays = issueData.completionRollup.totalWorkingDays - issueData.completionRollup.completedWorkingDays;
  
}




