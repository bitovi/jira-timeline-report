/**
 * Shared timeline TypeScript types.
 *
 * Both the ScatterTimeline and Gantt reports read a small, well-defined slice of the
 * rolled-up issue/release shape for grouping, status coloring, and axis layout. This models
 * that shared slice; each report may extend it locally with report-specific fields.
 */

/** Minimal issue/release shape shared timeline helpers/components read. */
export interface IssueOrRelease {
  key: string;
  summary: string;
  rollupStatuses: {
    rollup: {
      status: string;
      due?: Date | null;
      start?: Date | null;
    };
  };
  /** Team the issue belongs to — read for `'team'` grouping. */
  team?: { name: string } | null;
  /** Parent issue key — read for `'parent'` grouping. */
  parentKey?: string | null;
  /** Project key — read for `'project'` grouping. */
  projectKey?: string;
  /** Lexicographic rank (e.g. Jira's `Rank` field) — used to order `'parent'` groups. */
  rank?: string | null;
}

// Canonical calendar types live with the date utility that produces them; re-export so
// shared timeline modules (and their consumers) can import them from this barrel.
export type { Month, Quarter, QuartersAndMonths } from '../../../../utils/date/compute-quarters-and-months';
