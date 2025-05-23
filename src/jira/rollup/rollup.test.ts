// sum.test.js
import { expect, test } from 'vitest';
import { IssueOrRelease, addChildrenFromGroupedHierarchy, rollupGroupedHierarchy, sum } from './rollup';

test('addChildrenFromGroupedHierarchy', () => {
  const groupedHierarchy = [
    [{ key: 'SPECIAL:release-123' }],
    [
      {
        key: 'm-2',
        parentKey: 'o-1',
        releases: [{ key: 'SPECIAL:release-123' }],
      },
      { key: 'm-3', parentKey: 'o-1' },
    ],
    [
      {
        key: 'i-4',
        parentKey: 'm-2',
        releases: [{ key: 'SPECIAL:release-123' }],
      },
      { key: 'i-5', parentKey: 'm-2' },
      { key: 'i-6', parentKey: 'm-3' },
      { key: 'i-7', parentKey: 'm-3' },
    ],
  ] as IssueOrRelease[][];

  const results = addChildrenFromGroupedHierarchy(groupedHierarchy.reverse()).reverse();

  expect(results).toStrictEqual([
    [
      {
        key: 'SPECIAL:release-123',
        reportingHierarchy: { childKeys: ['m-2'], parentKeys: [], depth: 0 },
      },
    ],
    [
      {
        key: 'm-2',
        parentKey: 'o-1',
        releases: [{ key: 'SPECIAL:release-123' }],
        reportingHierarchy: {
          childKeys: ['i-4', 'i-5'],
          parentKeys: ['SPECIAL:release-123'],
          depth: 1,
        },
      },
      {
        key: 'm-3',
        parentKey: 'o-1',
        reportingHierarchy: {
          childKeys: ['i-6', 'i-7'],
          parentKeys: [],
          depth: 1,
        },
      },
    ],
    [
      {
        key: 'i-4',
        parentKey: 'm-2',
        releases: [{ key: 'SPECIAL:release-123' }],
        reportingHierarchy: { childKeys: [], parentKeys: ['m-2'], depth: 2 },
      },
      {
        key: 'i-5',
        parentKey: 'm-2',
        reportingHierarchy: { childKeys: [], parentKeys: ['m-2'], depth: 2 },
      },
      {
        key: 'i-6',
        parentKey: 'm-3',
        reportingHierarchy: { childKeys: [], parentKeys: ['m-3'], depth: 2 },
      },
      {
        key: 'i-7',
        parentKey: 'm-3',
        reportingHierarchy: { childKeys: [], parentKeys: ['m-3'], depth: 2 },
      },
    ],
  ]);
});

test('rollupGroupedHierarchy', () => {
  const groupedHierarchy = [
    [{ key: 'o-1', parentKey: null, myValue: 0.5 }],
    [
      { key: 'm-2', parentKey: 'o-1', myValue: 1 },
      { key: 'm-3', parentKey: 'o-1', myValue: 2 },
    ],
    [
      { key: 'i-4', parentKey: 'm-2', myValue: 4 },
      { key: 'i-5', parentKey: 'm-2', myValue: 8 },
      { key: 'i-6', parentKey: 'm-3', myValue: 16 },
      { key: 'i-7', parentKey: 'm-3', myValue: 32 },
    ],
  ] as IssueOrRelease<{ myValue: number }>[][];

  const results = rollupGroupedHierarchy(groupedHierarchy.reverse(), {
    createMetadataForHierarchyLevel(hierarchyLevel, issues) {
      const totalMyValue = issues.reduce((sum, issue) => sum + issue.myValue, 0);
      const itemCount = issues.length;
      return { hierarchyLevel, totalMyValue, itemCount };
    },
    createRollupDataFromParentAndChild(parent, childrenRollupValues: { sumValue: number }[]) {
      const childrenValue = childrenRollupValues.length ? sum(childrenRollupValues.map((child) => child.sumValue)) : 0;

      const parentValue = parent.myValue;
      return { sumValue: parentValue + childrenValue };
    },
  });
  expect(results).toStrictEqual([
    {
      rollupData: [{ sumValue: 4 }, { sumValue: 8 }, { sumValue: 16 }, { sumValue: 32 }],
      metadata: { hierarchyLevel: 0, itemCount: 4, totalMyValue: 60 },
    },
    {
      rollupData: [{ sumValue: 13 }, { sumValue: 50 }],
      metadata: { hierarchyLevel: 1, itemCount: 2, totalMyValue: 3 },
    },
    {
      rollupData: [{ sumValue: 63.5 }],
      metadata: { hierarchyLevel: 2, itemCount: 1, totalMyValue: 0.5 },
    },
  ]);
});
