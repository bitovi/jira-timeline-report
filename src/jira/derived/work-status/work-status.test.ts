import { expect, test } from "vitest";
import { getWorkStatus, statusCategoryMap, workType } from "./work-status";
import { NormalizedIssue } from "../../shared/types";

const unrecognizedStatusTestCase = {
  issue: {
    summary: "Some other summary",
    labels: ["other"],
    status: "UnknownStatus",
  } as NormalizedIssue,
  expected: { workType: "dev", statusType: "dev" },
  description:
    "returns default workType 'dev' and statusType 'dev' when status is unrecognized",
};

const summaryWithPrefix = workType.map((workType) => {
  return {
    issue: {
      summary: `${workType}: rest`,
      labels: ["other"],
    } as NormalizedIssue,
    expected: { workType, statusType: "dev" },
    description: `workType with ${workType} summary prefix`,
  };
});

const inLabels = workType.map((workType) => {
  return {
    issue: {
      summary: `${workType}: rest`,
      labels: [workType],
    } as NormalizedIssue,
    expected: { workType, statusType: "dev" },
    description: `workType with ${workType} labels`,
  };
});

const statuses = Object.entries(statusCategoryMap).map(([key, value]) => {
  return {
    issue: { status: key } as NormalizedIssue,
    expected: { statusType: value, workType: "dev" },
    description: `statusType with status ${key}`,
  };
});

test.each([
  unrecognizedStatusTestCase,
  ...summaryWithPrefix,
  ...inLabels,
  ...statuses,
])("getWorkStatus $description", ({ issue, expected }) => {
  const result = getWorkStatus(issue);
  expect(result).toEqual(expected);
});
