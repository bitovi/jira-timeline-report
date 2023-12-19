import { parseDateISOString } from "../date-helpers.js";

// GET DATA FROM PLACES DIRECTLY RELATED TO ISSUE
export function getStartDateAndDueDataFromFields(issue){
    let startData, dueData;
    if(issue["Start date"]) {
        startData = {
            start: parseDateISOString( issue["Start date"] ),
            startFrom: {
                message: `start date`,
                reference: issue
            }
        }
    }
    if(issue["Due date"]) {
        dueData = {
            due: parseDateISOString( issue["Due date"] ),
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
function mergeStartAndDueData(records){
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
    if(issueDateData.startData && issueDateData.dueData) {
        return issueDateData;
    }
    const childrenDateData = getChildDateData();

    return {
        startData: issueDateData.startData || childrenDateData.startData,
        dueData: issueDateData.dueData || childrenDateData.dueData,
    }
}

export function childrenOnly(getIssueDateData, getChildDateData){
    return getChildDateData();
}

export function parentOnly(getIssueDateData, getChildDateData){
    return getIssueDateData();
}

export function childrenFirstThenParent(getIssueDateData, getChildDateData){
    const childrenDateData = getChildDateData();
    if(childrenDateData.startData && childrenDateData.dueData) {
        return issueDateData;
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