import { expect, test, describe, it } from 'vitest';
import { rollupPercentComplete } from './percent-complete';
import { IssueOrRelease } from '../rollup';

describe('percentComplete', () => {
  describe('childrenFirstThenParent', () => {
    test('estimates for stories should override epics and initiatives', () => {
      const issuesAndReleases = [
        [
          {
            parentKey: 'e-2',
            key: 's-4',
            derivedTiming: { totalDaysOfWork: 8, completedDaysOfWork: 3 },
          },
          {
            parentKey: 'e-2',
            key: 's-5',
            derivedTiming: { totalDaysOfWork: 16, completedDaysOfWork: 12 },
          },
          {
            parentKey: 'e-3',
            key: 's-6',
            derivedTiming: { totalDaysOfWork: 32, completedDaysOfWork: 19 },
          },
          {
            parentKey: 'e-3',
            key: 's-7',
            derivedTiming: { totalDaysOfWork: 64, completedDaysOfWork: 31 },
          },
        ],
        [
          {
            parentKey: 'i-1',
            key: 'e-2',
            derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
          },
          {
            parentKey: 'i-1',
            key: 'e-3',
            derivedTiming: { totalDaysOfWork: 4, completedDaysOfWork: 2 },
          },
        ],
        [
          {
            parentKey: null,
            key: 'i-1',
            derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
          },
        ],
      ] as IssueOrRelease[][];

      const expected = [
        {
          rollupData: [
            {
              completedWorkingDays: 3,
              remainingWorkingDays: 5,
              totalWorkingDays: 8,
              userSpecifiedValues: true,
              source: 'self',
            },
            {
              completedWorkingDays: 12,
              remainingWorkingDays: 4,
              totalWorkingDays: 16,
              userSpecifiedValues: true,
              source: 'self',
            },
            {
              completedWorkingDays: 19,
              remainingWorkingDays: 13,
              totalWorkingDays: 32,
              userSpecifiedValues: true,
              source: 'self',
            },
            {
              completedWorkingDays: 31,
              remainingWorkingDays: 33,
              totalWorkingDays: 64,
              userSpecifiedValues: true,
              source: 'self',
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
              source: 'children',
            },
            {
              completedWorkingDays: 50,
              remainingWorkingDays: 46,
              totalWorkingDays: 96,
              userSpecifiedValues: true,
              source: 'children',
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
              source: 'children',
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases);

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
    });

    it('should use average estimates if no estimate provided for stories (completed zero)', () => {
      const issuesAndReleases = [
        [
          {
            key: 's-4',
            parentKey: 'e-2',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
          },
          {
            key: 's-5',
            parentKey: 'e-2',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
          },
          {
            key: 's-6',
            parentKey: 'e-3',
            derivedTiming: { totalDaysOfWork: 10, completedDaysOfWork: 0 },
          },
          {
            key: 's-7',
            parentKey: 'e-3',
            derivedTiming: { totalDaysOfWork: 20, completedDaysOfWork: 0 },
          },
        ],
        [
          {
            key: 'e-2',
            parentKey: 'i-1',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
          },
          {
            key: 'e-3',
            parentKey: 'i-1',
            derivedTiming: { totalDaysOfWork: 2000, completedDaysOfWork: 0 },
          },
        ],
        [
          {
            key: 'i-1',
            parentKey: null,
            derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
          },
        ],
      ] as IssueOrRelease[][];

      // only uses children if they are actually specified ... but will take it
      const expected = [
        {
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 15,
              totalWorkingDays: 15,
              source: 'average',
              userSpecifiedValues: false,
            },
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 15,
              totalWorkingDays: 15,
              source: 'average',
              userSpecifiedValues: false,
            },
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 10,
              totalWorkingDays: 10,
              source: 'self',
              userSpecifiedValues: true,
            },
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 20,
              totalWorkingDays: 20,
              source: 'self',
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
              source: 'children',
            },
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 30,
              totalWorkingDays: 30,
              userSpecifiedValues: true,
              source: 'children',
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
              source: 'self',
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases);

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
    });
    it('should use average estimates if no estimate provided for stories', () => {
      const issuesAndReleases = [
        [
          {
            key: 's-4',
            parentKey: 'e-2',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 2 },
          },
          {
            key: 's-5',
            parentKey: 'e-2',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 4 },
          },
          {
            key: 's-6',
            parentKey: 'e-3',
            derivedTiming: { totalDaysOfWork: 10, completedDaysOfWork: 8 },
          },
          {
            key: 's-7',
            parentKey: 'e-3',
            derivedTiming: { totalDaysOfWork: 20, completedDaysOfWork: 16 },
          },
        ],
        [
          {
            key: 'e-2',
            parentKey: 'i-1',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 5 },
          },
          {
            key: 'e-3',
            parentKey: 'i-1',
            derivedTiming: { totalDaysOfWork: 2000, completedDaysOfWork: 100 },
          },
        ],
        [
          {
            key: 'i-1',
            parentKey: null,
            derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
          },
        ],
      ] as IssueOrRelease[][];

      const expected = [
        {
          rollupData: [
            {
              completedWorkingDays: 2,
              remainingWorkingDays: 15,
              totalWorkingDays: 17,
              userSpecifiedValues: false,
              source: 'average',
            },
            {
              completedWorkingDays: 4,
              remainingWorkingDays: 15,
              totalWorkingDays: 19,
              userSpecifiedValues: false,
              source: 'average',
            },
            {
              completedWorkingDays: 8,
              remainingWorkingDays: 2,
              totalWorkingDays: 10,
              userSpecifiedValues: true,
              source: 'self',
            },
            {
              completedWorkingDays: 16,
              remainingWorkingDays: 4,
              totalWorkingDays: 20,
              userSpecifiedValues: true,
              source: 'self',
            },
          ],
        },
        {
          rollupData: [
            {
              completedWorkingDays: 6,
              remainingWorkingDays: 30,
              totalWorkingDays: 36,
              userSpecifiedValues: false,
              source: 'children',
            },
            {
              completedWorkingDays: 24,
              remainingWorkingDays: 6,
              totalWorkingDays: 30,
              userSpecifiedValues: true,
              source: 'children',
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
              source: 'self',
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases);

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
    });

    it('should use default estimate if no estimates on stories, and fall back to epic estimates for epics and initiatives (no completed days)', () => {
      const issuesAndReleases = [
        [
          {
            parentKey: 'e-3',
            key: 's-4',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
          },
          {
            parentKey: 'e-3',
            key: 's-5',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
          },
        ],
        [
          {
            parentKey: 'i-1',
            key: 'e-3',
            derivedTiming: { totalDaysOfWork: 2000, completedDaysOfWork: 0 },
          },
        ],
        [
          {
            parentKey: null,
            key: 'i-1',
            derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
          },
        ],
      ] as IssueOrRelease[][];

      const expected = [
        {
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 30,
              totalWorkingDays: 30,
              userSpecifiedValues: false,
              source: 'average',
            },
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 30,
              totalWorkingDays: 30,
              userSpecifiedValues: false,
              source: 'average',
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
              source: 'self',
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
              source: 'children',
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases);

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
    });
    it('should use default estimate if no estimates on stories, and fall back to epic estimates for epics and initiatives', () => {
      const issuesAndReleases = [
        [
          {
            parentKey: 'e-3',
            key: 's-4',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 10 },
          },
          {
            parentKey: 'e-3',
            key: 's-5',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 20 },
          },
        ],
        [
          {
            parentKey: 'i-1',
            key: 'e-3',
            derivedTiming: { totalDaysOfWork: 2000, completedDaysOfWork: 100 },
          },
        ],
        [
          {
            parentKey: null,
            key: 'i-1',
            derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
          },
        ],
      ] as IssueOrRelease[][];

      const expected = [
        {
          rollupData: [
            {
              completedWorkingDays: 10,
              remainingWorkingDays: 30,
              totalWorkingDays: 40,
              userSpecifiedValues: false,
              source: 'average',
            },
            {
              completedWorkingDays: 20,
              remainingWorkingDays: 30,
              totalWorkingDays: 50,
              userSpecifiedValues: false,
              source: 'average',
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
              source: 'self',
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
              source: 'children',
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases);

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
    });

    it('should use default estimate if no estimates on stories or epics, and fall back to initiative estimates', () => {
      const issuesAndReleases = [
        [
          {
            parentKey: 'e-3',
            key: 's-4',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
          },
          {
            parentKey: 'e-3',
            key: 's-5',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
          },
        ],
        [
          {
            parentKey: 'i-1',
            key: 'e-3',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 0 },
          },
        ],
        [
          {
            parentKey: null,
            key: 'i-1',
            derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
          },
        ],
      ] as IssueOrRelease[][];

      const expected = [
        {
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 30,
              totalWorkingDays: 30,
              userSpecifiedValues: false,
              source: 'average',
            },
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 30,
              totalWorkingDays: 30,
              userSpecifiedValues: false,
              source: 'average',
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
              source: 'children',
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
              source: 'self',
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases);

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
    });
    it('should use default estimate if no estimates on stories or epics, and fall back to initiative estimates (with completed days of work)', () => {
      const issuesAndReleases = [
        [
          {
            parentKey: 'e-3',
            key: 's-4',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 10 },
          },
          {
            parentKey: 'e-3',
            key: 's-5',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 20 },
          },
        ],
        [
          {
            parentKey: 'i-1',
            key: 'e-3',
            derivedTiming: { totalDaysOfWork: null, completedDaysOfWork: 100 },
          },
        ],
        [
          {
            parentKey: null,
            key: 'i-1',
            derivedTiming: { totalDaysOfWork: 50, completedDaysOfWork: 20 },
          },
        ],
      ] as IssueOrRelease[][];

      const expected = [
        {
          rollupData: [
            {
              completedWorkingDays: 10,
              remainingWorkingDays: 30,
              totalWorkingDays: 40,
              userSpecifiedValues: false,
              source: 'average',
            },
            {
              completedWorkingDays: 20,
              remainingWorkingDays: 30,
              totalWorkingDays: 50,
              userSpecifiedValues: false,
              source: 'average',
            },
          ],
        },
        {
          rollupData: [
            {
              completedWorkingDays: 30,
              remainingWorkingDays: 60,
              totalWorkingDays: 90,
              userSpecifiedValues: false,
              source: 'children',
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
              source: 'self',
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases);

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
    });

    it('should prefer stories over epics and initiatives', () => {
      const issuesAndReleases = [
        [
          {
            parentKey: 'e-3',
            key: 's-6',
            derivedTiming: { totalDaysOfWork: 10, completedDaysOfWork: 0 },
          },
          {
            parentKey: 'e-3',
            key: 's-7',
            derivedTiming: { totalDaysOfWork: 20, completedDaysOfWork: 0 },
          },
        ],
        [
          {
            parentKey: 'i-1',
            key: 'e-3',
            derivedTiming: { totalDaysOfWork: 2000, completedDaysOfWork: 0 },
          },
        ],
        [
          {
            parentKey: null,
            key: 'i-1',
            derivedTiming: { totalDaysOfWork: 1, completedDaysOfWork: 0 },
          },
        ],
      ] as IssueOrRelease[][];

      const expected = [
        {
          rollupData: [
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 10,
              totalWorkingDays: 10,
              userSpecifiedValues: true,
              source: 'self',
            },
            {
              completedWorkingDays: 0,
              remainingWorkingDays: 20,
              totalWorkingDays: 20,
              userSpecifiedValues: true,
              source: 'self',
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
              source: 'children',
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
              source: 'children',
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases);

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
    });
    it('should prefer stories over epics and initiatives with completion', () => {
      const issuesAndReleases = [
        [
          {
            parentKey: 'e-3',
            key: 's-6',
            derivedTiming: { totalDaysOfWork: 12, completedDaysOfWork: 4 },
          },
          {
            parentKey: 'e-3',
            key: 's-7',
            derivedTiming: { totalDaysOfWork: 24, completedDaysOfWork: 16 },
          },
        ],
        [
          {
            parentKey: 'i-1',
            key: 'e-3',
            derivedTiming: { totalDaysOfWork: 2000, completedDaysOfWork: 100 },
          },
        ],
        [
          {
            parentKey: null,
            key: 'i-1',
            derivedTiming: { totalDaysOfWork: 50, completedDaysOfWork: 20 },
          },
        ],
      ] as IssueOrRelease[][];

      const expected = [
        {
          rollupData: [
            {
              completedWorkingDays: 4,
              remainingWorkingDays: 8,
              totalWorkingDays: 12,
              userSpecifiedValues: true,
              source: 'self',
            },
            {
              completedWorkingDays: 16,
              remainingWorkingDays: 8,
              totalWorkingDays: 24,
              userSpecifiedValues: true,
              source: 'self',
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
              source: 'children',
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
              source: 'children',
            },
          ],
        },
      ];

      const actual = rollupPercentComplete(issuesAndReleases);

      expect(actual).toHaveLength(expected.length);
      for (const i of Array(actual.length).keys()) {
        expect(actual[i].rollupData).toStrictEqual(expected[i].rollupData);
      }
    });
  });
});
