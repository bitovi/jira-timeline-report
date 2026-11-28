// Stand-in for the published `@bitovi/report-sdk` package. Types come straight from the app's own
// pipeline so reports and built-in reports describe issues identically.
export type { JiraIssue as RawIssue, RollupLevelAndCalculation } from '../../../src/jira/shared/types';
export type { DerivedIssue } from '../../../src/jira/derived/derive';
export type { NormalizeIssueConfig } from '../../../src/jira/normalized/normalize';
export type { WithRollups } from '../../../src/jira/rolledup-and-rolledback/rollup-and-rollback';
export type { IssueOrRelease } from '../../../src/jira/rollup/rollup';

import type { JiraIssue, RollupLevelAndCalculation } from '../../../src/jira/shared/types';
import type { NormalizeIssueConfig, normalizeIssue as NormalizeIssue } from '../../../src/jira/normalized/normalize';
import type { deriveIssue as DeriveIssue } from '../../../src/jira/derived/derive';
import type {
  rollupAndRollback as RollupAndRollback,
  WithRollups,
} from '../../../src/jira/rolledup-and-rolledback/rollup-and-rollback';
import type { IssueOrRelease } from '../../../src/jira/rollup/rollup';

export type RolledUpIssue = IssueOrRelease<WithRollups>;

export interface ReportContext {
  /** Per-level rollup calculations, from the report's saved Timing settings. */
  rollupLevels: RollupLevelAndCalculation[];
  /** Field and team configuration, from the app's saved configuration. */
  normalizeConfig: Partial<NormalizeIssueConfig>;
  /** "Compare to" date, ISO string. */
  compareTo: string;
}

export interface ReportSDKRuntime {
  version: string;
  /** Raw issues for a data source declared in the report manifest. */
  getData(name: string): Promise<{ issues: JiraIssue[] }>;
  getContext(): Promise<ReportContext>;
  normalizeIssue: typeof NormalizeIssue;
  deriveIssue: typeof DeriveIssue;
  rollupAndRollback: typeof RollupAndRollback;
}

// The runtime is provided by the host (manifest `sdk.provide: "host"`) or, in `npm run dev`, by the
// mock in dev-host.ts. Resolved lazily so script order does not matter.
function runtime(): ReportSDKRuntime {
  const sdk = (globalThis as { ReportSDK?: ReportSDKRuntime }).ReportSDK;
  if (!sdk) throw new Error('Report SDK runtime not found. Is manifest sdk.provide set to "host"?');
  return sdk;
}

export const getData: ReportSDKRuntime['getData'] = (name) => runtime().getData(name);
export const getContext: ReportSDKRuntime['getContext'] = () => runtime().getContext();
export const normalizeIssue: ReportSDKRuntime['normalizeIssue'] = (...a) => runtime().normalizeIssue(...a);
export const deriveIssue: ReportSDKRuntime['deriveIssue'] = (...a) => runtime().deriveIssue(...a);
export const rollupAndRollback: ReportSDKRuntime['rollupAndRollback'] = (...a) => runtime().rollupAndRollback(...a);

/** Convenience: raw issues → rolled-up issues, using the host's context. */
export async function loadRolledUp(name: string): Promise<RolledUpIssue[]> {
  const [{ issues }, ctx] = await Promise.all([getData(name), getContext()]);
  const derived = issues.map((raw) => deriveIssue(normalizeIssue(raw, ctx.normalizeConfig)));
  return rollupAndRollback(derived, ctx.normalizeConfig, ctx.rollupLevels, new Date(ctx.compareTo));
}
