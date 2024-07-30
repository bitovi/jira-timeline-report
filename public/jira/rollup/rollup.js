// Helpers that could be used to help rollup issue data
// This isn't used currently

/**
 * @typedef {import("../derived/derive").DerivedWorkIssue | import("../releases/derive").DerivedRelease} IssueOrRelease
 */
/**
 * @typedef {Array<IssueOrRelease>} IssuesOrReleases
 */

/**
 * @callback CreateRollupDataFromParentAndChild
 * @param {IssueOrRelease} issueOrRelease 
 * @param {Array<Object>} children Child rollup data
 * @param {Number} hierarchyLevel The level in the hierarchy being processed
 * @param {Object} metadata
 */

/**
 * @callback CreateMetadataForHierarchyLevel
 * @param {Number} hierarchyLevel The level in the hierarchy being processed
 * @param {Array<IssueOrRelease>} issueOrReleases 
 * @return {Object} Metadata object
 */

/**
 * @typedef {Array<{metaData: Object, rollupData: Array}>} RollupResponse
 */


/**
 * This "MUST" have the deepest children in the bottom
 * @param {Array<IssuesOrReleases>} groupedHierarchy 
 * @param {{createRollupDataFromParentAndChild: CreateRollupDataFromParentAndChild, createMetadataForHierarchyLevel: CreateMetadataForHierarchyLevel}} options 
 */
export function rollupGroupedHierarchy(groupedHierarchy, {
  createMetadataForHierarchyLevel = function(){ return {} },
  createSingleNodeRollupData,
  createRollupDataFromParentAndChild,
  finalizeMetadataForHierarchyLevel = function(){},
  getChildren
}) {

  // we can build this ourselves if needed ... but costs memory.  Nice if we don't have to do this.
  if(!getChildren) {
    getChildren = makeGetChildren(groupedHierarchy.flat(1))
  }
  const rollupDataByKey = {};
  function getChildrenRollupData(issue){
    return getChildren(issue).map( childIssue => {
      
      const result = rollupDataByKey[childIssue.key];
      if(!result) {
        throw new Error("unable to find previously calculated child data ("+childIssue.key+"). Is your hierarchy in the right order?")
      }
      return result;
    })
  }

  const rollupResponseData = [];
  

  for( let hierarchyLevel = 0; hierarchyLevel < groupedHierarchy.length; hierarchyLevel++) {
    let issues = groupedHierarchy[hierarchyLevel];
    
    if(!issues) {
      continue;
    }

    let hierarchyData = rollupResponseData[hierarchyLevel] = {
      rollupData: [],
      metadata: createMetadataForHierarchyLevel(hierarchyLevel, issues)
    }

    for(let issue of issues) { 
      // get children rollup data for issue
      let children = getChildrenRollupData(issue);
      let rollupData = createRollupDataFromParentAndChild(issue, children, hierarchyLevel, hierarchyData.metadata)
      hierarchyData.rollupData.push(rollupData);
      rollupDataByKey[issue.key] = rollupData;
      // associate it with the issue 
    }
    
    //onEndOfHierarchy(issueTypeData);
    finalizeMetadataForHierarchyLevel(hierarchyData.metadata, hierarchyData.rollupData)
  }
  return rollupResponseData;
}

/**
 * @param {Array<Number>} arr 
 * @returns {Number}
 */
export function sum(arr) {
  return arr.reduce((partialSum, a) => partialSum + a, 0)
}
/**
 * @param {Array<Number>} arr 
 * @returns {Number|undefined}
 */
export function average(arr){
  return arr.length > 0 ? sum(arr) / arr.length : undefined;
}
  
function groupIssuesByHierarchyLevel(issues, options) {
  const sorted = issues //.sort(sortByIssueHierarchy);
  const group = [];
  for(let issue of sorted) {
    if(!group[issue.hierarchyLevel]) {
      group[issue.hierarchyLevel] = [];
    }
    group[issue.hierarchyLevel].push(issue)
  }
  return group;
}
  


  /**
 * 
 * @param {IssuesOrReleases} issuesOrReleases 
 */
export function makeGetChildren(issuesOrReleases) {
  const keyToChildren = {};
  // make a map of all children for the keys ...
  for(let item of issuesOrReleases) {
      const parents = getParentKeys(item);
      for(let parentKey of parents) {
          if(!keyToChildren[parentKey]) {
              keyToChildren[parentKey] = [];
          }
          keyToChildren[parentKey].push(item);
      }
  }
  /**
   * @param {IssueOrRelease | String}
   * @return {Array<IssuesOrReleases>}
   */
  return function getChildren(keyOrIssueOrRelease){
      const key = typeof keyOrIssueOrRelease === "string" ? keyOrIssueOrRelease : keyOrIssueOrRelease.key;
      return keyToChildren[key] || [];
  }
}

/**
 * Gets the parent's from some issue type.  We probably need some way types can provide this.
 * @param {IssueOrRelease} issueOrRelease 
 */
function getParentKeys(issueOrRelease){
  const parents = [];
  if( issueOrRelease.parentKey ){
      parents.push(issueOrRelease.parentKey)
  }
  if(issueOrRelease.releases) {
      parents.push(...issueOrRelease.releases.map( release => release.key))
  }
  return parents;
}

/**
 * 
 * @param {IssuesOrReleases} issuesOrReleases 
 * @param {Array<{type: String, hierarchyLevel: Number}>} rollupTypesAndHierarchies 
 */
export function groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTypesAndHierarchies) {

  return rollupTypesAndHierarchies.map( ({type, hierarchyLevel}) => {
    if(hierarchyLevel == null || hierarchyLevel === Infinity) {
      return issuesOrReleases.filter( (issue)=> { return issue.type === type })
    } else {
      return issuesOrReleases.filter( (issue)=> { return issue.hierarchyLevel === hierarchyLevel })
    }
  }).reverse();
}
/**
 * 
 * @param {Array<IssuesOrReleases>} groupedHierarchy 
 * @param {RollupResponse} rollupDatas 
 * @param {String} key 
 */
export function zipRollupDataOntoGroupedData(groupedHierarchy, rollupDatas, key) {
  const newGroups = [];
  for(let g = 0; g < groupedHierarchy.length; g++) {
    let group = groupedHierarchy[g];
    let newIssues = [];
    newGroups.push(newIssues);
    for(let i = 0; i < group.length; i++) {
      let issue = group[i];
      let clone = {...issue};//Object.create(issue);
      clone[key] = rollupDatas[g].rollupData[i];
      newIssues.push(clone);
    }
  }
  return newGroups;
} 