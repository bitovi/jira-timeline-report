import { expect, describe, it } from "vitest";
import {
  rollupChildStatusesForGroupedHierarchy,
  rollupChildStatuses,
  ChildStatuses,
} from "./child-statuses";
import { IssueOrRelease } from "../rollup";

describe("rollupChildStatusesForGroupedHierarchy", () => {
  it("should correctly roll up child statuses in grouped hierarchy", () => {
    const groupedHierarchy = (
      [
        [
          {
            key: "o-1",
            parentKey: null,
            status: "In Progress",
          },
        ],
        [
          {
            key: "m-2",
            parentKey: "o-1",
            status: "In Progress",
          },
          {
            key: "m-3",
            parentKey: "o-1",
            status: "In Progress",
          },
        ],
        [
          {
            key: "i-4",
            parentKey: "m-2",
            status: "Done",
          },
          {
            key: "i-5",
            parentKey: "m-2",
            status: "Done",
          },
          {
            key: "i-6",
            parentKey: "m-3",
            status: "In Progress",
          },
          {
            key: "i-7",
            parentKey: "m-3",
            status: "Blocked",
          },
        ],
      ] as IssueOrRelease[][]
    ).reverse();

    const results = rollupChildStatusesForGroupedHierarchy(groupedHierarchy);

    expect(results).toHaveLength(3);

    const level0RollupData = results[0].rollupData;
    expect(level0RollupData).toEqual([
      {
        self: { key: "i-4", status: "Done" },
        children: [],
      },
      {
        self: { key: "i-5", status: "Done" },
        children: [],
      },
      {
        self: { key: "i-6", status: "In Progress" },
        children: [],
      },
      {
        self: { key: "i-7", status: "Blocked" },
        children: [],
      },
    ]);

    const level1RollupData = results[1].rollupData;
    expect(level1RollupData).toEqual([
      {
        self: { key: "m-2", status: "In Progress" },
        children: [
          { key: "i-4", status: "Done" },
          { key: "i-5", status: "Done" },
        ],
      },
      {
        self: { key: "m-3", status: "In Progress" },
        children: [
          { key: "i-6", status: "In Progress" },
          { key: "i-7", status: "Blocked" },
        ],
      },
    ]);

    const level2RollupData = results[2].rollupData;
    expect(level2RollupData).toEqual([
      {
        self: { key: "o-1", status: "In Progress" },
        children: [
          { key: "m-2", status: "In Progress" },
          { key: "m-3", status: "In Progress" },
        ],
      },
    ]);
  });
});

describe("rollupChildStatuses", () => {
  it("should correctly roll up child statuses", () => {
    const issuesAndReleases = [
      {
        key: "o-1",
        type: "Initiative",
        hierarchyLevel: 2,
        parentKey: null,
        status: "In Progress",
      },
      {
        key: "m-2",
        type: "Epic",
        hierarchyLevel: 1,
        parentKey: "o-1",
        status: "In Progress",
      },
      {
        key: "m-3",
        type: "Epic",
        hierarchyLevel: 1,
        parentKey: "o-1",
        status: "In Progress",
      },
      {
        key: "i-4",
        type: "Story",
        hierarchyLevel: 0,
        parentKey: "m-2",
        status: "Done",
      },
      {
        key: "i-5",
        type: "Story",
        hierarchyLevel: 0,
        parentKey: "m-2",
        status: "Done",
      },
      {
        key: "i-6",
        type: "Story",
        hierarchyLevel: 0,
        parentKey: "m-3",
        status: "In Progress",
      },
      {
        key: "i-7",
        type: "Story",
        hierarchyLevel: 0,
        parentKey: "m-3",
        status: "Blocked",
      },
    ] as IssueOrRelease<{ childStatuses: ChildStatuses }>[];

    const rollupTimingLevelsAndCalculations = [
      { type: "Initiative", hierarchyLevel: 2 },
      { type: "Epic", hierarchyLevel: 1 },
      { type: "Story", hierarchyLevel: 0 },
    ];

    const result = rollupChildStatuses(
      issuesAndReleases,
      rollupTimingLevelsAndCalculations
    );

    const issueMap = result.reduce((map, issue) => {
      map[issue.key] = issue;
      return map;
    }, {} as { [key: string]: IssueOrRelease<{ childStatuses: ChildStatuses }> });

    const o1 = issueMap["o-1"];
    const m2 = issueMap["m-2"];
    const m3 = issueMap["m-3"];
    const i4 = issueMap["i-4"];
    const i5 = issueMap["i-5"];
    const i6 = issueMap["i-6"];
    const i7 = issueMap["i-7"];

    expect(i4.childStatuses).toEqual({
      self: { key: "i-4", status: "Done" },
      children: [],
    });
    expect(i5.childStatuses).toEqual({
      self: { key: "i-5", status: "Done" },
      children: [],
    });
    expect(i6.childStatuses).toEqual({
      self: { key: "i-6", status: "In Progress" },
      children: [],
    });
    expect(i7.childStatuses).toEqual({
      self: { key: "i-7", status: "Blocked" },
      children: [],
    });

    expect(m2.childStatuses).toEqual({
      self: { key: "m-2", status: "In Progress" },
      children: [
        { key: "i-4", status: "Done" },
        { key: "i-5", status: "Done" },
      ],
    });
    expect(m3.childStatuses).toEqual({
      self: { key: "m-3", status: "In Progress" },
      children: [
        { key: "i-6", status: "In Progress" },
        { key: "i-7", status: "Blocked" },
      ],
    });

    expect(o1.childStatuses).toEqual({
      self: { key: "o-1", status: "In Progress" },
      children: [
        { key: "m-2", status: "In Progress" },
        { key: "m-3", status: "In Progress" },
      ],
    });
  });
});
