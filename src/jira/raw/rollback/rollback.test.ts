// tests/rollback.test.ts

import { expect, test } from "vitest";
import { rollbackIssue } from "./rollback";
import {
  JiraIssue,
  Changelog,
  Sprint,
  FixVersion,
  Status,
} from "../../shared/types";

export const Time: Record<string, Date> = {
  _2000: new Date(2000, 0),
  _2001: new Date(2001, 0),
  _2002: new Date(2002, 0),
  _2003: new Date(2003, 0),
  _2004: new Date(2004, 0),
  _2005: new Date(2005, 0),
  _2006: new Date(2006, 0),
  _2007: new Date(2007, 0),
  oneHourAgo: new Date(Date.now() - 1000 * 60 * 60),
};

// I'm not sure this is always going to do what's expected for everyone in every timezone
export function toYY_MM_DD(date: Date): string {
  return date.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function makeStartDateChangelog(
  from: Date,
  to: Date,
  when: Date = new Date()
): Changelog {
  const fromStr = toYY_MM_DD(from);
  const toStr = toYY_MM_DD(to);
  return {
    created: when.toISOString(),
    items: [
      {
        field: "Start date",
        from: fromStr,
        fromString: fromStr,
        to: toStr,
        toString: toStr,
      },
    ],
  };
}

/**
 * Default RollbackLookupData with empty maps.
 */
const defaultRollbackLookupData = {
  sprints: {
    ids: new Map<string | number, Sprint>(),
    names: new Map<string, Sprint>(),
  },
  versions: {
    ids: new Map<string | number, FixVersion>(),
    names: new Map<string, FixVersion>(),
  },
  statuses: {
    ids: new Map<string | number, Status>(),
    names: new Map<string, Status>(),
  },
};

test("start date rollback", () => {
  const exampleRawIssue = {
    key: "STORE-8",
    changelog: [makeStartDateChangelog(Time._2001, Time._2007)],
    fields: {
      "Start date": toYY_MM_DD(Time._2007),
    },
  } as JiraIssue;

  const result = rollbackIssue(
    exampleRawIssue,
    defaultRollbackLookupData,
    Time.oneHourAgo
  );
  expect(result).toStrictEqual({
    key: "STORE-8",
    fields: {
      "Start date": toYY_MM_DD(Time._2001),
    },
    rollbackMetadata: { rolledbackTo: Time.oneHourAgo },
  });
});

test("IssueParentAssociation rollback", () => {
  const exampleRawIssue = {
    key: "STORE-8",
    changelog: [
      {
        created: new Date().toISOString(),
        items: [
          {
            field: "IssueParentAssociation",
            from: "10276",
            fromString: "IMP-1",
            to: "10277",
            toString: "IMP-143",
          },
        ],
      },
    ],
    fields: {
      Parent: {
        key: "IMP-143",
        id: "10277",
      },
    },
  } as JiraIssue;

  const result = rollbackIssue(
    exampleRawIssue,
    defaultRollbackLookupData,
    Time.oneHourAgo
  );
  expect(result).toStrictEqual({
    key: "STORE-8",
    fields: {
      Parent: { key: "IMP-1", id: "10276" },
    },
    rollbackMetadata: { rolledbackTo: Time.oneHourAgo },
  });
});

test("sprint rollback", () => {
  const exampleRawIssue = {
    key: "STORE-8",
    changelog: [
      {
        created: new Date().toISOString(),
        items: [
          {
            field: "Sprint",
            from: "75",
            fromString: "Dev Sprint 1",
            to: "76",
            toString: "Dev Sprint 2",
          },
        ],
      },
    ],
    fields: {
      Sprint: [
        {
          id: "76",
          name: "Dev Sprint 2",
          startDate: "2024-10-09T05:00:00.000Z",
          endDate: "2024-10-23T05:00:00.000Z",
        },
      ],
    },
  } as JiraIssue;

  // Prepare the data required by rollbackIssue
  const sprintsData = {
    sprints: {
      ids: new Map<string, Sprint>([
        [
          "75",
          {
            id: "75",
            name: "Dev Sprint 1",
            startDate: "2024-10-09T05:00:00.000Z",
            endDate: "2024-10-23T05:00:00.000Z",
          },
        ],
        [
          "76",
          {
            id: "76",
            name: "Dev Sprint 2",
            startDate: "2024-10-09T05:00:00.000Z",
            endDate: "2024-10-23T05:00:00.000Z",
          },
        ],
      ]),
      names: new Map<string, Sprint>([
        [
          "Dev Sprint 1",
          {
            id: "75",
            name: "Dev Sprint 1",
            startDate: "2024-10-09T05:00:00.000Z",
            endDate: "2024-10-23T05:00:00.000Z",
          },
        ],
        [
          "Dev Sprint 2",
          {
            id: "76",
            name: "Dev Sprint 2",
            startDate: "2024-10-09T05:00:00.000Z",
            endDate: "2024-10-23T05:00:00.000Z",
          },
        ],
      ]),
    },
    versions: {
      ids: new Map<string, FixVersion>(),
      names: new Map<string, FixVersion>(),
    },
    statuses: {
      ids: new Map<string, Status>(),
      names: new Map<string, Status>(),
    },
  };

  const result = rollbackIssue(exampleRawIssue, sprintsData, Time.oneHourAgo);
  expect(result).toStrictEqual({
    key: "STORE-8",
    fields: {
      Sprint: [
        {
          id: "75",
          name: "Dev Sprint 1",
          startDate: "2024-10-09T05:00:00.000Z",
          endDate: "2024-10-23T05:00:00.000Z",
        },
      ],
    },
    rollbackMetadata: { rolledbackTo: Time.oneHourAgo },
  });
});
