

import { workType } from "../../derived/work-status/work-status"; // ["design","dev","qa","uat"]
const workTypeRollups = ["children", ...workType];
const WIGGLE_ROOM = 0;
/**
 * 
 * @param {import("../../rolledup-and-rolledback/rollup-and-rollback").IssueOrReleaseWithPreviousTiming} issueWithPriorTiming 
 */
function prepareTimingData(issueWithPriorTiming) {

    const timingData = {
        rollup: {
            ...issueWithPriorTiming.rollupDates,
            lastPeriod: issueWithPriorTiming.issueLastPeriod ? issueWithPriorTiming.issueLastPeriod.rollupDates : null
                
        }
    }
    for(let workType of workTypeRollups) {
        const workRollup = issueWithPriorTiming.workTypeRollups[workType];
        if(workRollup) {
            timingData[workType] = {
                ...workRollup,
                lastPeriod: issueWithPriorTiming.workTypeRollups[workType]
            }
        } else {
            timingData[workType] = {
                issues: []
            }
        }
    }
    return timingData;
}

function setWorkTypeStatus(workType, timingData){
    // compare the parent status ... could be before design, after UAT and we should warn
    // what about blocked on any child?

    // if everything is complete, complete

    if(timingData.issues.length && timingData.issues.every(issue => issue.statusCategory === "done")) {
        timingData.status = "complete";
        timingData.statusFrom = {message: "Everything is done"};
    } else if(timingData.issues.some(issue => issue.blockedStatusIssues.length)) {
        timingData.status = "blocked"; 
        timingData.statusFrom = {message: "This or a child is in a blocked status"}
    }
    else {
        Object.assign(timingData, timedStatus(timingData))
    }
}



/**
 * @param {import("../../rolledup-and-rolledback/rollup-and-rollback").IssueOrReleaseWithPreviousTiming} issueWithPriorTiming 
 */
function calculateStatuses(issueWithPriorTiming){
    const timingData = prepareTimingData(issueWithPriorTiming);

    // do the rollup
    if(issueWithPriorTiming.statusCategory === "done") {
        timingData.rollup.status = "complete";
        // we should check all the children ...
        timingData.rollup.statusFrom = {message: "Own status"}
    } else if(issueWithPriorTiming.workTypeRollups.children.issues.length && issueWithPriorTiming.workTypeRollups.children.issues.every(issue => issue.statusCategory === "done")) {
        timingData.rollup.status = "complete";
        timingData.rollup.statusFrom = {message: "Children are all done, but the parent is not", warning: true};
    } else if(issueWithPriorTiming.blockedStatusIssues.length) {
        timingData.rollup.status = "blocked"; 
        timingData.rollup.statusFrom = {message: "This or a child is in a blocked status"}
    }
    else {
        Object.assign(timingData.rollup, timedStatus(timingData.rollup))
    }
    // do all the others 
    for(let workCategory of workType) {
        if(timingData[workCategory]) {
            setWorkTypeStatus(workCategory, timingData[workCategory]);
        }
    }

    return timingData;
}


export function calculateReportStatuses(issues) {
    return issues.map((issue)=> {
        return {
            ...issue,
            rollupStatuses: calculateStatuses(issue)
        }
    })
}


function timedStatus(timedRecord) {
    if (!timedRecord.due) {
            return {status: "unknown", statusFrom: {message: "there is no timing data"}}
    }
    // if now is after the complete date
    // we force complete ... however, we probably want to warn if this isn't in the
    // completed state
    else if( (+timedRecord.due) < new Date()  ) {
        return {status: "complete", statusFrom: {message: "Issue is in the past, but not marked as done", warning: true}};
    } else if (timedRecord.lastPeriod && 
        ((+timedRecord.due) > WIGGLE_ROOM + (+timedRecord.lastPeriod.due)) ) {
            return {status: "behind", statusFrom: {message: "This was due earlier last period", warning: true}};
    } else if(timedRecord.lastPeriod && 
        ((+timedRecord.due) + WIGGLE_ROOM <  (+timedRecord.lastPeriod.due)) ) {
            return {status: "ahead", statusFrom: {message: "Ahead of schedule compared to last time"}};
    } else if(!timedRecord.lastPeriod) {
        return {status: "new", statusFrom: {message: "Unable to find this last period"}};
    }
    
    if (timedRecord.start > new Date()) {
            return {status: "notstarted", statusFrom: {message: "This has not started yet"}};
    }
    else {
            return {status: "ontrack", statusFrom: {message: "This hasn't changed time yet"}};
    }
}