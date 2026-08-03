import type { Migration } from './types';

/**
 * Months after `addedOn` at which a migration is deleted, regardless of `onDrop`. Enforced by a
 * test that fails spontaneously on the deadline — see the plan's § End of life.
 */
export const EOL_MONTHS = 12;

/**
 * Params that describe the *page* rather than any one report on it, so neither of the children the
 * secondary-slot migration produces should inherit them.
 *
 * Frozen by hand rather than imported from `ChildReportConfig`'s `SHELL_ONLY_PARAM_KEYS`: a
 * migration has to mean the same thing in twelve months as it does today, and reading a live list
 * would let a future edit retroactively change what an already-shipped transform does. (It would
 * also point `src/jira` at `src/react`.)
 */
const PAGE_ONLY_KEYS = ['showSettings', 'report', 'fullscreen', 'openAutoSchedulerModal', 'sections'];

/** The three keys the secondary slot was configured with. Deleted by the migration below. */
const SECONDARY_SLOT_KEYS = ['secondaryReportType', 'secondaryFilterRows', 'secondaryChildFilterRows'];

/**
 * The primaries that actually rendered a secondary report — `showSecondaryReport.ts`, before it was
 * deleted. Frozen by hand for the reason {@link PAGE_ONLY_KEYS} is, `'start-due'` included: it is
 * the first entry in `configuration/reports.ts` and therefore what route-data clamps an absent or
 * unrecognized `primaryReportType` to.
 */
const PRIMARIES_THAT_SHOWED_A_SECONDARY = ['start-due', 'due'];
const DEFAULT_PRIMARY_REPORT_TYPE = 'start-due';

/** A JSON-array param, or `[]` for anything that isn't one. Never throws — a bad param is not fatal. */
const jsonList = (params: URLSearchParams, key: string): unknown[] => {
  try {
    const parsed = JSON.parse(params.get(key) ?? '');

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** Writes a JSON-array param, or removes it when the list is empty, so nothing writes `[]`. */
const setJsonList = (params: URLSearchParams, key: string, list: unknown[]): void => {
  if (list.length) {
    params.set(key, JSON.stringify(list));
  } else {
    params.delete(key);
  }
};

/**
 * One `inline-report` node, in stored form — `sections.ts`'s `StoredNode`, written as a literal
 * rather than built through `inlineReportNode` for the reason the key lists above are frozen, and
 * because that factory mints an in-memory id this must not persist.
 */
const inlineReport = (query: URLSearchParams) => ({ type: 'inline-report', params: { query: query.toString() } });

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
  {
    id: 'secondary-report-to-inline-document',
    addedOn: '2026-08-02',
    onDrop: 'lossy',
    describe: 'converts a legacy secondary-slot config into a report-of-reports document with inline reports',
    // Runs last, so it copies the *output* of the entries above into both children — a config that
    // said `primaryReportType=breakdown` has already become a Gantt with its breakdown option on by
    // the time this sees it.
    //
    // Gated on the primary as well as the slot, deliberately. A config whose primary never showed a
    // secondary (a Table, say, carrying a `secondaryReportType` the URL never cleared) renders no
    // card board today, so converting it would *invent* a report the user has never seen — and, for
    // a saved report that is already a document, would stamp a second `sections` over the one it has.
    // Nothing is lost by leaving those: the key is inert once route-data stops defining it.
    applies: (params) =>
      ['status', 'breakdown'].includes(params.get('secondaryReportType') ?? '') &&
      PRIMARIES_THAT_SHOWED_A_SECONDARY.includes(params.get('primaryReportType') || DEFAULT_PRIMARY_REPORT_TYPE),
    migrate: (params) => {
      const mode = params.get('secondaryReportType') as string;

      // Copy the whole bag into both children rather than allow-listing what to carry across:
      // route-data defines ~60 settings, and an allow-list guarantees silent drops.
      const shared = new URLSearchParams(params);
      [...PAGE_ONLY_KEYS, ...SECONDARY_SLOT_KEYS].forEach((key) => shared.delete(key));

      const chart = new URLSearchParams(shared);
      chart.set('primaryReportType', params.get('primaryReportType') || DEFAULT_PRIMARY_REPORT_TYPE);

      const cards = new URLSearchParams(shared);
      cards.set('primaryReportType', 'cards');
      cards.set('cardsMode', mode);

      // A card showed today iff it passed BOTH lists — the view model narrowed the primaries by
      // `filterRows`, and the secondary report narrowed them again by its own `secondaryFilterRows`.
      // `matchesAllFilterRows` requires every row to match, so concatenating the two is lossless.
      setJsonList(cards, 'filterRows', [...jsonList(params, 'filterRows'), ...jsonList(params, 'secondaryFilterRows')]);
      setJsonList(cards, 'cardsChildFilterRows', jsonList(params, 'secondaryChildFilterRows'));

      params.set('primaryReportType', 'report-of-reports');
      params.set('sections', JSON.stringify([inlineReport(chart), inlineReport(cards)]));
      // Not kept as insurance. The document carries everything they said, so all they would be is a
      // permanently-true `applies` — and the write layer rewrites the site-wide saved-reports blob
      // once per session for as long as one exists.
      SECONDARY_SLOT_KEYS.forEach((key) => params.delete(key));
    },
  },
];
