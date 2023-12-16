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
    const issueClone = {...issue};

    const dateData = method(function getParentData(){
        return getStartDateAndDueDataFromFieldsOrSprints(issue)
    }, function getChildrenData(){
        const children = childMap[issue["Issue key"]];
        if(children) {
            const datedChildren = children.map( (child)=> {
                return getIssueWithDateData(child, childMap,methodNames, index);
            });
            issueClone.children = datedChildren;
            return mergeStartAndDueData(datedChildren.map(getDataDataFromDatedIssue));
        } else {
            return {};
        }
    });
    Object.assign(issueClone, dateData.startData);
    Object.assign(issueClone, dateData.dueData);
    return issueClone;
}



function getDataDataFromDatedIssue(issue){
    let startData, dueData;
    if(issue.start) {
        startData = {start: issue.start, startFrom: issue.startFrom}
    }
    if(issue.due) {
        dueData = {due: issue.due, dueTo: issue.dueTo}
    }
    return {startData, dueData};
}