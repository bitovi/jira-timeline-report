import { parseDateISOString, parseDateIntoLocalTimezone } from "../date-helpers.js";
import { mostCommonElement } from "../shared/array-helpers.js";
// GET DATA FROM PLACES DIRECTLY RELATED TO ISSUE
export function getStartDateAndDueDataFromFields(issue){
    let startData, dueData;
    if(issue["Start date"]) {
        startData = {
            start: parseDateIntoLocalTimezone( issue["Start date"] ),
            startFrom: {
                message: `start date`,
                reference: issue
            }
        }
    }
    if(issue["Due date"]) {
        dueData = {
            due: parseDateIntoLocalTimezone( issue["Due date"] ),
            dueTo: {
                message: `due date`,
                reference: issue
            }
        };
    }
    return {startData, dueData};
}

export function getStartDateAndDueDataFromSprints(story){
    const records = [];

    if(story.Sprint) {
        for(const sprint of story.Sprint) {

            if(sprint) {
                records.push({
                    startData: {
                        start: parseDateISOString(sprint["startDate"]), 
                        startFrom: {
                            message: `${sprint.name}`,
                            reference: story
                        }
                    },
                    dueData: {
                        due: parseDateISOString(sprint["endDate"]),
                        dueTo: {
                            message: `${sprint.name}`,
                            reference: story
                        }
                    }
                });
            } else {

            }

        }
    }
    return mergeStartAndDueData(records);
    
}
export function mergeStartAndDueData(records){
    const startData = records.filter( record => record?.startData ).map( record => record.startData );
    const dueData = records.filter( record => record?.dueData ).map( record => record.dueData );

    return {
        startData: startData.sort( (d1, d2) => d1.start - d2.start )[0],
        dueData: dueData.sort( (d1, d2) => d2.due - d1.due )[0]
    }
}

export function getStartDateAndDueDataFromFieldsOrSprints(issue ){
    return mergeStartAndDueData( [
        getStartDateAndDueDataFromFields(issue),
        getStartDateAndDueDataFromSprints(issue)
    ] );
}

export function parentFirstThenChildren(getIssueDateData, getChildDateData){
    const issueDateData = getIssueDateData();
    const childrenDateData = getChildDateData();
    if(issueDateData.startData && issueDateData.dueData) {
        return issueDateData;
    }
    

    return {
        startData: issueDateData.startData || childrenDateData.startData,
        dueData: issueDateData.dueData || childrenDateData.dueData,
    }
}

export function childrenOnly(getIssueDateData, getChildDateData){
    return getChildDateData();
}

export function parentOnly(getIssueDateData, getChildDateData){
    // eventually we can look to remove these. Some code still depends on having children everywhere
    getChildDateData();
    return getIssueDateData();
}

export function childrenFirstThenParent(getIssueDateData, getChildDateData){
    const childrenDateData = getChildDateData();
    if(childrenDateData.startData && childrenDateData.dueData) {
        return childrenDateData;
    }
    const issueDateData = getIssueDateData();
    return {
        startData: childrenDateData.startData || issueDateData.startData,
        dueData: childrenDateData.dueData || issueDateData.dueData,
    }
}

export function widestRange(getIssueDateData, getChildDateData){
    const childrenDateData = getChildDateData();
    const issueDateData = getIssueDateData();
    // eventually might want the reason to be more the parent ... but this is fine for now
    return mergeStartAndDueData([childrenDateData, issueDateData]);
}

const methods = {
    parentFirstThenChildren,
    childrenOnly,
    childrenFirstThenParent,
    widestRange,
    parentOnly
}

export const calculationKeysToNames = {
    parentFirstThenChildren: function(parent, child){
        return `From ${parent.type}, then ${child.plural}`
    },
    childrenOnly: function(parent, child){
        return `From ${child.plural}`
    },
    childrenFirstThenParent: function(parent, child){
        return `From ${child.plural}, then ${parent.type}`
    },
    widestRange: function(parent, child){
        return `From ${parent.type} or ${child.plural} (earliest to latest)`
    },
    parentOnly: function(parent, child){
        return `From ${parent.type}`
    }
}

export function getIssueWithDateData(issue, childMap, methodNames = ["childrenOnly","parentFirstThenChildren"], index=0) {
    // by default we stop recursion
    let methodName = methodNames[index] ? methodNames[index]: "parentOnly";
    index++;

    const method = methods[methodName];
    const issueClone = {
        ...issue,
        dateData: {
            rollup: {}
        }
    };

    const dateData = method(function getParentData(){
        const selfDates = getStartDateAndDueDataFromFieldsOrSprints(issue);
        issueClone.dateData.self =  addDateDataTo({}, selfDates);
        return selfDates;
    }, function getChildrenData(){
        const children = childMap[issue["Issue key"]] || [];
   
        const datedChildren = children.map( (child)=> {
            return getIssueWithDateData(child, childMap,methodNames, index);
        });
        const childrenData = mergeStartAndDueData(datedChildren.map(getDataDataFromDatedIssue))
        issueClone.dateData.children = addDateDataTo({
            issues: datedChildren
        },childrenData );
        return childrenData;
        
    });
    addDateDataTo(issueClone.dateData.rollup, dateData);

    return issueClone;
}

function addDateDataTo(object = {}, dateData) {
    Object.assign(object, dateData.startData);
    Object.assign(object, dateData.dueData);
    return object;
}


function getDataDataFromDatedIssue(issue){
    let startData, dueData;
    if(issue.dateData.rollup.start) {
        startData = {start: issue.dateData.rollup.start, startFrom: issue.dateData.rollup.startFrom}
    }
    if(issue.dateData.rollup.due) {
        dueData = {due: issue.dateData.rollup.due, dueTo: issue.dateData.rollup.dueTo}
    }
    return {startData, dueData};
}

// provides an object with rolled updates
export function rollupDatesFromRollups(issues) {
    const dateData = mergeStartAndDueData( issues.map(getDataDataFromDatedIssue) );

    return {
        ...dateData.startData,
        ...dateData.dueData,
        issues
    }
}

/**
 * 
 * @param {Array<import("../jira/normalized/normalize.js").NormalizedIssue>} normalizedIssues 
 * @returns {Array<{type: string, hierarchyLevel: number}>}
 */
// TODO: I think this can be removed
function issueHierarchy(normalizedIssues){
    const levelsToNames = []
    for( let issue of normalizedIssues) {
        if(!levelsToNames[issue.hierarchyLevel]) {
            levelsToNames[issue.hierarchyLevel] = [];
        }
        levelsToNames[issue.hierarchyLevel].push(issue.type)
    }
    return levelsToNames.map( (names, i) => {
        return {type: mostCommonElement(names), hierarchyLevel: i}
    }).filter( i => i )
}

/**
 * @type {{
 *  child: String,
 *  parent: String,
 *  calculation: string,
 *  name: string
 * }} ChildCalculationOption
 */


/**
 * @type {{
 *   type: string,
 *   plural: string,
 *   children: Array<string>,
 *   availableTimingCalculations: Array<String>,
 *   denormalizedChildren: Array<IssueDateRollupObject>,
 *   timingCalculations: Array<{child: string, calculations: Array<ChildCalculationOption>}>,
 *   timingCalculationsMap: Object<string, Array<ChildCalculationOption>>
 * }} IssueDateRollupObject 
 */

/**
 * @type {Object<string, IssueDateRollupObject>} TimingCalculationsMap
 */

/**
 * 
 * @param {import("../jira/normalized/normalize.js").NormalizedIssue} normalizedIssues 
 * @returns {Array<IssueDateRollupObject> & {typeToIssueType: IssueDateRollupObject}}
 */

export function allTimingCalculationOptions(normalizedIssues){
    const hierarchy = issueHierarchy(normalizedIssues).reverse();

    const issueOnlyHierarchy = hierarchy.map( ({type, hierarchyLevel}, index) => {
        // if the last thing
        if(!hierarchy[index+1]) {
            return {type, hierarchyLevel, plural: type+"s", children: [], availableTimingCalculations: ["parentOnly"]}
        } else {
            return {type, hierarchyLevel, plural: type+"s", children: [hierarchy[index+1].type], availableTimingCalculations: "*"}
        }
    })

    const base = [
        { type: "Release", hierarchyLevel: Infinity, plural: "Releases", children: hierarchy.map( h => h.type), availableTimingCalculations: ["childrenOnly"]},
        ...issueOnlyHierarchy
    ]

    // the base object
    const typeToIssueType = {};
    for(const issueType of base) {
      typeToIssueType[issueType.type] = issueType;
    }
  
    const allCalculations = Object.keys( calculationKeysToNames );
    for(const issueType of base) {
        // add the denormalized children, so they can be references back to the original object
      issueType.denormalizedChildren = issueType.children.map( typeName => typeToIssueType[typeName]);
      const calcNames = issueType.availableTimingCalculations === "*" ? allCalculations : issueType.availableTimingCalculations;
      
      const childToTimingMap = {};
      issueType.timingCalculations = [];
      
      for(let issueTypeName of issueType.children){
        // for each child issue, create a map of each type
        childToTimingMap[issueTypeName] = calcNames.map((calculationName)=> {
          return {
              child: issueTypeName, 
              parent: issueType.type, 
              calculation: calculationName, name: calculationKeysToNames[calculationName](issueType, typeToIssueType[issueTypeName]) }
        });
        let childType = typeToIssueType[issueTypeName];
        // an array of what's above
        issueType.timingCalculations.push({child: issueTypeName, hierarchyLevel: childType.hierarchyLevel, calculations: childToTimingMap[issueTypeName]});
      }
      issueType.timingCalculationsMap = childToTimingMap;
    }
    return {
        list: base,
        map: typeToIssueType
    };
}
/*
export function denormalizedIssueHierarchy(normalizedIssues){
    const hierarchy = issueHierarchy(normalizedIssues).reverse();

    const issueOnlyHierarchy = hierarchy.map( ({type, hierarchyLevel}, index) => {
        // if the last thing
        if(!hierarchy[index+1]) {
            return {type, hierarchyLevel, plural: type+"s", children: [], availableTimingCalculations: ["parentOnly"]}
        } else {
            return {type, hierarchyLevel, plural: type+"s", children: [hierarchy[index+1].type], availableTimingCalculations: "*"}
        }
    })

    const base = [
        { type: "Release",  plural: "Releases", children: hierarchy.map( h => h.type), availableTimingCalculations: ["childrenOnly"]},
        ...issueOnlyHierarchy
    ]


    // the base object
    const typeToIssueType = {};
    for(const issueType of base) {
      typeToIssueType[issueType.type] = issueType;
    }
  
    const allCalculations = Object.keys( calculationKeysToNames );
    for(const issueType of base) {
        // add the denormalized children, so they can be references back to the original object
      issueType.denormalizedChildren = issueType.children.map( typeName => typeToIssueType[typeName]);
      const calcNames = issueType.availableTimingCalculations === "*" ? allCalculations : issueType.availableTimingCalculations;
      
      const childToTimingMap = {};
      issueType.timingCalculations = [];

      for(let issueTypeName of issueType.children){
        // for each child issue, create a map of each type
        childToTimingMap[issueTypeName] = calcNames.map((calculationName)=> {
          return {
              child: issueTypeName, parent: issueType.type, 
              calculation: calculationName, name: calculationKeysToNames[calculationName](issueType, typeToIssueType[issueTypeName]) }
        });
        // an array of what's above
        issueType.timingCalculations.push({child: issueTypeName, calculations: childToTimingMap[issueTypeName]});
      }
      issueType.timingCalculationsMap = childToTimingMap;
    }
    base.typeToIssueType = typeToIssueType;
    return base;
  }*/
  
  
  export function getImpliedTimingCalculations(primaryIssueType, issueTypeMap, currentTimingCalculations){
      const primaryType = issueTypeMap[primaryIssueType];
      // can happen while data is loading
      if(!primaryType) {
        return [];
      }
      let currentType = primaryIssueType;
      
      let childrenCalculations = primaryType.timingCalculations;
      const timingLevels = [];
      const setCalculations = [...currentTimingCalculations];
      
      const impliedTimingCalculations = [];
      
      while(childrenCalculations.length) {
        // this is the calculation that should be selected for that level
        let setLevelCalculation = setCalculations.shift() || 
          {
            type: childrenCalculations[0].child, 
            hierarchyLevel: childrenCalculations[0].hierarchyLevel,
            calculation: childrenCalculations[0].calculations[0].calculation
          };
        impliedTimingCalculations.push(setLevelCalculation);
        currentType = setLevelCalculation.type;
        childrenCalculations = issueTypeMap[currentType].timingCalculations;
      }
      return impliedTimingCalculations;
  }