// sum.test.js
import { expect, test, describe, it } from "vitest";
import {
  rollupBlockedIssuesForGroupedHierarchy,
  rollupBlockedStatusIssues,
} from "./blocked-status-issues";
import { IssueOrRelease } from "../rollup";

describe("rollupBlockedIssuesForGroupedHierarchy", () => {
  // due, dueTo {message, reference} .... {start,startFrom}
  // alt: {start, end, startedFrom, endedBy}

  it("does the basics", () => {
    let i7;

    const issuesAndReleases = (
      [
        [
          {
            key: "o-1",
            parentKey: null,
            derivedStatus: { statusType: "dev", workType: "dev" },
          },
        ],
        [
          {
            key: "m-2",
            parentKey: "o-1",
            derivedStatus: { statusType: "dev", workType: "dev" },
          },
          {
            key: "m-3",
            parentKey: "o-1",
            derivedStatus: { statusType: "dev", workType: "dev" },
          },
        ],
        [
          {
            key: "i-4",
            parentKey: "m-2",
            derivedStatus: { statusType: "dev", workType: "dev" },
          },
          {
            key: "i-5",
            parentKey: "m-2",
            derivedStatus: { statusType: "dev", workType: "dev" },
          },
          {
            key: "i-6",
            parentKey: "m-3",
            derivedStatus: { statusType: "dev", workType: "dev" },
          },
          (i7 = {
            key: "i-7",
            parentKey: "m-3",
            derivedStatus: { statusType: "blocked", workType: "dev" },
          }),
        ],
      ] as IssueOrRelease[][]
    ).reverse();

    const results = rollupBlockedIssuesForGroupedHierarchy(issuesAndReleases);
    expect(results).toStrictEqual([
      {
        rollupData: [
          [],
          [],
          [],
          [
            {
              ...i7,
              reportingHierarchy: {
                childKeys: [],
                parentKeys: ["m-3"],
                depth: 2,
              },
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
              reportingHierarchy: {
                childKeys: [],
                parentKeys: ["m-3"],
                depth: 2,
              },
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
              reportingHierarchy: {
                childKeys: [],
                parentKeys: ["m-3"],
                depth: 2,
              },
            },
          ],
        ],
        metadata: {},
      },
    ]);
  });
});
describe("rollupBlockedStatusIssues", () => {
  it("should correctly roll up blocked status issues", () => {
    const i7 = {
      key: "i-7",
      type: "Epic",
      hierarchyLevel: 2,
      parentKey: "m-3",
      derivedStatus: { statusType: "blocked", workType: "dev" },
    };

    const issuesAndReleases = [
      {
        key: "o-1",
        type: "Release",
        hierarchyLevel: null,
        parentKey: null,
        derivedStatus: { statusType: "dev", workType: "dev" },
      },
      {
        key: "m-2",
        type: "Initiative",
        hierarchyLevel: 1,
        parentKey: "o-1",
        derivedStatus: { statusType: "dev", workType: "dev" },
      },
      {
        key: "m-3",
        type: "Initiative",
        hierarchyLevel: 1,
        parentKey: "o-1",
        derivedStatus: { statusType: "dev", workType: "dev" },
      },
      {
        key: "i-4",
        type: "Epic",
        hierarchyLevel: 2,
        parentKey: "m-2",
        derivedStatus: { statusType: "dev", workType: "dev" },
      },
      {
        key: "i-5",
        type: "Epic",
        hierarchyLevel: 2,
        parentKey: "m-2",
        derivedStatus: { statusType: "dev", workType: "dev" },
      },
      {
        key: "i-6",
        type: "Epic",
        hierarchyLevel: 2,
        parentKey: "m-3",
        derivedStatus: { statusType: "dev", workType: "dev" },
      },
      i7,
    ] as IssueOrRelease<{ blockedStatusIssues: IssueOrRelease[] }>[];

    const rollupTimingLevelsAndCalculations = [
      { type: "Release" },
      { type: "Initiative", hierarchyLevel: 1 },
      { type: "Epic", hierarchyLevel: 2 },
    ];

    const result = rollupBlockedStatusIssues(
      issuesAndReleases,
      rollupTimingLevelsAndCalculations
    );
    const issueMap = result.reduce((map, issue) => {
      map[issue.key] = issue;
      return map;
    }, {} as { [key: string]: IssueOrRelease<{ blockedStatusIssues: IssueOrRelease[] }> });

    const o1 = issueMap["o-1"];
    const m2 = issueMap["m-2"];
    const m3 = issueMap["m-3"];
    const i4 = issueMap["i-4"];
    const i5 = issueMap["i-5"];
    const i6 = issueMap["i-6"];
    const _i7 = issueMap["i-7"];

    const blockedStatusIssues = [
      {
        ...i7,
        reportingHierarchy: {
          childKeys: [],
          depth: 2,
          parentKeys: ["m-3"],
        },
      },
    ];
    expect(i4?.blockedStatusIssues).toEqual([]);
    expect(i5?.blockedStatusIssues).toEqual([]);
    expect(i6?.blockedStatusIssues).toEqual([]);
    expect(_i7?.blockedStatusIssues).toEqual(blockedStatusIssues);

    expect(m2?.blockedStatusIssues).toEqual([]);
    expect(m3?.blockedStatusIssues).toEqual(blockedStatusIssues);

    expect(o1?.blockedStatusIssues).toEqual(blockedStatusIssues);
  });
});
