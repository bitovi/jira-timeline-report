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

      const expected = [
        {
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

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
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
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
            },
            {
              key: "e-3",
              parentKey: "i-1",
              derivedTiming: { totalDaysOfWork: 2000, completedDaysOfWork: 0 },
            },
          ],
          [
            {
              key: "s-4",
              parentKey: "e-2",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
            },
            {
              key: "s-5",
              parentKey: "e-2",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
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

      const expected = [
        {
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

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
    });
    it("should use average estimates and completion if no estimate provided for stories", () => {
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
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 5 },
            },
            {
              key: "e-3",
              parentKey: "i-1",
              derivedTiming: { totalDaysOfWork: 2000, completedDaysOfWork: 100 },
            },
          ],
          [
            {
              key: "s-4",
              parentKey: "e-2",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 2 },
            },
            {
              key: "s-5",
              parentKey: "e-2",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 4 },
            },
            {
              key: "s-6",
              parentKey: "e-3",
              derivedTiming: { totalDaysOfWork: 10, completedDaysOfWork: 8 },
            },
            {
              key: "s-7",
              parentKey: "e-3",
              derivedTiming: { totalDaysOfWork: 20, completedDaysOfWork: 16 },
            },
          ],
        ] as IssueOrRelease<PercentCompleteRollup>[][]
      ).reverse();

      const expected = [
        {
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
              completedWorkingDays: 8,
              remainingWorkingDays: 2,
              totalWorkingDays: 10,
              userSpecifiedValues: true,
            },
            {
              completedWorkingDays: 16,
              remainingWorkingDays: 4,
              totalWorkingDays: 20,
              userSpecifiedValues: true,
            },
          ],
        },
        {
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 30,
              totalWorkingDays: 30,
              userSpecifiedValues: false,
            },
            {
              completedWorkingDays: 24,
              remainingWorkingDays: 6,
              totalWorkingDays: 30,
              userSpecifiedValues: true,
            },
          ],
        },
        {
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

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
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
              derivedTiming: { totalDaysOfWork: 2000, completedDaysOfWork: 0 },
            },
          ],
          [
            {
              parentKey: "e-3",
              key: "s-4",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
            },
            {
              parentKey: "e-3",
              key: "s-5",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
            },
          ],
        ] as IssueOrRelease<PercentCompleteRollup>[][]
      ).reverse();

      const expected = [
        {
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

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
    });
    it("should use default estimate and completion if no estimates on stories, and fall back to epic estimates for epics and initiatives", () => {
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
              derivedTiming: { totalDaysOfWork: 2000, completedDaysOfWork: 100 },
            },
          ],
          [
            {
              parentKey: "e-3",
              key: "s-4",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 10 },
            },
            {
              parentKey: "e-3",
              key: "s-5",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 20 },
            },
          ],
        ] as IssueOrRelease<PercentCompleteRollup>[][]
      ).reverse();

      const expected = [
        {
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
          rollupData: [
            {
              completedWorkingDays: 100,
              remainingWorkingDays: 1900,
              totalWorkingDays: 2000,
              userSpecifiedValues: true,
            },
          ],
        },
        {
          rollupData: [
            {
              completedWorkingDays: 100,
              remainingWorkingDays: 1900,
              totalWorkingDays: 2000,
              userSpecifiedValues: true,
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases, [method]);

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
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
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
            },
          ],
          [
            {
              parentKey: "e-3",
              key: "s-4",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
            },
            {
              parentKey: "e-3",
              key: "s-5",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
            },
          ],
        ] as IssueOrRelease<PercentCompleteRollup>[][]
      ).reverse();

      const expected = [
        {
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

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
    });
    it("should use default estimate and completion if no estimates on stories or epics, and fall back to initiative estimates", () => {
      const issuesAndReleases = (
        [
          [
            {
              parentKey: null,
              key: "i-1",
              derivedTiming: { totalDaysOfWork: 50, completedDaysOfWork: 20 },
            },
          ],
          [
            {
              parentKey: "i-1",
              key: "e-3",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 100 },
            },
          ],
          [
            {
              parentKey: "e-3",
              key: "s-4",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 10 },
            },
            {
              parentKey: "e-3",
              key: "s-5",
              derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 20 },
            },
          ],
        ] as IssueOrRelease<PercentCompleteRollup>[][]
      ).reverse();

      const expected = [
        {
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
          rollupData: [
            {
              completedWorkingDays: 20,
              remainingWorkingDays: 30,
              totalWorkingDays: 50,
              userSpecifiedValues: true,
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases, [method]);

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
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
              derivedTiming: { totalDaysOfWork: 2000, completedDaysOfWork: 0 },
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

      const expected = [
        {
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

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
    });
    it("should prefer stories over epics and initiatives with completion", () => {
      const issuesAndReleases = (
        [
          [
            {
              parentKey: null,
              key: "i-1",
              derivedTiming: { totalDaysOfWork: 50, completedDaysOfWork: 20 },
            },
          ],
          [
            {
              parentKey: "i-1",
              key: "e-3",
              derivedTiming: { totalDaysOfWork: 2000, completedDaysOfWork: 100 },
            },
          ],
          [
            {
              parentKey: "e-3",
              key: "s-6",
              derivedTiming: { totalDaysOfWork: 12, completedDaysOfWork: 4 },
            },
            {
              parentKey: "e-3",
              key: "s-7",
              derivedTiming: { totalDaysOfWork: 24, completedDaysOfWork: 16 },
            },
          ],
        ] as IssueOrRelease<PercentCompleteRollup>[][]
      ).reverse();

      const expected = [
        {
          rollupData: [
            {
              completedWorkingDays: 4,
              remainingWorkingDays: 8,
              totalWorkingDays: 12,
              userSpecifiedValues: true,
            },
            {
              completedWorkingDays: 16,
              remainingWorkingDays: 8,
              totalWorkingDays: 24,
              userSpecifiedValues: true,
            },
          ],
        },
        {
          rollupData: [
            {
              completedWorkingDays: 20,
              remainingWorkingDays: 16,
              totalWorkingDays: 36,
              userSpecifiedValues: true,
            },
          ],
        },
        {
          rollupData: [
            {
              completedWorkingDays: 20,
              remainingWorkingDays: 16,
              totalWorkingDays: 36,
              userSpecifiedValues: true,
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases, [method]);

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
    });
  });
});
