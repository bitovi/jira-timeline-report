import { describe, expect, it } from 'vitest';
import { calculateReportStatuses, calculateNewlyFlags, WithRollupStatus } from './work-status';
import { rollupAndRollback, WithIssueLastPeriod } from '../../rolledup-and-rolledback/rollup-and-rollback';
import { WithBlockedStatuses } from '../../rollup/blocked-status-issues/blocked-status-issues';
import { WithDateRollup } from '../../rollup/dates/dates';
import { IssueOrRelease } from '../../rollup/rollup';
import { WithWarningIssues } from '../../rollup/warning-issues/warning-issues';
import { DateAndIssueKeys, WithWorkTypeRollups } from '../work-type/work-type';
import { JiraIssue } from '../../shared/types';
import { deriveIssue } from '../../derived/derive';
import { normalizeIssue } from '../../normalized/normalize';
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

describe('calculateReportStatuses', () => {
  it('should rollup children by work status', () => {
    const input = [
      {
        key: 'abc-123',
        statusCategory: 'Done',
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
        key: 'abc-62272',
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
            dev: { issueKeys: ['abc-68947'] },
          },
        },
      },
      {
        key: 'abc-68947',
        statusCategory: 'Done',
        workTypeRollups: {
          children: {
            dev: {},
          },
        },
      },
    ] as IssueOrReleaseForWorkStatus[];

    const expected = [
      {
        key: 'abc-123',
        statusCategory: 'Done',
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
            status: 'complete',
            statusFrom: {
              message: 'Own status',
            },
            newlyStarted: false,
            newlyCompleted: false,
            newlyDated: false,
          },
          design: {
            issueKeys: [] as string[],
            status: 'unknown',
            statusFrom: {
              message: 'there is no timing data',
            },
          },
          dev: {
            lastPeriod: {},
            status: 'unknown',
            statusFrom: {
              message: 'there is no timing data',
            },
          },
          qa: {
            issueKeys: [] as string[],
            status: 'unknown',
            statusFrom: {
              message: 'there is no timing data',
            },
          },
          uat: {
            issueKeys: [] as string[],
            status: 'unknown',
            statusFrom: {
              message: 'there is no timing data',
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
                due: new Date('2024-02-01T00:00:00.000Z'),
              },
            },
          },
        },
        key: 'abc-62272',
        rollupStatuses: {
          design: {
            issueKeys: [],
            status: 'unknown',
            statusFrom: {
              message: 'there is no timing data',
            },
          },
          dev: {
            issueKeys: ['abc-68947'],
            lastPeriod: {
              due: new Date('2024-02-01T00:00:00.000Z'),
            },
            status: 'complete',
            statusFrom: {
              message: 'Everything is done',
            },
          },
          qa: {
            issueKeys: [],
            status: 'unknown',
            statusFrom: {
              message: 'there is no timing data',
            },
          },
          rollup: {
            lastPeriod: {},
            status: 'complete',
            statusFrom: {
              message: 'Children are all done, but the parent is not',
              warning: true,
            },
            newlyStarted: false,
            newlyCompleted: false,
            newlyDated: false,
          },
          uat: {
            issueKeys: [],
            status: 'unknown',
            statusFrom: {
              message: 'there is no timing data',
            },
          },
        },
        workTypeRollups: {
          children: {
            dev: {
              issueKeys: ['abc-68947'],
            },
          },
        },
      },
      {
        key: 'abc-68947',
        rollupStatuses: {
          design: {
            issueKeys: [],
            status: 'unknown',
            statusFrom: {
              message: 'there is no timing data',
            },
          },
          dev: {
            lastPeriod: null,
            status: 'unknown',
            statusFrom: {
              message: 'there is no timing data',
            },
          },
          qa: {
            issueKeys: [],
            status: 'unknown',
            statusFrom: {
              message: 'there is no timing data',
            },
          },
          rollup: {
            lastPeriod: null,
            status: 'complete',
            statusFrom: {
              message: 'Own status',
            },
            newlyStarted: false,
            newlyCompleted: false,
            newlyDated: false,
          },
          uat: {
            issueKeys: [],
            status: 'unknown',
            statusFrom: {
              message: 'there is no timing data',
            },
          },
        },
        statusCategory: 'Done',
        workTypeRollups: {
          children: {
            dev: {},
          },
        },
      },
    ] as IssueOrReleaseForWorkStatus<WithRollupStatus>[];

    const actual = calculateReportStatuses(input, new Date(2024, 0, 1));
    expect(actual).toStrictEqual(expected);
  });

  // tests fix for https://bitovi.atlassian.net/browse/TR-149
  it('handles new epic with empty childKeys', () => {
    const issue = {
      key: 'PLAY-5',
      expand: 'operations,versionedRepresentations,editmeta,changelog,renderedFields',
      id: '10552',
      self: 'https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/3/issue/10552',
      fields: {
        Summary: 'Empty Epic with Timing in the Future',
        'Issue Type': {
          self: 'https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/3/issuetype/10000',
          id: '10000',
          description:
            'A big user story that needs to be broken down. Created by Jira Software - do not edit or delete.',
          iconUrl: 'https://bitovi-training.atlassian.net/images/icons/issuetypes/epic.svg',
          name: 'Epic',
          subtask: false,
          hierarchyLevel: 1,
        },
        'Story points median': null,
        Created: '2024-12-12T11:10:55.538-0600',
        Sprint: null,
        'Fix versions': [],
        Team: null,
        'Story points': null,
        'Story points confidence': null,
        Labels: [],
        'Start date': '2125-02-09',
        Rank: '0|i001qr:',
        'Due date': '2125-03-08',
        Status: {
          self: 'https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/3/status/10003',
          description: '',
          iconUrl: 'https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/',
          name: 'To Do',
          id: '10003',
          statusCategory: {
            self: 'https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/3/statuscategory/2',
            id: 2,
            key: 'new',
            colorName: 'blue-gray',
            name: 'To Do',
          },
        },
      },
    } as unknown as JiraIssue;

    const rolled = rollupAndRollback(
      [issue].map((normalized) => deriveIssue(normalizeIssue(normalized))),
      {},
      [{ calculation: 'widestRange', hierarchyLevel: 1, type: 'Epic' }],
      new Date(2024, 6, 17),
    );

    // @TODO fix types between work status and rollup
    // @ts-expect-error type mismatch
    const [status] = calculateReportStatuses(rolled, new Date(2024, 6, 17));

    expect(status.rollupStatuses.rollup.status).toBe('new');
    expect(status.rollupStatuses.rollup.statusFrom).toEqual({
      message: 'Unable to find this last period',
    });
  });

  it("falls back to the issue's own (self) work type when it has no child work-type breakdown", () => {
    const start = new Date('2024-02-01T00:00:00.000Z');
    const due = new Date('2024-03-01T00:00:00.000Z');
    const input = [
      {
        key: 'qa-epic',
        workTypeRollups: {
          self: {
            qa: { start, due, issueKeys: ['qa-epic'] },
          },
          combined: {
            qa: { start, due, issueKeys: ['qa-epic'] },
          },
          children: {},
        },
      },
    ] as IssueOrReleaseForWorkStatus[];

    const [status] = calculateReportStatuses(input, new Date(2024, 0, 1));

    // The self work type (qa) is used ...
    expect(status.rollupStatuses.qa.issueKeys).toEqual(['qa-epic']);
    expect(status.rollupStatuses.qa.start).toEqual(start);
    expect(status.rollupStatuses.qa.due).toEqual(due);
    // ... and every other lane stays empty so it renders a single bar in the qa slot.
    expect(status.rollupStatuses.design.issueKeys).toEqual([]);
    expect(status.rollupStatuses.dev.issueKeys).toEqual([]);
    expect(status.rollupStatuses.uat.issueKeys).toEqual([]);
  });

  it('ignores the self work type when child work-type breakdown exists', () => {
    const start = new Date('2024-02-01T00:00:00.000Z');
    const due = new Date('2024-03-01T00:00:00.000Z');
    const input = [
      {
        key: 'epic',
        workTypeRollups: {
          self: {
            qa: { start, due, issueKeys: ['epic'] },
          },
          combined: {},
          children: {
            dev: { start, due, issueKeys: ['child-1'] },
          },
        },
      },
    ] as IssueOrReleaseForWorkStatus[];

    const [status] = calculateReportStatuses(input, new Date(2024, 0, 1));

    // The child dev breakdown wins ...
    expect(status.rollupStatuses.dev.issueKeys).toEqual(['child-1']);
    // ... and the self qa fallback is NOT applied.
    expect(status.rollupStatuses.qa.issueKeys).toEqual([]);
  });

  it('uses the self last period (not the empty children last period) for a self-fallback bar', () => {
    // A future due date so `timedStatus` compares last period rather than short-circuiting.
    const due = new Date(new Date().getFullYear() + 1, 0, 15);
    const lastPeriodDue = new Date(new Date().getFullYear() + 1, 0, 1);
    const input = [
      {
        key: 'qa-epic',
        issueLastPeriod: {
          rollupDates: {},
          workTypeRollups: {
            self: {
              qa: { due: lastPeriodDue, issueKeys: ['qa-epic'] },
            },
            children: {},
          },
        },
        workTypeRollups: {
          self: {
            qa: { due, issueKeys: ['qa-epic'] },
          },
          combined: {},
          children: {},
        },
      },
    ] as IssueOrReleaseForWorkStatus[];

    const [status] = calculateReportStatuses(input, new Date(2024, 0, 1));

    // Because the self last period is now wired up, the bar has prior timing to compare against
    // (due slipped later than last period) → 'behind', NOT the "no last period" 'new' status.
    expect(status.rollupStatuses.qa.status).toBe('behind');
    expect(status.rollupStatuses.qa.lastPeriod).toEqual({ due: lastPeriodDue, issueKeys: ['qa-epic'] });
  });
});

describe('calculateNewlyFlags', () => {
  const today = new Date(2024, 5, 15); // June 15, 2024
  const when = new Date(2024, 5, 1); // June 1, 2024 (Compare-to period)

  it('newly started: has a start date on/before today, but had none as of `when`', () => {
    // lastPeriod has a due date (so it's not "no dates at all") but no start — isolates
    // newlyStarted from newlyDated.
    const flags = calculateNewlyFlags(
      { start: new Date(2024, 5, 10) },
      { start: null, due: new Date(2024, 6, 1) },
      when,
      today,
    );
    expect(flags).toEqual({ newlyStarted: true, newlyCompleted: false, newlyDated: false });
  });

  it("newly started: had a start date as of `when`, but hadn't arrived yet", () => {
    const flags = calculateNewlyFlags({ start: new Date(2024, 5, 10) }, { start: new Date(2024, 5, 20) }, when, today);
    expect(flags).toEqual({ newlyStarted: true, newlyCompleted: false, newlyDated: false });
  });

  it('not newly started when it had already started as of `when`', () => {
    const flags = calculateNewlyFlags({ start: new Date(2024, 5, 10) }, { start: new Date(2024, 4, 1) }, when, today);
    expect(flags.newlyStarted).toBe(false);
  });

  it('newly completed: has a due date on/before today, but it had not passed as of `when`', () => {
    const flags = calculateNewlyFlags({ due: new Date(2024, 5, 10) }, { due: new Date(2024, 5, 20) }, when, today);
    expect(flags).toEqual({ newlyStarted: false, newlyCompleted: true, newlyDated: false });
  });

  it('not newly completed when the due date had already passed as of `when`', () => {
    const flags = calculateNewlyFlags({ due: new Date(2024, 5, 10) }, { due: new Date(2024, 4, 20) }, when, today);
    expect(flags.newlyCompleted).toBe(false);
  });

  it('newly dated: had no start/due at all as of `when`, but has one now', () => {
    const flags = calculateNewlyFlags({ start: new Date(2024, 5, 10) }, { start: null, due: null }, when, today);
    expect(flags).toEqual({ newlyStarted: true, newlyCompleted: false, newlyDated: true });
  });

  it('not newly dated when it already had a date as of `when`', () => {
    const flags = calculateNewlyFlags(
      { start: new Date(2024, 5, 10), due: new Date(2024, 6, 1) },
      { start: new Date(2024, 4, 1) },
      when,
      today,
    );
    expect(flags.newlyDated).toBe(false);
  });

  it('no prior period (issueLastPeriod missing) → all three false, fail-closed', () => {
    const flags = calculateNewlyFlags({ start: new Date(2024, 5, 10) }, null, when, today);
    expect(flags).toEqual({ newlyStarted: false, newlyCompleted: false, newlyDated: false });
  });

  it('none of the three when dates are identical at both points in time', () => {
    const start = new Date(2024, 4, 1);
    const due = new Date(2024, 6, 1);
    const flags = calculateNewlyFlags({ start, due }, { start, due }, when, today);
    expect(flags).toEqual({ newlyStarted: false, newlyCompleted: false, newlyDated: false });
  });
});
