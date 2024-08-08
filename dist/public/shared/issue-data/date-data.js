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
export function getStartDateAndDueDataFromFields(issue) {
    var startData, dueData;
    if (issue.startDate) {
        startData = {
            start: issue.startDate,
            startFrom: {
                message: "start date",
                reference: issue
            }
        };
    }
    if (issue.dueDate) {
        dueData = {
            due: issue.dueDate,
            dueTo: {
                message: "due date",
                reference: issue
            }
        };
    }
    return { startData: startData, dueData: dueData };
}
/**
 *
 * @param {import("./issue-data.js").NormalizedIssue} story
 * @returns {{startData: StartData, dueData: DueData}}
 */
export function getStartDateAndDueDataFromSprints(story) {
    var records = [];
    if (story.sprints) {
        for (var _i = 0, _a = story.sprints; _i < _a.length; _i++) {
            var sprint = _a[_i];
            if (sprint && sprint.startDate && sprint.endDate) {
                records.push({
                    startData: {
                        start: sprint.startDate,
                        startFrom: {
                            message: "".concat(sprint.name),
                            reference: story
                        }
                    },
                    dueData: {
                        due: sprint.endDate,
                        dueTo: {
                            message: "".concat(sprint.name),
                            reference: story
                        }
                    }
                });
            }
        }
    }
    return mergeStartAndDueData(records);
}
export function mergeStartAndDueData(records) {
    var startData = records.filter(function (record) { return record === null || record === void 0 ? void 0 : record.startData; }).map(function (record) { return record.startData; });
    var dueData = records.filter(function (record) { return record === null || record === void 0 ? void 0 : record.dueData; }).map(function (record) { return record.dueData; });
    return {
        startData: startData.sort(function (d1, d2) { return d1.start - d2.start; })[0],
        dueData: dueData.sort(function (d1, d2) { return d2.due - d1.due; })[0]
    };
}
/**
 *
 * @param {*} issue
 * @returns {{startData: StartData, dueData: DueData}}
 */
export function getStartDateAndDueDataFromFieldsOrSprints(issue) {
    return mergeStartAndDueData([
        getStartDateAndDueDataFromFields(issue),
        getStartDateAndDueDataFromSprints(issue)
    ]);
}
