import { expect, describe, it } from 'vitest';
import { rollupWarningIssuesForGroupedHierarchy, rollupWarningIssues, WithWarningIssues } from './warning-issues';
import { IssueOrRelease } from '../rollup';

describe('rollupWarningIssuesForGroupedHierarchy', () => {
  it('should correctly roll up warning issues in grouped hierarchy', () => {
    const i7 = {
      key: 'i-7',
      parentKey: 'm-3',
      labels: ['Warning'],
    };
    const groupedHierarchy = (
      [
        [
          {
            key: 'o-1',
            parentKey: null,
            labels: ['foo'],
          },
        ],
        [
          {
            key: 'm-2',
            parentKey: 'o-1',
            labels: ['foo'],
          },
          {
            key: 'm-3',
            parentKey: 'o-1',
            labels: ['foo'],
          },
        ],
        [
          {
            key: 'i-4',
            parentKey: 'm-2',
            labels: ['foo'],
          },
          {
            key: 'i-5',
            parentKey: 'm-2',
            labels: ['foo'],
          },
          {
            key: 'i-6',
            parentKey: 'm-3',
            labels: ['foo'],
          },
          i7,
        ],
      ] as IssueOrRelease[][]
    ).reverse();

    const i7ReportingHierarchy = {
      reportingHierarchy: {
        childKeys: [],
        depth: 2,
        parentKeys: ['m-3'],
      },
    };

    const results = rollupWarningIssuesForGroupedHierarchy(groupedHierarchy);

    expect(results).toHaveLength(3);
    expect(results).toStrictEqual([
      {
        rollupData: [
          [],
          [],
          [],
          [
            {
              ...i7,
              ...i7ReportingHierarchy,
            },
          ],
        ],
        metadata: {},
      },
      {
        rollupData: [
          [],
          [
            {
              ...i7,
              ...i7ReportingHierarchy,
            },
          ],
        ],
        metadata: {},
      },
      {
        rollupData: [
          [
            {
              ...i7,
              ...i7ReportingHierarchy,
            },
          ],
        ],
        metadata: {},
      },
    ]);
  });
});

describe('rollupWarningIssues', () => {
  it('should correctly roll up warning issues', () => {
    const i7 = {
      key: 'i-7',
      type: 'Story',
      hierarchyLevel: 0,
      parentKey: 'm-3',
      labels: ['Warning'],
    };

    const i8 = {
      key: 'i-8',
      type: 'Story',
      hierarchyLevel: 0,
      parentKey: 'm-3',
      labels: ['Warning'],
    };

    const issuesAndReleases = [
      {
        key: 'o-1',
        type: 'Initiative',
        hierarchyLevel: 2,
        parentKey: null,
        labels: ['foo'],
      },
      {
        key: 'm-2',
        type: 'Epic',
        hierarchyLevel: 1,
        parentKey: 'o-1',
        labels: ['foo'],
      },
      {
        key: 'm-3',
        type: 'Epic',
        hierarchyLevel: 1,
        parentKey: 'o-1',
        labels: ['foo'],
      },
      {
        key: 'i-4',
        type: 'Story',
        hierarchyLevel: 0,
        parentKey: 'm-2',
        labels: ['foo'],
      },
      {
        key: 'i-5',
        type: 'Story',
        hierarchyLevel: 0,
        parentKey: 'm-2',
        labels: ['foo'],
      },
      {
        key: 'i-6',
        type: 'Story',
        hierarchyLevel: 0,
        parentKey: 'm-3',
        labels: ['foo'],
      },
      i7,
      i8,
    ] as IssueOrRelease[];

    const rollupTimingLevelsAndCalculations = [
      { type: 'Initiative', hierarchyLevel: 2 },
      { type: 'Epic', hierarchyLevel: 1 },
      { type: 'Story', hierarchyLevel: 0 },
    ];
    const result = rollupWarningIssues(issuesAndReleases, rollupTimingLevelsAndCalculations);

    const issueMap = result.reduce(
      (map, issue) => {
        map[issue.key] = issue;
        return map;
      },
      {} as { [key: string]: IssueOrRelease<WithWarningIssues> },
    );

    const o1 = issueMap['o-1'];
    const m2 = issueMap['m-2'];
    const m3 = issueMap['m-3'];
    const i4 = issueMap['i-4'];
    const i5 = issueMap['i-5'];
    const i6 = issueMap['i-6'];
    const _i7 = issueMap['i-7'];
    const _i8 = issueMap['i-8'];

    const i7WarningIssues = [
      {
        ...i7,
        reportingHierarchy: {
          childKeys: [],
          depth: 2,
          parentKeys: ['m-3'],
        },
      },
    ];
    const i8WarningIssues = [
      {
        ...i8,
        reportingHierarchy: {
          childKeys: [],
          depth: 2,
          parentKeys: ['m-3'],
        },
      },
    ];
    expect(i4?.warningIssues).toEqual([]);
    expect(i5?.warningIssues).toEqual([]);
    expect(i6?.warningIssues).toEqual([]);
    expect(_i7?.warningIssues).toEqual(i7WarningIssues);
    expect(_i8?.warningIssues).toEqual(i8WarningIssues);

    expect(m2?.warningIssues).toEqual([]);
    expect(m3?.warningIssues).toEqual([...i7WarningIssues, ...i8WarningIssues]);

    expect(o1?.warningIssues).toEqual([...i7WarningIssues, ...i8WarningIssues]);
  });
});
