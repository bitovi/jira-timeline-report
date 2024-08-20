// FIRST, lets make a type to combine Derived issues and releases

/**
 * @typedef {import("../derived/derive").DerivedWorkIssue | import("../releases/derive").DerivedRelease} IssueOrRelease
 */
/**
 * @typedef {Array<IssueOrRelease>} IssuesOrReleases
 */


// =======================
// Now define how one would get the parents from these items
/**
 * Gets the parent's from some issue type.  We probably need some way types can provide this.
 * @param {IssueOrRelease} issueOrRelease 
 */
export function getParentKeys(issueOrRelease){
  const parents = [];
  if( issueOrRelease.parentKey ){
      parents.push(issueOrRelease.parentKey)
  }
  if(issueOrRelease.releases) {
      parents.push(...issueOrRelease.releases.map( release => release.key))
  }
  return parents;
}


// =======================
// Now need some way of building the hierarchy from the reporting topology

function getHierarchyTest({type, hierarchyLevel}) {
  if(hierarchyLevel == null || hierarchyLevel === Infinity) {
    return (issue)=> { return issue.type === type; }
  } else {
    return (issue)=> { return issue.hierarchyLevel === hierarchyLevel; }
  }
}
/**
 * 
 * @param {IssuesOrReleases} issuesOrReleases 
 * @param {Array<{type: String, hierarchyLevel: Number}>} rollupTypesAndHierarchies 
 */
export function groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTypesAndHierarchies) {
  return rollupTypesAndHierarchies.map( (hierarchy) => {
    return issuesOrReleases.filter( getHierarchyTest(hierarchy) );
  }).reverse();
}




// ====================
// With that Reporting topology, we are able to build a new mapping of parent / child relationships
// These objects are what the functions should be using to rollup and such
/**
 * @typedef {{
*  depth: Number,
*  childKeys: Array<String>,
*  parentKeys: Array<String>
* }} ReportingHierarchy
*/
/**
* @typedef {IssueOrRelease & {reportingHierarchy: ReportingHierarchy}} ReportingHierarchyIssueOrRelease
*/
/**
 * @typedef {Array<ReportingHierarchyIssueOrRelease>} ReportingHierarchyIssuesOrReleases
 */
/**
* Takes a bottom-up grouped hierarchy and adds
* reportingHierarchy = {childKeys: [keys], parentKeys: [keys], depth: Number}}
* to each issue.
*
* Returns a new bottom-up grouped hierarchy of issues or releases
* @param {Array<import("../rollup/rollup").IssuesOrReleases>} issuesOrReleases
* @return {ReportingHierarchyIssuesOrReleases}
*/
export function addChildrenFromGroupedHierarchy(groupedHierarchy) {
 // we should label each issue with its virtual hierarchy ... then we can make sure 
 // children add themselves to the right parents ... we can probably do this in one pass as things are ordered 
 // {PARENT_KEY: {allChildren: [issues..], index}}
 const parentKeyToChildren = {};
 const topDownGroups = [...groupedHierarchy].reverse();
 const newGroups = [];
 for (let g = 0; g < topDownGroups.length; g++) {
   let group = topDownGroups[g];
   let newGroup = [];
   newGroups.push(newGroup);

   for (let issue of group) {
     let copy = {
       ...issue,
       reportingHierarchy: { depth: g, childKeys: [], parentKeys: [] }
     };
     newGroup.push(copy);
     parentKeyToChildren[issue.key] = copy.reportingHierarchy;
     if (g > 0) {
       const parents = getParentKeys(issue);
       for (let parentKey of parents) {
         const parentData = parentKeyToChildren[parentKey];
         // make sure your parent is up one level in the issue hierarchy
         if (parentData && parentData.depth === g - 1) {
           parentData.childKeys.push(issue.key);
           copy.reportingHierarchy.parentKeys.push(parentKey);
         } else {
           //console.log(issue.type, "has a parent of ", parentKey, parentData.type, "but it's not going to be included", g, parentData.index, issue)
         }
       }
     }
   }
 }
 return newGroups.reverse();
}

/**
 * 
 * @param {IssuesOrReleases} issuesOrReleases 
 * @param {Array<{type: String, hierarchyLevel: Number}>} rollupTypesAndHierarchies 
 */
export function addReportingHierarchy(issuesOrReleases, rollupTypesAndHierarchies){
  const groups = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTypesAndHierarchies);
  return addChildrenFromGroupedHierarchy(groups).flat(1);
}







/**
 * @param {Array<ReportingHierarchyIssuesOrReleases>} groupedHierarchy 
 */
export function makeGetChildrenFromGrouped(groupedHierarchy) {
  const keyToIssue = new Map();;
  for(let group of groupedHierarchy){
    for(let issue of group) {
      keyToIssue.set( issue.key, issue);
    }
  }
  const getIssue = keyToIssue.get.bind(keyToIssue);
  /**
   * @param {ReportingHierarchyIssueOrRelease} keyOrIssueOrRelease
   * @return {Array<IssuesOrReleases>}
   */
  return function getChildren(keyOrIssueOrRelease){
    return keyOrIssueOrRelease.reportingHierarchy.childKeys.map(getIssue)
  }
}




/**
 * @callback CreateRollupDataFromParentAndChild
 * @param {ReportingHierarchyIssueOrRelease} issueOrRelease 
 * @param {Array<Object>} children Child rollup data
 * @param {Number} hierarchyLevel The level in the hierarchy being processed
 * @param {Object} metadata
 */

/**
 * @callback CreateMetadataForHierarchyLevel
 * @param {Number} hierarchyLevel The level in the hierarchy being processed
 * @param {Array<ReportingHierarchyIssueOrRelease>} issueOrReleases 
 * @return {Object} Metadata object
 */

/**
 * @typedef {Array<{metaData: Object, rollupData: Array}>} RollupResponse
 */



export function rollupGroupedReportingHierarchy(groupedHierarchy, {
  createMetadataForHierarchyLevel = function(){ return {} },
  createSingleNodeRollupData,
  createRollupDataFromParentAndChild,
  finalizeMetadataForHierarchyLevel = function(){},
  getChildren
}) {

  // we can build this ourselves if needed ... but costs memory.  Nice if we don't have to do this.
  if(!getChildren) {
    getChildren = makeGetChildrenFromGrouped(groupedHierarchy)
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
 * This "MUST" have the deepest children in the bottom
 * @param {Array<IssuesOrReleases>} groupedHierarchy 
 * @param {{createRollupDataFromParentAndChild: CreateRollupDataFromParentAndChild, createMetadataForHierarchyLevel: CreateMetadataForHierarchyLevel}} options 
 */
export function rollupGroupedHierarchy(groupedHierarchy, options){
  const reportingHierarchy = addChildrenFromGroupedHierarchy(groupedHierarchy)
  return rollupGroupedReportingHierarchy(reportingHierarchy, options)
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
 * @param {ReportingHierarchyIssuesOrReleases} issuesOrReleases 
 */
export function makeGetChildrenFromReportingIssues(issuesOrReleases) {
  const keyToIssue = new Map();;
  for(let issue of issuesOrReleases) {
    keyToIssue.set( issue.key, issue);
  }
  
  const getIssue = keyToIssue.get.bind(keyToIssue);
  /**
   * @param {ReportingHierarchyIssueOrRelease} keyOrIssueOrRelease
   * @return {Array<ReportingHierarchyIssuesOrReleases>}
   */
  return function getChildren(keyOrIssueOrRelease){
    return keyOrIssueOrRelease.reportingHierarchy.childKeys.map(getIssue)
  }
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


 