//import { JiraIssue } from "../shared/issue-data/issue-data.js";
import { estimateExtraPoints } from "../confidence.js";
import { millisecondsToDay, parseDate8601String } from "../date-helpers.js";

/**
 * @param { JiraIssue[] } issues
 * @param { PercentCompleteOptions } options
 */
export function percentComplete(issues, options) {

  console.log(altPercentComplete(issues, {
    ...options,
    toWholeDay: options.toWholeDay ?? Math.round,
  }));

  return;
  /** @type {PercentCompleteOptions} */
  const completeOptions = {
    ...options,
    toWholeDay: options.toWholeDay ?? Math.round,
  };

  const map = buildMap(issues, completeOptions);
  setDurations(map, completeOptions);

  console.log("percentComplete: map=", map);
}

/**
 * @export
 * @param {JiraIssue[]} issues
 * @param {PercentCompleteOptions} options
 * @returns {Record<string, CompletionIssue>>}
 */
export function buildMap(issues, options) {
  return issues.reduce((acc, issue) => {
    const key = options.getIssueKey(issue);
    const parentKey = options.getParentKey(issue);

    acc[key] = {
      childKeys: acc[key]?.childKeys ?? [],
      confidence: options.getConfidence(issue),
      dueDate: options.getDueDate(issue),
      hierarchyLevel: options.getHierarchyLevel(issue),
      key,
      parentKey,
      startDate: options.getStartDate(issue),
      storyPoints: options.getStoryPoints(issue),
      storyPointsMedian: options.getStoryPointsMedian(issue),
      type: options.getType(issue),
    };

    if (parentKey) {
      if (acc[parentKey]) {
        acc[parentKey].childKeys.push(key);
      } else {
        acc[parentKey] = { childKeys: [key] };
      }
    }

    return acc;
  }, {});
}

/**
 * @export
 * @param { Record<string, CompletionIssue> } map
 * @param { PercentCompleteOptions } options
 * @param { string[] } [parentTypeIssueKeys] Contents will be mutated to include duration
 * information.
 */
export function setDurations(map, options, parentTypeIssueKeys = []) {
  /**
   * @param {string} key Sum the duration of the children (and children's children, etc.) for this
   * issue.
   * @return {number} Will be -1 if this function fails to generate child durations.
   */
  function sumIssueChildren(key) {
    const childIssues = [];
    map[key].childKeys
      .map((childKey) => map[childKey])
      .forEach((childIssue) => {
        // Capture the child issues we use to determine a duration.
        if (options.includeTypes.includes(childIssue.type)) {
          childIssues.push(childIssue);
          return;
        }

        // These are parent type issues, we'll deal with them later
        if (parentTypeIssueKeys.some((pk) => childIssue.key === pk)) {
          parentTypeIssueKeys.push(childIssue.key);
        }
      });

    // If there are no children then the code that called us will have to handle setting the
    // parent's duration somehow. Bail out now.
    if (!childIssues.length) {
      return;
    }

    const unEstimatedKeys = [];
    const estimatedDurationDays = childIssues.reduce(
      (sum, childIssue) => {
        const durationDays = getChildDurationDay(childIssue, options);

        // Did we actually get an estimated time? Or do we need to manage duration outside this
        // reduce?
        if (durationDays) {
          childIssue.durationDays = durationDays;
          sum.set(durationDays);
        } else {
          // There was no way to estimate this child's duration
          unEstimatedKeys.push(childIssue.key);
        }

        return sum;
      },
      {
        set: function (add) {
          this.value = this.value === -1 ? 0 : this.value;
          this.value += add;
        },
        value: -1,
      }
    );

    const result = estimatedDurationDays.value;

    // Great, we processed all the child issues.
    if (unEstimatedKeys.length < childIssues.length) {
      // If there were some child issues with estimates and some without, we'll use the existing
      // estimates to create an average duration for the child issues that weren't estimated.
      const averageChildDurationDays =
        estimatedDurationDays.value /
        (childIssues.length - unEstimatedKeys.length);

      unEstimatedKeys.forEach((unEstimatedKey) => {
        map[unEstimatedKey].durationDays = averageChildDurationDays;
        result += averageChildDurationDays;
      });
    }

    return result;
  }

  const needDurationKeys = [];
  /**
   * @param {string} mapKey
   * @param {number | void} duration
   */
  function handleDurationResult(mapKey, duration) {
    const issue = map[mapKey];
    if (typeof duration === "number" && 0 <= duration) {
      issue.durationDays = duration;
    } else {
      // Does the issue have start and end dates?
      if (issue.dueDate && issue.startDate) {
        issue.durationDays = millisecondsToDay(
          parseDate8601String(issue.dueDate) -
            parseDate8601String(issue.startDate)
        );
      } else {
        needDurationKeys.push(mapKey);
      }
    }
  }

  Object.entries(map).forEach(([mapKey, issue]) => {
    if (issue.type === options.parentType) {
      handleDurationResult(mapKey, sumIssueChildren(mapKey));
    }
  });

  const parentTypeKeys = []; // Contents of this array will be changed in setDurations.
  while (parentTypeKeys.length) {
    const mapKey = parentTypeKeys.shift();
    handleDurationResult(mapKey, setDurations(map, options, parentTypeKeys));
  }

  // Do we have any initiatives that couldn't be estimated?
  if (needDurationKeys.length) {
    let sum = 0;
    let count = 0;

    const parents = Object.entries(map).filter(
      ([, issue]) => issue.type === options.parentType
    );

    parents.forEach(({ durationDays }) => {
      if (durationDays) {
        count++;
        sum += durationDays;
      }
    });

    const defaultDuration = options.defaultParentDurationDays;
    if (0 < count) {
      defaultDuration = Math.round(sum / count);
    }

    parents.forEach((issue) => {
      if (!issue.duration) {
        issue.duration = defaultDuration;
      }
    });
  }

  // OK, every parent should have a duration.
}

/**
 * @param {CompletionIssue} issue
 * @param { PercentCompleteOptions } options
 * @returns {number | void}
 */
function getChildDurationDay(issue, options) {
  // These are cases where the child issue (Epic) has a valid estimation
  let durationDays;
  if (issue.startDate && issue.dueDate) {
    durationDays = millisecondsToDay(
      parseDate8601String(issue.dueDate) - parseDate8601String(issue.startDate),
      options.toWholeDay
    );
  } else if (issue.confidence && issue.storyPointsMedian) {
    durationDays = options.toWholeDay(
      estimateExtraPoints(
        issue.storyPointsMedian,
        issue.confidence,
        options.uncertaintyWeight
      )
    );
  } else if (issue.storyPoints) {
    durationDays = issue.storyPoints;
  }

  return durationDays;
}

/**
 * @typedef CompletionIssue
 * @property {string[]} childKeys
 * @property {string | null} confidence
 * @property {string | null} dueDate
 * @property {number} [durationDays]
 * @property {number} hierarchyLevel
 * @property {string} key
 * @property {string} [parentKey]
 * @property {string | null} startDate
 * @property {string | null} [storyPoints]
 * @property {string | null} [storyPointsMedian]
 * @property {string} type
 */

/**
 * @typedef PercentCompleteOptions
 * @property {(issue: JiraIssue) => number} getConfidence
 * @property {(teamKey: string) => number} getDaysPerSprint
 * @property {(issue: JiraIssue) => string} getDueDate
 * @property {(issue: JiraIssue) => number} getHierarchyLevel
 * @property {(issue: JiraIssue) => string} getIssueKey
 * @property {(issue: JiraIssue) => string | undefined} getParentKey
 * @property {(issue: JiraIssue) => string} getStartDate
 * @property {(issue: JiraIssue) => number | void} getStoryPoints
 * @property {(issue: JiraIssue) => number | void} getStoryPointsMedian
 * @property {(issue: JiraIssue) => string} getType
 * @property {(teamKey: string) => number} getVelocity
 * @property {number} defaultParentDurationDays
 * @property {string[]} includeTypes These types will be used to calculate the total number of issues, and completed issues for the `parentType`.
 * @property {string} parentType Percent complete will be calculated for this issue type.
 * @property {(number) => number} [toWholeDay] A Math function to convert time units (like seconds) into a whole day. Defaults to round.
 * @property {number} uncertaintyWeight
 */



function altPercentComplete(issues, options) {
  const cleanedIssues = prepareIssues(issues, options);

  return rollupWorkingDays(groupIssuesByHierarchyLevel(cleanedIssues, options), options);
}

function sortByIssueHierarchy(issueA, issueB){
  return issueB.hierarchyLevel - issueA.hierarchyLevel;
}

function prepareIssues(issues, options) {
  return issues.map( (issue) => {
    const data = {
      key: options.getIssueKey(issue),
      parentKey: options.getParentKey(issue),
      confidence: options.getConfidence(issue),
      dueDate: options.getDueDate(issue),
      hierarchyLevel: options.getHierarchyLevel(issue),
      startDate: options.getStartDate(issue),
      storyPoints: options.getStoryPoints(issue),
      storyPointsMedian: options.getStoryPointsMedian(issue),
      type: options.getType(issue),
      team: options.getTeamKey(issue),
      issue,
      rollups: {totalDays: 0, completedDays: 0},
      summary: issue.fields.Summary
    };
    data.totalDays = getSelfTotalDays(data, options);
    data.completedDays = getSelfCompletedDays(data, options);
    return data;
  });
}

function getSelfTotalDays(issue, options) {
  // These are cases where the child issue (Epic) has a valid estimation
  let durationDays,
    durationPoints;
  if (issue.startDate && issue.dueDate) {
    durationDays = millisecondsToDay(
      parseDate8601String(issue.dueDate) - parseDate8601String(issue.startDate),
      options.toWholeDay
    );
  } else if (issue.confidence && issue.storyPointsMedian) {
    durationPoints = issue.storyPointsMedian + estimateExtraPoints(
        issue.storyPointsMedian,
        issue.confidence,
        options.uncertaintyWeight
      )
    ;
  } else if (issue.storyPoints) {
    durationPoints = issue.storyPoints;
  }
  if(durationPoints) {
    durationDays = options.toWholeDay( durationPoints / options.getVelocity(issue.team) * options.getDaysPerSprint(issue.team) ) ;
  }

  return durationDays;
}

function getSelfCompletedDays(issue, options) {
  // These are cases where the child issue (Epic) has a valid estimation

  if(issue.startDate && parseDate8601String(issue.startDate) < new Date() ) {
    if(!issue.dueDate || parseDate8601String(issue.dueDate) > new Date() ) {
      return millisecondsToDay(
        new Date() - parseDate8601String(issue.startDate),
        options.toWholeDay
      )
    } else {
      return millisecondsToDay(
        parseDate8601String(issue.dueDate) - parseDate8601String(issue.startDate),
        options.toWholeDay
      );
    }
  } else {
    return 0;
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

const BASE_HIERARCHY_LEVEL = 1;


function rollupWorkingDays(groupedIssueData, options){
  
  const allIssueData = groupedIssueData.flat();
  const issueKeyToChildren = Object.groupBy(allIssueData, issue => issue.parentKey);

  // Store information for each level of of the hierarchy 
  const issueTypeDatas = [];
  
  // for each level of the hierarchy, starting with the bottom
  for( let hierarchyLevel = BASE_HIERARCHY_LEVEL; hierarchyLevel < groupedIssueData.length; hierarchyLevel++) {
    let issues = groupedIssueData[hierarchyLevel];
    
    if(issues) {

      // Track rollup data
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

        normalizedIssues: issues
      }

      // for issues on that level
      for(let issueData of issues) {
        // epics
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
          handleInitiative(issueData,{issueTypeData, issueKeyToChildren}, options)
        }
      }

      // calculate the average 
      let ave = average( issueTypeData.totalDaysOfWorkForAverage ) || 30;
      issueTypeData.averageTotalDays = ave;

      issueTypeData.averageChildCount = average( issueTypeData.childCounts )

      // set average on children that need it
      issueTypeData.needsAverageSet.forEach( issueData => {
        issueData.rollups.totalDays = ave;
        issueData.rollups.remainingDays = issueData.rollups.totalDays - issueData.rollups.completedDays;
      })
    }
  }

  return {
    normalizedIssues: allIssueData,
    hierarchyRollups: issueTypeDatas
  };
}
function sum(arr) {
  return arr.reduce((partialSum, a) => partialSum + a, 0)
}
function average(arr){
  return sum(arr) / arr.length;
}

function handleInitiative(issueData,{issueTypeData, issueKeyToChildren}, options) {
  if(issueData.key === "IMP-143") {
    debugger;
  }

  // Empty
  if(! issueKeyToChildren[issueData.key] ) {
    issueTypeData.needsAverageSet.push(issueData);
    return;
  }

  const children = issueKeyToChildren[issueData.key];
  const totalDays = children.map(child => child.rollups.totalDays);
  const completedDays = children.map(child => child.rollups.completedDays);

  // Fully Estimated
  if(children.every( child => child.totalDays )) {
    // we probably want a better signal ... but this will do for now
    issueData.totalDays = sum(totalDays);

    // Add so average can be calculated
    issueTypeData.totalDaysOfWorkForAverage.push(issueData.totalDays);
    issueTypeData.childCounts.push(children.length);

    
  } 
  // Partially estimated
  else {
    // Do nothing
  }


  // Roll up the days from the children
  // This works b/c children that originally had no estimate will already have their rollup total days 
  // set to the average.  
  

  issueData.rollups.totalDays = sum(totalDays);
  issueData.rollups.completedDays = sum(completedDays);
  issueData.rollups.remainingDays = issueData.rollups.totalDays - issueData.rollups.completedDays;

  
}

