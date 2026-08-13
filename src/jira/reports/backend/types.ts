import type { Report, Reports } from '../fetcher';

/**
 * Everything the app does to saved reports, behind one seam so that *where* they are stored is a
 * per-site setting rather than a build-time fact.
 *
 * **Why every mutation takes both the one report and the whole map.** The two implementations want
 * different halves of that: the legacy backend writes the entire collection as a single record — it
 * has done since day one and this keeps that byte for byte — while the space backend addresses one
 * work item and never touches the others. Each ignores the argument it does not need, which is what
 * lets the call sites stay identical and blind to the choice.
 *
 * See spec/026-storage-saved-reports/plan.md § The backend seam.
 */
export type ReportsBackend = {
  /**
   * Every saved report, keyed by `report.id`. Never throws for one bad record: an unreadable report
   * is skipped so a single mangled item cannot blank the list.
   */
  readAll(): Promise<Reports>;

  /** Creates or replaces one report. `allReports` already includes `report`. */
  upsert(report: Report, allReports: Reports): Promise<void>;

  /** Deletes one report. `allReports` is the map with `report` already removed. */
  remove(report: Report, allReports: Reports): Promise<void>;

  /**
   * The read-time migration write-back (`jira/reports/migrations/persist.ts`), which is a fourth
   * write path with its own shape: it changes *n* reports at once, and it must stay one write for
   * the legacy backend — that record is shared by the whole site.
   *
   * `migrated` is only the reports a migration actually rewrote, so the space backend touches
   * exactly those work items; the legacy backend ignores it and writes `allReports` once, which is
   * what it did before this seam existed.
   */
  writeMigrated(migrated: Report[], allReports: Reports): Promise<void>;

  /**
   * False when this backend has nowhere to write yet — the web build with no configuration issue,
   * which is the one state where `update` throws. Read before the convergence write so a first-run
   * install doesn't log an error over a write nothing was waiting on.
   */
  canWrite(): Promise<boolean>;
};
