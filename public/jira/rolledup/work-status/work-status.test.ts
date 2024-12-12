import { describe, expect, it } from "vitest";
import { calculateReportStatuses, WithRollupStatus } from "./work-status";
import {
  rollupAndRollback,
  WithIssueLastPeriod,
} from "../../rolledup-and-rolledback/rollup-and-rollback";
import { WithBlockedStatuses } from "../../rollup/blocked-status-issues/blocked-status-issues";
import { WithDateRollup } from "../../rollup/dates/dates";
import { IssueOrRelease } from "../../rollup/rollup";
import { WithWarningIssues } from "../../rollup/warning-issues/warning-issues";
import { DateAndIssueKeys, WithWorkTypeRollups } from "../work-type/work-type";
import { JiraIssue } from "../../shared/types";
import { deriveIssue } from "../../derived/derive";
import { normalizeIssue } from "../../normalized/normalize";
// import { JiraIssue, NormalizedTeam, ParentIssue } from "../../shared/types";
// import { DerivedWorkTiming } from "../../derived/work-timing/work-timing";
// import { DerivedWorkStatus } from "../../derived/work-status/work-status";

type IssueOrReleaseForWorkStatus<T = unknown> = IssueOrRelease<
  WithDateRollup &
    WithWorkTypeRollups &
    WithBlockedStatuses &
    WithWarningIssues &
    WithIssueLastPeriod<WithDateRollup & WithWorkTypeRollups> &
    T
>;

describe("calculateReportStatuses", () => {
  it("should rollup children by work status", () => {
    const input = [
      {
        key: "abc-123",
        statusCategory: "done",
        issueLastPeriod: {
          rollupDates: {},
          workTypeRollups: {
            children: {
              dev: {},
            },
          },
        },
        workTypeRollups: {
          children: {
            dev: {},
          },
        },
      },
      {
        key: "abc-62272",
        issueLastPeriod: {
          rollupDates: {},
          workTypeRollups: {
            children: {
              dev: { due: new Date(2024, 1, 1) },
            },
          },
        },
        workTypeRollups: {
          children: {
            dev: { issueKeys: ["abc-68947"] },
          },
        },
      },
      {
        key: "abc-68947",
        statusCategory: "done",
        workTypeRollups: {
          children: {
            dev: {},
          },
        },
      },
    ] as IssueOrReleaseForWorkStatus[];

    const expected = [
      {
        key: "abc-123",
        statusCategory: "done",
        issueLastPeriod: {
          rollupDates: {},
          workTypeRollups: {
            children: {
              dev: {},
            },
          },
        },
        workTypeRollups: {
          children: {
            dev: {},
          },
        },
        rollupStatuses: {
          rollup: {
            lastPeriod: {},
            status: "complete",
            statusFrom: {
              message: "Own status",
            },
          },
          design: {
            issueKeys: [] as string[],
            status: "unknown",
            statusFrom: {
              message: "there is no timing data",
            },
          },
          dev: {
            lastPeriod: {},
            status: "unknown",
            statusFrom: {
              message: "there is no timing data",
            },
          },
          qa: {
            issueKeys: [] as string[],
            status: "unknown",
            statusFrom: {
              message: "there is no timing data",
            },
          },
          uat: {
            issueKeys: [] as string[],
            status: "unknown",
            statusFrom: {
              message: "there is no timing data",
            },
          },
        },
      },
      {
        issueLastPeriod: {
          rollupDates: {},
          workTypeRollups: {
            children: {
              dev: {
                due: new Date("2024-02-01T00:00:00.000Z"),
              },
            },
          },
        },
        key: "abc-62272",
        rollupStatuses: {
          design: {
            issueKeys: [],
            status: "unknown",
            statusFrom: {
              message: "there is no timing data",
            },
          },
          dev: {
            issueKeys: ["abc-68947"],
            lastPeriod: {
              due: new Date("2024-02-01T00:00:00.000Z"),
            },
            status: "complete",
            statusFrom: {
              message: "Everything is done",
            },
          },
          qa: {
            issueKeys: [],
            status: "unknown",
            statusFrom: {
              message: "there is no timing data",
            },
          },
          rollup: {
            lastPeriod: {},
            status: "complete",
            statusFrom: {
              message: "Children are all done, but the parent is not",
              warning: true,
            },
          },
          uat: {
            issueKeys: [],
            status: "unknown",
            statusFrom: {
              message: "there is no timing data",
            },
          },
        },
        workTypeRollups: {
          children: {
            dev: {
              issueKeys: ["abc-68947"],
            },
          },
        },
      },
      {
        key: "abc-68947",
        rollupStatuses: {
          design: {
            issueKeys: [],
            status: "unknown",
            statusFrom: {
              message: "there is no timing data",
            },
          },
          dev: {
            lastPeriod: null,
            status: "unknown",
            statusFrom: {
              message: "there is no timing data",
            },
          },
          qa: {
            issueKeys: [],
            status: "unknown",
            statusFrom: {
              message: "there is no timing data",
            },
          },
          rollup: {
            lastPeriod: null,
            status: "complete",
            statusFrom: {
              message: "Own status",
            },
          },
          uat: {
            issueKeys: [],
            status: "unknown",
            statusFrom: {
              message: "there is no timing data",
            },
          },
        },
        statusCategory: "done",
        workTypeRollups: {
          children: {
            dev: {},
          },
        },
      },
    ] as IssueOrReleaseForWorkStatus<WithRollupStatus>[];

    const actual = calculateReportStatuses(input);
    expect(actual).toStrictEqual(expected);
  });

  it("handles empty childKeys", () => {
    const issue = {
      key: "PLAY-5",
      expand: "operations,versionedRepresentations,editmeta,changelog,renderedFields",
      id: "10552",
      self: "https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/3/issue/10552",
      fields: {
        Summary: "Empty Epic with Timing in the Future",
        "Issue Type": {
          self: "https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/3/issuetype/10000",
          id: "10000",
          description:
            "A big user story that needs to be broken down. Created by Jira Software - do not edit or delete.",
          iconUrl: "https://bitovi-training.atlassian.net/images/icons/issuetypes/epic.svg",
          name: "Epic",
          subtask: false,
          hierarchyLevel: 1,
        },
        "Story points median": null,
        Created: "2024-12-12T11:10:55.538-0600",
        Sprint: null,
        "Fix versions": [],
        Team: null,
        "Story points": null,
        "Story points confidence": null,
        Labels: [],
        "Start date": "2025-02-09",
        Rank: "0|i001qr:",
        "Due date": "2025-03-08",
        Status: {
          self: "https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/3/status/10003",
          description: "",
          iconUrl: "https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/",
          name: "To Do",
          id: "10003",
          statusCategory: {
            self: "https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/3/statuscategory/2",
            id: 2,
            key: "new",
            colorName: "blue-gray",
            name: "To Do",
          },
        },
      },
    } as unknown as JiraIssue;

    const rolled = rollupAndRollback(
      [issue].map((normalized) => deriveIssue(normalizeIssue(normalized))),
      {},
      [{ calculation: "widestRange", hierarchyLevel: 1, type: "Epic" }],
      new Date(2024, 6, 17)
    );

    // @TODO fix types between work status and rollup
    // @ts-expect-error type mismatch
    const [status] = calculateReportStatuses(rolled);

    expect(status.rollupStatuses.rollup.status).toBe("new");
    expect(status.rollupStatuses.rollup.statusFrom).toEqual({
      message: "Unable to find this last period",
    });
  });
});
