/**
 * One transform over a set of query params — the unit of the ordered table in `migrations.ts`.
 *
 * Every param this app persists lives in one flat `URLSearchParams`-shaped bag, whether it came
 * from the page URL or from a saved report's `queryParams` string. So a single interface covers
 * both, and one table serves all three consumers (read-time normalization, the guarded write-back,
 * and the boot URL rewrite). See spec/018-card-report/saved-report-migrations/plan.md.
 */
export interface Migration {
  /** Stable id — appears in EOL test failures and console warnings. Never reused. */
  id: string;
  /** ISO date the migration shipped. Drives EOL. */
  addedOn: `${number}-${number}-${number}`;
  /**
   * What a user loses if this entry is deleted at its end of life — it decides how the deletion is
   * announced, not when it happens (the deadline is uniform):
   *
   * - `'lossy'`: a setting reverts to its default. The report still renders as itself.
   * - `'fatal'`: the saved report comes back as a *different* report. Needs a release note naming
   *   the dead key, and relies on the shell's unsupported-report-type message.
   *
   * Note that neither produces a blank page: `route-data.js` clamps an unrecognized
   * `primaryReportType` to the first entry in `REPORTS`, so a dead report key renders a Gantt.
   */
  onDrop: 'fatal' | 'lossy';
  /** One line, present tense: "renames secondaryReportType to cardsMode". */
  describe: string;
  /**
   * True if this migration has anything to do. Must be false once `migrate` has run — the write
   * layer only writes when something applied, so an entry that always applies would rewrite the
   * org-shared storage blob on every load. `runMigrations` checks the postcondition and warns.
   */
  applies: (params: URLSearchParams) => boolean;
  /** Mutates a COPY of the caller's params. Only called when `applies` is true. */
  migrate: (params: URLSearchParams) => void;
}
