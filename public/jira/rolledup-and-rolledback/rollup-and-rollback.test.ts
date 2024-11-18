import { describe, expect, it } from "vitest";
import { DerivedIssue } from "../derived/derive";
import { WithWorkTypeTiming } from "../rolledup/work-type/work-type";
import { IssueOrRelease } from "../rollup/rollup";
import { rollupAndRollback } from "./rollup-and-rollback";
import { RollupLevelAndCalculation } from "../shared/types";
import { NormalizeIssueConfig } from "../normalized/normalize";

describe("rollupAndRollback", () => {
  it("should work", () => {
    const issues = [] as DerivedIssue[];
    const config = {} as NormalizeIssueConfig;
    const calcs = [] as RollupLevelAndCalculation[];
    const when = new Date();

    const expected = [] as IssueOrRelease<{
      issueLastPeriod: IssueOrRelease<WithWorkTypeTiming>[] | undefined;
    }>[];

    const actual = rollupAndRollback(issues, config, calcs, when);

    expect(actual).toStrictEqual(expected);
  });

  it("should rollup issues", () => {
    // const parent = {
    //   key: "test-parent",
    //   id: "23",
    //   fields: {
    //     summary: "parent summary",
    //     issuetype: { name: "bug", hierarchyLevel: 8 },
    //     status: { name: "in progress" },
    //   },
    // };
    // const issues = [
    //   {
    //     key: "i-1",
    //     type: "issue",
    //     summary: "",
    //     parentKey: null,
    //     confidence: 1,
    //     dueDate: new Date(),
    //     startDate: new Date(),
    //     hierarchyLevel: 0,
    //     storyPoints: 21,
    //     storyPointsMedian: 21,
    //     team: {
    //       name: "",
    //       velocity: 100,
    //       daysPerSprint: 10,
    //       parallelWorkLimit: 3,
    //       totalPointsPerDay: 10,
    //       pointsPerDayPerTrack: 3,
    //       spreadEffortAcrossDates: true,
    //     },
    //     url: "",
    //     sprints: [],
    //     status: "",
    //     statusCategory: "",
    //     labels: [],
    //     releases: [],
    //     rank: "",
    //     derivedTiming: {
    //       isConfidenceValid: true,
    //       usedConfidence: 1,
    //       isStoryPointsValid: true,
    //       defaultOrStoryPoints: 1,
    //       storyPointsDaysOfWork: 1,
    //       isStoryPointsMedianValid: true,
    //       defaultOrStoryPointsMedian: 1,
    //       storyPointsMedianDaysOfWork: 1,
    //       deterministicExtraPoints: 1,
    //       deterministicExtraDaysOfWork: 1,
    //       deterministicTotalPoints: 1,
    //       deterministicTotalDaysOfWork: 1,
    //       probablisticExtraPoints: 1,
    //       probablisticExtraDaysOfWork: 1,
    //       probablisticTotalPoints: 1,
    //       probablisticTotalDaysOfWork: 1,
    //       hasStartAndDueDate: true,
    //       startAndDueDateDaysOfWork: 1,
    //       hasSprintStartAndEndDate: true,
    //       sprintDaysOfWork: 1,
    //       sprintStartData: {
    //         start: new Date(),
    //         startFrom: {
    //           message: "",
    //           reference:{}
    //         },
    //       },
    //       endSprintData: { due, dueTo },
    //       totalDaysOfWork: 1,
    //       defaultOrTotalDaysOfWork: 1,
    //       completedDaysOfWork: 1,
    //       datesDaysOfWork: 1,
    //     },
    //     derivedStatus: { statusType, workType },
    //     issue: {
    //       id: "1",
    //       key: "test-key",
    //       fields: {
    //         Team: null,
    //         Parent: parent,
    //         Summary: "language packs",
    //         "Issue Type": { hierarchyLevel: 1, name: "Epic" },
    //         Created: "2023-02-03T10:58:38.994-0600",
    //         Sprint: null,
    //         "Fix versions": [
    //           {
    //             id: "10006",
    //             name: "SHARE_R1",
    //             archived: false,
    //             description: "description",
    //             released: false,
    //             self: "self-string",
    //           },
    //         ],
    //         "Epic Link": null,
    //         Labels: ["JTR-Testing"],
    //         "Start date": "20220715",
    //         "Parent Link": { data: { key: "IMP-5" } },
    //         Rank: "0|hzzzzn:",
    //         "Due date": "20220716",
    //         Status: { id: "1", name: "Done", statusCategory: { name: "Done" } },
    //         "Project key": "ORDER",
    //         "Issue key": "ORDER-15",
    //         url: "https://bitovi-training.atlassian.net/browse/ORDER-15",
    //         workType: "dev",
    //         workingBusinessDays: 27,
    //         weightedEstimate: null,
    //       },
    //     },
    //   },
    // ] as DerivedIssue[];

    const issues = [] as DerivedIssue[];
    const config = {} as NormalizeIssueConfig;
    const calcs = [] as RollupLevelAndCalculation[];
    const when = new Date();

    const expected = [] as IssueOrRelease<{
      issueLastPeriod: IssueOrRelease<WithWorkTypeTiming>[] | undefined;
    }>[];

    const actual = rollupAndRollback(issues, config, calcs, when);

    expect(actual).toStrictEqual(expected);
  });
});
