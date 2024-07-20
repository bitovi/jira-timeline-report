// Helpers that could be used to help rollup issue data
// This isn't used currently

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
  