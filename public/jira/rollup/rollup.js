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
 * This "MUST" have the deepest children in the bottom
 * @param {Array<IssuesOrReleases>} groupedHierarchy 
 * @param {{createRollupDataFromParentAndChild: CreateRollupDataFromParentAndChild}} options 
 */
export function rollupGroupedHierarchy(groupedHierarchy, {
  createMetadataForHierarchyLevel = function(){ return {} },
  createSingleNodeRollupData,
  createRollupDataFromParentAndChild,
  finalizeRollupData,
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
      metadata: createMetadataForHierarchyLevel(hierarchyLevel, issues, hierarchyLevel)
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


export function rollupHierarchy(derivedWorkIssues, {
    createRollupDataForHierarchyLevel,
    createRollupDataForIssue,
    onIssue,
    onEndOfHierarchy,
    rollupKey
  }) {
    const allIssueData = derivedWorkIssues.map( (issue)=> {
      return {...issue, [rollupKey]: createRollupDataForIssue(issue) }
    });
    
    const group = groupIssuesByHierarchyLevel(allIssueData);
    const issueKeyToChildren = Object.groupBy(allIssueData, issue => issue.parentKey);
  
    for( let hierarchyLevel = 0; hierarchyLevel < groupedIssueData.length; hierarchyLevel++) {
      let issues = groupedIssueData[hierarchyLevel];
      
      if(!issues) {
        continue;
      }
  
      // Track rollup data
      let issueTypeData = issueTypeDatas[hierarchyLevel] = createRollupDataForHierarchyLevel(hierarchyLevel, issues);
  
      // some data must be created, otherwise, skip
      if(!issueTypeData) {
        continue;
      }
      for(let issueData of allIssueData) { 
        onIssue(issueData, issueKeyToChildren[issueData.key], issueTypeData)
      }
      
      onEndOfHierarchy(issueTypeData);
    }
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
function makeGetChildren(issuesOrReleases) {
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


export function groupNodesByLevels(nodes) {
  // Create a map to store nodes by their parentKey
  const map = new Map();
  
  // Populate the map
  nodes.forEach(node => {
    if (!map.has(node.parentKey)) {
      map.set(node.parentKey, []);
    }
    map.get(node.parentKey).push(node);
  });

  const levels = [];
  let currentLevel = map.get(null) || []; // Start with top-level nodes (parentKey is null)

  while (currentLevel.length > 0) {
    levels.push(currentLevel);
    const nextLevel = [];
    
    currentLevel.forEach(node => {
      const children = map.get(node.key) || [];
      nextLevel.push(...children);
    });

    currentLevel = nextLevel;
  }

  return levels;
}
