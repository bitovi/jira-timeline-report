import { expect, test, describe, it } from "vitest";
import {
  PercentCompleteMeta,
  PercentCompleteRollup,
  rollupPercentComplete,
  sumChildRollups,
} from "./percent-complete";
import { IssueOrRelease, RollupResponse } from "../rollup";

describe("percentComplete", () => {
  test("childrenFirstThenParent is the default", () => {
    const issuesAndReleases = (
      [
        [
          {
            key: "i-1",
            parentKey: null,
            derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
          },
        ],
        [
          {
            key: "e-2",
            parentKey: "i-1",
            derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
          },
          {
            key: "e-3",
            parentKey: "i-1",
            derivedTiming: { totalDaysOfWork: 4, completedDaysOfWork: 2 },
          },
        ],
        [
          {
            key: "s-4",
            parentKey: "e-2",
            derivedTiming: { totalDaysOfWork: 8, completedDaysOfWork: 3 },
          },
          {
            key: "s-5",
            parentKey: "e-2",
            derivedTiming: { totalDaysOfWork: 16, completedDaysOfWork: 12 },
          },
          {
            key: "s-6",
            parentKey: "e-3",
            derivedTiming: { totalDaysOfWork: 32, completedDaysOfWork: 19 },
          },
          {
            key: "s-7",
            parentKey: "e-3",
            derivedTiming: { totalDaysOfWork: 64, completedDaysOfWork: 31 },
          },
        ],
      ] as IssueOrRelease<PercentCompleteRollup>[][]
    ).reverse();

    const expected: RollupResponse<PercentCompleteRollup, PercentCompleteMeta> =
      [
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 30,
            childCounts: [],
            needsAverageSet: [],
            totalDays: 0,
            totalDaysOfWorkForAverage: [8, 16, 32, 64],
          },
          rollupData: [
            {
              completedWorkingDays: 3,
              remainingWorkingDays: 5,
              totalWorkingDays: 8,
              userSpecifiedValues: true,
            },
            {
              completedWorkingDays: 12,
              remainingWorkingDays: 4,
              totalWorkingDays: 16,
              userSpecifiedValues: true,
            },
            {
              completedWorkingDays: 19,
              remainingWorkingDays: 13,
              totalWorkingDays: 32,
              userSpecifiedValues: true,
            },
            {
              completedWorkingDays: 31,
              remainingWorkingDays: 33,
              totalWorkingDays: 64,
              userSpecifiedValues: true,
            },
          ],
        },
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 60,
            childCounts: [],
            needsAverageSet: [],
            totalDays: 0,
            totalDaysOfWorkForAverage: [24, 96],
          },
          rollupData: [
            {
              completedWorkingDays: 15,
              remainingWorkingDays: 9,
              totalWorkingDays: 24,
              userSpecifiedValues: true,
            },
            {
              completedWorkingDays: 50,
              remainingWorkingDays: 46,
              totalWorkingDays: 96,
              userSpecifiedValues: true,
            },
          ],
        },
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 120,
            childCounts: [],
            needsAverageSet: [],
            totalDays: 0,
            totalDaysOfWorkForAverage: [120],
          },
          rollupData: [
            {
              completedWorkingDays: 65,
              remainingWorkingDays: 55,
              totalWorkingDays: 120,
              userSpecifiedValues: true,
            },
          ],
        },
      ];

    const actual = rollupPercentComplete(issuesAndReleases, []);

    expect(actual).toStrictEqual(expected);
  });
});
