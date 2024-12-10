import { describe, expect, it } from "vitest";
import { calculateReportStatuses, WithRollupStatus } from "./work-status";
import { WithIssueLastPeriod } from "../../rolledup-and-rolledback/rollup-and-rollback";
import { WithBlockedStatuses } from "../../rollup/blocked-status-issues/blocked-status-issues";
import { WithDateRollup } from "../../rollup/dates/dates";
import { IssueOrRelease } from "../../rollup/rollup";
import { WithWarningIssues } from "../../rollup/warning-issues/warning-issues";
import { DateAndIssueKeys, WithWorkTypeRollups } from "../work-type/work-type";
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
});
