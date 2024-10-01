// GET DATA FROM PLACES DIRECTLY RELATED TO ISSUE

import { NormalizedIssue } from "../../jira/shared/types";

export type StartData = {
  start: Date;
  startFrom: {
    message: string;
    reference: NormalizedIssue;
  };
} | null;

export type DueData = {
  due: Date;
  dueTo: {
    message: string;
    reference: NormalizedIssue;
  };
} | null;

/**
 *
 * @param {import("../../jira/shared/types.js").NormalizedIssue} issue
 * @returns {{startData: StartData, dueData: DueData}}
 */
export function getStartDateAndDueDataFromFields(issue: NormalizedIssue) {
  let startData: StartData = null;
  let dueData: DueData = null;

  if (issue.startDate) {
    startData = {
      start: issue.startDate,
      startFrom: {
        message: `start date`,
        reference: issue,
      },
    };
  }
  if (issue.dueDate) {
    dueData = {
      due: issue.dueDate,
      dueTo: {
        message: `due date`,
        reference: issue,
      },
    };
  }
  return { startData, dueData };
}

/**
 *
 * @param {import("../../jira/shared/types.js").NormalizedIssue} story
 * @returns {{startData: StartData, dueData: DueData}}
 */
export function getStartDateAndDueDataFromSprints(story: NormalizedIssue) {
  const records: { startData: StartData; dueData: DueData }[] = [];

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
 *
 * @param {Array<{ startData: StartData; dueData: DueData }>} records
 * @returns {{startData: StartData, dueData: DueData}}
 */
export function mergeStartAndDueData(
  records: Array<{ startData: StartData; dueData: DueData }>
) {
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
    startData:
      startData.sort((d1, d2) => d1.start.getTime() - d2.start.getTime())[0] ||
      null,
    dueData:
      dueData.sort((d1, d2) => d2.due.getTime() - d1.due.getTime())[0] || null,
  };
}

/**
 *
 * @param {NormalizedIssue} issue
 * @returns {{startData: StartData, dueData: DueData}}
 */
export function getStartDateAndDueDataFromFieldsOrSprints(
  issue: NormalizedIssue
) {
  return mergeStartAndDueData([
    getStartDateAndDueDataFromFields(issue),
    getStartDateAndDueDataFromSprints(issue),
  ]);
}
