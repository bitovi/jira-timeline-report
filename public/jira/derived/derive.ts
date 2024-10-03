import {
  DerivedWorkTiming,
  deriveWorkTiming,
  WorkTimingConfig,
} from "./work-timing/work-timing";
import {
  DerivedWorkStatus,
  getWorkStatus,
  WorkStatusConfig,
} from "./work-status/work-status";
import { normalizeIssue, NormalizeIssueConfig } from "../normalized/normalize";
import { JiraIssue, NormalizedIssue } from "../shared/types";

/**
 * @typedef {import("../shared/types.js").NormalizedIssue & {
 *   derivedTiming: import("./work-timing/work-timing.js").DerivedWorkTiming
 * } & {derivedStatus: import("./work-status/work-status.ts").DerivedWorkStatus}} DerivedIssue
 */
export type DerivedIssue = NormalizedIssue & {
  derivedTiming: DerivedWorkTiming;
  derivedStatus: DerivedWorkStatus;
};

/**
 * Adds derived data
 * @param {NormalizedIssue} normalizedIssue
 * @return {DerivedIssue}
 */
export function deriveIssue(
  issue: NormalizedIssue,
  options: Partial<WorkStatusConfig & WorkTimingConfig> & {
    uncertaintyWeight?: number;
  } = {}
): DerivedIssue {
  const derivedTiming = deriveWorkTiming(issue, options);
  const derivedStatus = getWorkStatus(issue, options);

  return {
    derivedTiming,
    derivedStatus,
    ...issue,
  };
}

/**
 *
 * @param {Array<JiraIssue>} issues
 * @returns {Array<DerivedIssue>}
 */
export function normalizeAndDeriveIssues(
  issues: Array<JiraIssue>,
  options: Partial<
    NormalizeIssueConfig & WorkStatusConfig & WorkTimingConfig
  > & {
    uncertaintyWeight?: number;
  }
): DerivedIssue[] {
  return issues.map((issue: JiraIssue) =>
    deriveIssue(normalizeIssue(issue, options), options)
  );
}

/**
 *
 * @param {DerivedIssue} derivedIssue
 */
export function derivedToCSVFormat(derivedIssue: DerivedIssue) {
  return {
    ...derivedIssue.issue.fields,
    changelog: derivedIssue.issue.changelog,
    "Project key": derivedIssue.team.name,
    "Issue key": derivedIssue.key,
    url: derivedIssue.url,
    "Issue Type": derivedIssue.type,
    "Parent Link": derivedIssue.parentKey,
    Status: derivedIssue.status,
    workType: derivedIssue.derivedStatus.workType,
    workingBusinessDays: derivedIssue.derivedTiming.totalDaysOfWork,
    weightedEstimate: derivedIssue.derivedTiming.deterministicTotalPoints,
  };
}
