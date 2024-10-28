import { expect, test, describe, it } from "vitest";
import { PercentCompleteMeta, PercentCompleteRollup, rollupPercentComplete } from "./percent-complete";
import { IssueOrRelease, RollupResponse } from "../rollup";

describe("percentComplete", () => {
  describe("childrenFirstThenParent", () => {
    const method = "childrenFirstThenParent";

    test("estimates for stories should override epics and initiatives", () => {
      const issuesAndReleases = (
        [
          [
            {
              parentKey: null,
              key: "i-1",
              derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
            },
          ],
          [
            {
              parentKey: "i-1",
              key: "e-2",
              derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
            },
            {
              parentKey: "i-1",
              key: "e-3",
              derivedTiming: { totalDaysOfWork: 4, completedDaysOfWork: 2 },
            },
          ],
          [
            {
              parentKey: "e-2",
              key: "s-4",
              derivedTiming: { totalDaysOfWork: 8, completedDaysOfWork: 3 },
            },
            {
              parentKey: "e-2",
              key: "s-5",
              derivedTiming: { totalDaysOfWork: 16, completedDaysOfWork: 12 },
            },
            {
              parentKey: "e-3",
              key: "s-6",
              derivedTiming: { totalDaysOfWork: 32, completedDaysOfWork: 19 },
            },
            {
              parentKey: "e-3",
              key: "s-7",
              derivedTiming: { totalDaysOfWork: 64, completedDaysOfWork: 31 },
            },
          ],
        ] as IssueOrRelease<PercentCompleteRollup>[][]
      ).reverse();

      const expected: RollupResponse<PercentCompleteRollup, PercentCompleteMeta> = [
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

      const actual = rollupPercentComplete(issuesAndReleases, [method]);

      expect(actual).toStrictEqual(expected);
    });
    it("should use average estimates if no estimate provided for stories", () => {
      const method = "childrenFirstThenParent";

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
              derivedTiming: {
                totalDaysOfWork: null,
                completedDaysOfWork: null,
              },
            },
            {
              key: "e-3",
              parentKey: "i-1",
              derivedTiming: {
                totalDaysOfWork: 2000,
                completedDaysOfWork: null,
              },
            },
          ],
          [
            {
              key: "s-4",
              parentKey: "e-2",
              derivedTiming: {
                totalDaysOfWork: null,
                completedDaysOfWork: null,
              },
            },
            {
              key: "s-5",
              parentKey: "e-2",
              derivedTiming: {
                totalDaysOfWork: null,
                completedDaysOfWork: null,
              },
            },
            {
              key: "s-6",
              parentKey: "e-3",
              derivedTiming: { totalDaysOfWork: 10, completedDaysOfWork: 0 },
            },
            {
              key: "s-7",
              parentKey: "e-3",
              derivedTiming: { totalDaysOfWork: 20, completedDaysOfWork: 0 },
            },
          ],
        ] as IssueOrRelease<PercentCompleteRollup>[][]
      ).reverse();

      const expected: RollupResponse<PercentCompleteRollup, PercentCompleteMeta> = [
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 15,
            childCounts: [],
            needsAverageSet: [
              {
                completedWorkingDays: 0,
                remainingWorkingDays: 15,
                totalWorkingDays: 15,
                userSpecifiedValues: false,
              },
              {
                completedWorkingDays: 0,
                remainingWorkingDays: 15,
                totalWorkingDays: 15,
                userSpecifiedValues: false,
              },
            ],
            totalDays: 0,
            totalDaysOfWorkForAverage: [10, 20],
          },
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 15,
              totalWorkingDays: 15,
              userSpecifiedValues: false,
            },
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 15,
              totalWorkingDays: 15,
              userSpecifiedValues: false,
            },
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 10,
              totalWorkingDays: 10,
              userSpecifiedValues: true,
            },
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 20,
              totalWorkingDays: 20,
              userSpecifiedValues: true,
            },
          ],
        },
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 30,
            childCounts: [],
            needsAverageSet: [],
            totalDays: 0,
            totalDaysOfWorkForAverage: [30],
          },
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 30,
              totalWorkingDays: 30,
              userSpecifiedValues: false,
            },
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 30,
              totalWorkingDays: 30,
              userSpecifiedValues: true,
            },
          ],
        },
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 1,
            childCounts: [],
            needsAverageSet: [],
            totalDays: 0,
            totalDaysOfWorkForAverage: [1],
          },
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 1,
              totalWorkingDays: 1,
              userSpecifiedValues: true,
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases, [method]);

      expect(actual).toStrictEqual(expected);
    });
    it("should use default estimate if no estimates on stories, and fall back to epic estimates for epics and initiatives", () => {
      const issuesAndReleases = (
        [
          [
            {
              parentKey: null,
              key: "i-1",
              derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
            },
          ],
          [
            {
              parentKey: "i-1",
              key: "e-3",
              derivedTiming: { totalDaysOfWork: 2000, completedDaysOfWork: null },
            },
          ],
          [
            {
              parentKey: "e-3",
              key: "s-4",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: null },
            },
            {
              parentKey: "e-3",
              key: "s-5",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: null },
            },
          ],
        ] as IssueOrRelease<PercentCompleteRollup>[][]
      ).reverse();

      const expected: RollupResponse<PercentCompleteRollup, PercentCompleteMeta> = [
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 30,
            childCounts: [],
            needsAverageSet: [
              {
                completedWorkingDays: 0,
                remainingWorkingDays: 30,
                totalWorkingDays: 30,
                userSpecifiedValues: false,
              },
              {
                completedWorkingDays: 0,
                remainingWorkingDays: 30,
                totalWorkingDays: 30,
                userSpecifiedValues: false,
              },
            ],
            totalDays: 0,
            totalDaysOfWorkForAverage: [],
          },
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 30,
              totalWorkingDays: 30,
              userSpecifiedValues: false,
            },
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 30,
              totalWorkingDays: 30,
              userSpecifiedValues: false,
            },
          ],
        },
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 2000,
            childCounts: [],
            needsAverageSet: [],
            totalDays: 0,
            totalDaysOfWorkForAverage: [2000],
          },
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 2000,
              totalWorkingDays: 2000,
              userSpecifiedValues: true,
            },
          ],
        },
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 2000,
            childCounts: [],
            needsAverageSet: [],
            totalDays: 0,
            totalDaysOfWorkForAverage: [2000],
          },
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 2000,
              totalWorkingDays: 2000,
              userSpecifiedValues: true,
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases, [method]);

      expect(actual).toStrictEqual(expected);
    });
    it("should use default estimate if no estimates on stories or epics, and fall back to initiative estimates", () => {
      const issuesAndReleases = (
        [
          [
            {
              parentKey: null,
              key: "i-1",
              derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
            },
          ],
          [
            {
              parentKey: "i-1",
              key: "e-3",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: null },
            },
          ],
          [
            {
              parentKey: "e-3",
              key: "s-4",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: null },
            },
            {
              parentKey: "e-3",
              key: "s-5",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: null },
            },
          ],
        ] as IssueOrRelease<PercentCompleteRollup>[][]
      ).reverse();

      const expected: RollupResponse<PercentCompleteRollup, PercentCompleteMeta> = [
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 30,
            childCounts: [],
            needsAverageSet: [
              {
                completedWorkingDays: 0,
                remainingWorkingDays: 30,
                totalWorkingDays: 30,
                userSpecifiedValues: false,
              },
              {
                completedWorkingDays: 0,
                remainingWorkingDays: 30,
                totalWorkingDays: 30,
                userSpecifiedValues: false,
              },
            ],
            totalDays: 0,
            totalDaysOfWorkForAverage: [],
          },
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 30,
              totalWorkingDays: 30,
              userSpecifiedValues: false,
            },
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 30,
              totalWorkingDays: 30,
              userSpecifiedValues: false,
            },
          ],
        },
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 30,
            childCounts: [],
            needsAverageSet: [],
            totalDays: 0,
            totalDaysOfWorkForAverage: [],
          },
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 60,
              totalWorkingDays: 60,
              userSpecifiedValues: false,
            },
          ],
        },
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 1,
            childCounts: [],
            needsAverageSet: [],
            totalDays: 0,
            totalDaysOfWorkForAverage: [1],
          },
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 1,
              totalWorkingDays: 1,
              userSpecifiedValues: true,
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases, [method]);

      expect(actual).toStrictEqual(expected);
    });
    it("should prefer stories over epics and initiatives", () => {
      const issuesAndReleases = (
        [
          [
            {
              parentKey: null,
              key: "i-1",
              derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
            },
          ],
          [
            {
              parentKey: "i-1",
              key: "e-3",
              derivedTiming: { totalDaysOfWork: 2000, completedDaysOfWork: null },
            },
          ],
          [
            {
              parentKey: "e-3",
              key: "s-6",
              derivedTiming: { totalDaysOfWork: 10, completedDaysOfWork: 0 },
            },
            {
              parentKey: "e-3",
              key: "s-7",
              derivedTiming: { totalDaysOfWork: 20, completedDaysOfWork: 0 },
            },
          ],
        ] as IssueOrRelease<PercentCompleteRollup>[][]
      ).reverse();

      const expected: RollupResponse<PercentCompleteRollup, PercentCompleteMeta> = [
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 15,
            childCounts: [],
            needsAverageSet: [],
            totalDays: 0,
            totalDaysOfWorkForAverage: [10, 20],
          },
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 10,
              totalWorkingDays: 10,
              userSpecifiedValues: true,
            },
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 20,
              totalWorkingDays: 20,
              userSpecifiedValues: true,
            },
          ],
        },
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 30,
            childCounts: [],
            needsAverageSet: [],
            totalDays: 0,
            totalDaysOfWorkForAverage: [30],
          },
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 30,
              totalWorkingDays: 30,
              userSpecifiedValues: true,
            },
          ],
        },
        {
          metadata: {
            averageChildCount: 0,
            averageTotalDays: 30,
            childCounts: [],
            needsAverageSet: [],
            totalDays: 0,
            totalDaysOfWorkForAverage: [30],
          },
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 30,
              totalWorkingDays: 30,
              userSpecifiedValues: true,
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases, [method]);

      expect(actual).toStrictEqual(expected);
    });
  });
});
