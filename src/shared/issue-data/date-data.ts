// GET DATA FROM PLACES DIRECTLY RELATED TO ISSUE

import { NormalizedIssue } from "../../jira/shared/types";

export type StartData = {
  start: Date;
  startFrom: {
    message: string;
    reference: NormalizedIssue;
  };
};

export type DueData = {
  due: Date;
  dueTo: {
    message: string;
    reference: NormalizedIssue;
  };
};

type StartAndDueData = {
  startData: StartData | null;
  dueData: DueData | null;
};
/**
 *
 * @param {import("../../jira/shared/types.js").NormalizedIssue} issue
 * @returns {StartAndDueData}
 */
export function getStartDateAndDueDataFromFields(issue: NormalizedIssue) {
  const result: StartAndDueData = { startData: null, dueData: null };

  if (issue.startDate) {
    result.startData = {
      start: issue.startDate,
      startFrom: {
        message: `start date`,
        reference: issue,
      },
    };
  }
  if (issue.dueDate) {
    result.dueData = {
      due: issue.dueDate,
      dueTo: {
        message: `due date`,
        reference: issue,
      },
    };
  }
  return result;
}

/**
 *
 * @param {import("../../jira/shared/types.js").NormalizedIssue} story
 * @returns {StartAndDueData}
 */
export function getStartDateAndDueDataFromSprints(story: NormalizedIssue): StartAndDueData {
  const records: StartAndDueData[] = [];

  if (story.sprints) {
    for (const sprint of story.sprints) {
      if (sprint && sprint.startDate && sprint.endDate) {
        records.push({
          startData: {
            start: sprint.startDate,
            startFrom: {
              message: `${sprint.name}`,
              reference: story,
            },
          },
          dueData: {
            due: sprint.endDate,
            dueTo: {
              message: `${sprint.name}`,
              reference: story,
            },
          },
        });
      }
    }
  }
  return mergeStartAndDueData(records);
}

/**
 * I think we have 2 of these functions ... 
 * @param {Array<StartAndDueData>} records
 * @returns {StartAndDueData}
 */
export function mergeStartAndDueData(records: Array<StartAndDueData>): StartAndDueData {
  const startData = records
    .filter(
      (
        record
      ): record is {
        startData: NonNullable<StartData>;
        dueData: DueData;
      } => record.startData !== null
    )
    .map((record) => record.startData);
  const dueData = records
    .filter(
      (
        record
      ): record is {
        startData: StartData;
        dueData: NonNullable<DueData>;
      } => record.dueData !== null
    )
    .map((record) => record.dueData);

  return {
    startData: startData.sort((d1, d2) => d1.start.getTime() - d2.start.getTime())[0] || null,
    dueData: dueData.sort((d1, d2) => d2.due.getTime() - d1.due.getTime())[0] || null,
  };
}

/**
 *
 * @param {NormalizedIssue} issue
 * @returns {StartAndDueData}
 */
export function getStartDateAndDueDataFromFieldsOrSprints(issue: NormalizedIssue): StartAndDueData {
  return mergeStartAndDueData([
    getStartDateAndDueDataFromFields(issue),
    getStartDateAndDueDataFromSprints(issue),
  ]);
}
