import { parseDateISOString, parseDateIntoLocalTimezone } from "../../date-helpers.js";

// GET DATA FROM PLACES DIRECTLY RELATED TO ISSUE

/** @typedef {null| {
 *   start: Date,
 *   startFrom: {message: string, reference: any}
 * }} StartData */

/** @typedef {null| {
 *   due: Date,
 *   dueTo: {message: string, reference: any}
 * }} DueData */

/**
 * 
 * @param {import("./issue-data.js").NormalizedIssue} issue 
 * @returns {{startData: StartData, dueData: DueData}}
 */
export function getStartDateAndDueDataFromFields(issue){
    let startData, dueData;
    if(issue.startDate) {
        startData = {
            start: issue.startDate,
            startFrom: {
                message: `start date`,
                reference: issue
            }
        }
    }
    if(issue.dueDate) {
        dueData = {
            due: issue.dueDate,
            dueTo: {
                message: `due date`,
                reference: issue
            }
        };
    }
    return {startData, dueData};
}

/**
 * 
 * @param {import("./issue-data.js").NormalizedIssue} story 
 * @returns {{startData: StartData, dueData: DueData}}
 */
export function getStartDateAndDueDataFromSprints(story){
    const records = [];

    if(story.sprints) {
        for(const sprint of story.sprints) {

            if(sprint && sprint.startDate && sprint.endDate) {
                records.push({
                    startData: {
                        start: sprint.startDate, 
                        startFrom: {
                            message: `${sprint.name}`,
                            reference: story
                        }
                    },
                    dueData: {
                        due: sprint.endDate,
                        dueTo: {
                            message: `${sprint.name}`,
                            reference: story
                        }
                    }
                });
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

/**
 * 
 * @param {*} issue 
 * @returns {{startData: StartData, dueData: DueData}}
 */
export function getStartDateAndDueDataFromFieldsOrSprints(issue ){
    return mergeStartAndDueData( [
        getStartDateAndDueDataFromFields(issue),
        getStartDateAndDueDataFromSprints(issue)
    ] );
}