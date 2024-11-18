import { rollbackIssues } from "../raw/rollback/rollback";
import { DerivedIssue, deriveIssue } from "../derived/derive";
import { normalizeIssue, NormalizeIssueConfig } from "../normalized/normalize";
import { addRollupDates } from "../rollup/dates/dates";
import { addWorkTypeDates } from "../rolledup/work-type/work-type";
import { rollupBlockedStatusIssues } from "../rollup/blocked-status-issues/blocked-status-issues";
import { deriveReleases } from "../releases/derive";
import { normalizeReleases } from "../releases/normalize";
import { addPercentComplete } from "../rollup/percent-complete/percent-complete";
import { addReportingHierarchy } from "../rollup/rollup";
import { rollupChildStatuses } from "../rollup/child-statuses/child-statuses";
import { rollupWarningIssues } from "../rollup/warning-issues/warning-issues";
import {
  addHistoricalAdjustedEstimatedTime,
  FEATURE_HISTORICALLY_ADJUSTED_ESTIMATES,
} from "../rollup/historical-adjusted-estimated-time/historical-adjusted-estimated-time";
import { JiraIssue, RollupLevelAndCalculation } from "../shared/types";
import { groupBy } from "../shared/helpers";

export function rollupAndRollback<TRollupable extends DerivedIssue>(
  derivedIssues: TRollupable[],
  configuration: Partial<NormalizeIssueConfig>,
  rollupTimingLevelsAndCalculations: RollupLevelAndCalculation[],
  when: Date
) {
  // get old issues and prepare them
  const oldRawIssues = derivedIssuesToRawIssues(derivedIssues);
  const pastStatusRolledUp = rollbackNormalizeAndDeriveEverything(
    oldRawIssues,
    configuration,
    rollupTimingLevelsAndCalculations,
    when
  );

  // prepare current issues
  const currentStatusRolledUp = addRollups(derivedIssues, rollupTimingLevelsAndCalculations);

  // TODO: use id in the future to handle issue keys being changed
  const oldMap = groupBy(pastStatusRolledUp, ({ key }) => key);
  const result = currentStatusRolledUp.map((x) => ({ ...x, issueLastPeriod: oldMap[x.key] }));

  return result;
}

function addRollups<TRollupable extends DerivedIssue>(
  derivedIssues: TRollupable[],
  rollupTimingLevelsAndCalculations: RollupLevelAndCalculation[]
) {
  const normalizedReleases = normalizeReleases(derivedIssues, rollupTimingLevelsAndCalculations);
  const releases = deriveReleases(normalizedReleases);
  const reporting = addReportingHierarchy(
    [...releases, ...derivedIssues],
    rollupTimingLevelsAndCalculations
  );
  const rolledUpDates = addRollupDates(reporting, rollupTimingLevelsAndCalculations);
  const rolledUpBlockers = rollupBlockedStatusIssues(
    rolledUpDates,
    rollupTimingLevelsAndCalculations
  );
  const rolledUpWarnings = rollupWarningIssues(rolledUpBlockers, rollupTimingLevelsAndCalculations);
  const percentComplete = addPercentComplete(rolledUpWarnings, rollupTimingLevelsAndCalculations);
  let childStatuses;
  if (FEATURE_HISTORICALLY_ADJUSTED_ESTIMATES()) {
    // NOTE not converting `historical-adjusted-estimated-time.js` to TS yet since it's experimental, per JMeyer
    let historicalAdjusted: typeof percentComplete = addHistoricalAdjustedEstimatedTime(
      percentComplete,
      rollupTimingLevelsAndCalculations
    );
    childStatuses = rollupChildStatuses(historicalAdjusted, rollupTimingLevelsAndCalculations);
  } else {
    childStatuses = rollupChildStatuses(percentComplete, rollupTimingLevelsAndCalculations);
  }
  return addWorkTypeDates(childStatuses, rollupTimingLevelsAndCalculations);
}

export function rollbackNormalizeAndDeriveEverything(
  rawIssues: JiraIssue[],
  configuration: Partial<NormalizeIssueConfig>,
  rollupTimingLevelsAndCalculations: RollupLevelAndCalculation[],
  when: Date
) {
  const pastRawIssues = rollbackIssues(rawIssues, when);
  //const dne = pastRawIssues.filter(ri => ri.rollbackMetadata.didNotExistBefore);

  const pastDerived = pastRawIssues.map((issue) => {
    const normalized = normalizeIssue(issue, configuration);
    return deriveIssue(normalized);
  });
  return addRollups(pastDerived, rollupTimingLevelsAndCalculations);
}

function derivedIssuesToRawIssues<TRollupable extends DerivedIssue>(derivedIssues: TRollupable[]) {
  return derivedIssues.map((dI) => dI.issue);
}
