import { expect, test } from "vitest";
import { getWorkStatus, statusCategoryMap, workType } from "./work-status.ts";

const unrecognizedStatusTestCase = {
  issue: { summary: "Some other summary", labels: ["other"], status: "UnknownStatus" },
  expected: { workType: "dev", statusType: "dev" },
  description: "returns default workType 'dev' and statusType 'dev' when status is unrecognized",
};

const summaryWithPrefix = workType.map((workType) => {
  return {
    issue: { summary: `${workType}: rest`, labels: [] },
    expected: { workType, statusType: "dev" },
    description: `workType with ${workType} summary prefix`,
  };
});

const inLabels = workType.map((workType) => {
  return {
    issue: { summary: `${workType}: rest`, labels: [workType] },
    expected: { workType, statusType: "dev" },
    description: `workType with ${workType} labels`,
  };
});

const statuses = Object.entries(statusCategoryMap).map(([key, value]) => {
  return {
    issue: { status: key },
    expected: { statusType: value, workType: "dev" },
    description: `statusType with status ${key}`,
  };
});

test.each([unrecognizedStatusTestCase, ...summaryWithPrefix, ...inLabels, ...statuses])(
  "getWorkStatus $description",
  ({ issue, expected }) => {
    const result = getWorkStatus(issue);
    expect(result).toEqual(expected);
  }
);
