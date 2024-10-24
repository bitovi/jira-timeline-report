import { expect, test, describe, it } from "vitest";
import {
  PercentCompleteMeta,
  PercentCompleteRollup,
  rollupPercentComplete,
  sumChildRollups,
} from "./percent-complete";
import { RollupResponse } from "../rollup";
import { DerivedIssue } from "../../derived/derive";

describe("percentComplete", () => {
  test("sumChildRollups", () => {
    const children: PercentCompleteRollup[] = [];

    const expected: PercentCompleteRollup = {
      completedWorkingDays: 0,
      remainingWorkingDays: 0,
      totalWorkingDays: 0,
      userSpecifiedValues: true,
    };

    const actual = sumChildRollups(children);

    expect(actual).toStrictEqual(expected);
  });
  test("childrenFirstThenParent is the default", () => {
    const issuesAndReleases = (
      [
        [
          {
            key: "i-1",
            parentKey: null,
            derivedTiming: { totalDaysOfWork: 1 },
          },
        ],
        [
          {
            key: "e-2",
            parentKey: "i-1",
            derivedTiming: { totalDaysOfWork: 1 },
          },
          {
            key: "e-3",
            parentKey: "i-1",
            derivedTiming: { totalDaysOfWork: 4 },
          },
        ],
        [
          {
            key: "s-4",
            parentKey: "e-2",
            derivedTiming: { totalDaysOfWork: 8 },
          },
          {
            key: "s-5",
            parentKey: "e-2",
            derivedTiming: { totalDaysOfWork: 16 },
          },
          {
            key: "s-6",
            parentKey: "e-3",
            derivedTiming: { totalDaysOfWork: 32 },
          },
          {
            key: "s-7",
            parentKey: "e-3",
            derivedTiming: { totalDaysOfWork: 64 },
          },
        ],
      ] as DerivedIssue[][]
    ).reverse();

    const expected: RollupResponse<
      PercentCompleteRollup,
      PercentCompleteMeta<unknown>
    > = [
      {
        metadata: {
          averageChildCount: 0,
          averageTotalDays: 30,
          childCounts: [],
          issues: [],
          needsAverageSet: [],
          totalDays: 0,
          totalDaysOfWorkForAverage: [8, 16, 32, 64],
        },
        rollupData: [
          {
            completedWorkingDays: 0,
            remainingWorkingDays: NaN,
            totalWorkingDays: 8,
            userSpecifiedValues: true,
          },
          {
            completedWorkingDays: 0,
            remainingWorkingDays: NaN,
            totalWorkingDays: 16,
            userSpecifiedValues: true,
          },
          {
            completedWorkingDays: 0,
            remainingWorkingDays: NaN,
            totalWorkingDays: 32,
            userSpecifiedValues: true,
          },
          {
            completedWorkingDays: 0,
            remainingWorkingDays: NaN,
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
          issues: [],
          needsAverageSet: [],
          totalDays: 0,
          totalDaysOfWorkForAverage: [24, 96],
        },
        rollupData: [
          {
            completedWorkingDays: NaN,
            remainingWorkingDays: NaN,
            totalWorkingDays: 24,
            userSpecifiedValues: true,
          },
          {
            completedWorkingDays: NaN,
            remainingWorkingDays: NaN,
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
          issues: [],
          needsAverageSet: [],
          totalDays: 0,
          totalDaysOfWorkForAverage: [120],
        },
        rollupData: [
          {
            completedWorkingDays: NaN,
            remainingWorkingDays: NaN,
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
