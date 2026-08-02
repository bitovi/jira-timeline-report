import type { Migration } from './types';

/**
 * Months after `addedOn` at which a migration is deleted, regardless of `onDrop`. Enforced by a
 * test that fails spontaneously on the deadline — see the plan's § End of life.
 */
export const EOL_MONTHS = 12;

/**
 * THE ORDERED TABLE. Applied in array order, so a later entry sees the output of an earlier one.
 *
 * The only file that changes per migration. Adding one means: an entry here, its cases in
 * `migrations.test.ts`, and a row in the plan's changelog. Deleting one at end of life means the
 * reverse — see the plan's deletion checklist.
 *
 * spec/018-card-report/saved-report-migrations/plan.md
 */
export const MIGRATIONS: Migration[] = [
  {
    id: 'breakdown-primary-report-type',
    addedOn: '2026-08-01',
    onDrop: 'lossy',
    describe: 'replaces the removed breakdown report type with the Gantt plus its work-breakdown option',
    // Was `legacyPrimaryReportingTypeRoutingFix` in main-helper.js, which only ever saw the URL.
    // Dropping this entry costs only the toggle: the report-type clamp already resolves an
    // unrecognized 'breakdown' to 'start-due', so the primary is right either way.
    applies: (params) => params.get('primaryReportType') === 'breakdown',
    migrate: (params) => {
      params.set('primaryReportType', 'start-due');
      params.set('primaryReportBreakdown', 'true');
    },
  },
  {
    id: 'primary-issue-type-to-selected',
    addedOn: '2026-08-01',
    onDrop: 'lossy',
    describe: 'renames primaryIssueType to selectedIssueType',
    // Was `legacyPrimaryIssueTypeRoutingFix`, which always let the legacy key win. It must NOT here:
    // `primaryIssueType` is now a *derived* getter — `toSelectedParts(selectedIssueType).primary` —
    // so for a `Release-Epic` hierarchy pick it holds only `Release`. Copying that over
    // `selectedIssueType` would silently flatten the selection. Migrating only when the modern key is
    // absent also makes this a no-op for anything that carries both, so a config that picks up a
    // derived `primaryIssueType` on save can never trigger a write-back loop.
    //
    // `selectedIssueType` (route-data.js) has no fallback to the old key, so without this a saved
    // report that predates the rename loses its selection. An empty legacy value is left alone rather
    // than triggering a write just to delete it.
    applies: (params) => !!params.get('primaryIssueType') && !params.get('selectedIssueType'),
    migrate: (params) => {
      params.set('selectedIssueType', params.get('primaryIssueType') as string);
      params.delete('primaryIssueType');
    },
  },
  {
    id: 'table2-to-table',
    addedOn: '2026-08-01',
    onDrop: 'fatal',
    describe: 'renames the table2 report key to table',
    // spec/017 renamed the key without an alias, so these saved reports render a Gantt instead of
    // a Table today. Ratified 2026-08-01 as a deliberate reversal of that decision.
    applies: (params) => params.get('primaryReportType') === 'table2',
    migrate: (params) => {
      params.set('primaryReportType', 'table');
    },
  },
];
