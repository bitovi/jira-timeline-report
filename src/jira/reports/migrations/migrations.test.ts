import { MIGRATIONS, EOL_MONTHS } from './migrations';
import { migrateQueryParams } from './index';

const migrated = (queryParams: string) => migrateQueryParams(queryParams).params;

/**
 * A config each entry actually applies to. Without one per entry the idempotency check below passes
 * vacuously for anything the sample doesn't trigger — which is every new migration. Adding a table
 * entry without adding a line here fails the first test.
 */
const APPLIES_TO: Record<string, string> = {
  'breakdown-primary-report-type': 'primaryReportType=breakdown&jql=project%3DORDER',
  'primary-issue-type-to-selected': 'primaryIssueType=Initiative&jql=project%3DORDER',
  'table2-to-table': 'primaryReportType=table2&jql=project%3DORDER',
  'secondary-report-to-inline-document': 'primaryReportType=start-due&secondaryReportType=status&jql=project%3DORDER',
};

describe('the migration table', () => {
  it('has unique ids (they are quoted in EOL failures and release notes)', () => {
    const ids = MIGRATIONS.map((migration) => migration.id);

    expect(ids).toEqual([...new Set(ids)]);
  });

  it('has a sample config for every entry, so the idempotency check below is not vacuous', () => {
    expect(MIGRATIONS.map((migration) => migration.id).filter((id) => !APPLIES_TO[id])).toEqual([]);
  });

  // The write layer writes iff something applied, so an entry that still `applies` after running
  // would rewrite the site-wide storage blob on every page load, forever.
  it('is idempotent — every entry stops applying once it has run', () => {
    for (const migration of MIGRATIONS) {
      const table = [migration];

      const once = migrateQueryParams(APPLIES_TO[migration.id] ?? '', table);
      const twice = migrateQueryParams(once.params, table);

      expect(once.applied, `${migration.id} does not apply to its own sample config`).toEqual([migration.id]);
      expect(twice.applied, `${migration.id} applied twice`).toEqual([]);
      expect(twice.params.toString(), `${migration.id} is not stable`).toBe(once.params.toString());
    }
  });

  /**
   * Every migration is deleted 12 months after `addedOn`, regardless of `onDrop` — write-back
   * converges an install on its first load after the release, so an install still un-migrated at 12
   * months has not been opened in 12 months.
   *
   * This test fails spontaneously, on a date nobody chose. That is the feature: it is the only
   * reminder that cannot be ignored, and the fix is deleting a table entry (see the plan's deletion
   * checklist). To defer deliberately, bump that entry's `addedOn` with a comment saying why.
   */
  it('has no migrations past their end of life', () => {
    const monthsSince = (addedOn: string) => {
      const added = new Date(addedOn);
      const now = new Date();

      return (now.getFullYear() - added.getFullYear()) * 12 + (now.getMonth() - added.getMonth());
    };

    const expired = MIGRATIONS.filter((migration) => monthsSince(migration.addedOn) > EOL_MONTHS);

    expect(
      expired.map(
        (migration) =>
          `${migration.id} (added ${migration.addedOn}, onDrop: ${migration.onDrop}) — see spec/018-card-report/saved-report-migrations/plan.md § End of life`,
      ),
    ).toEqual([]);
  });
});

// The three entries below all fix pre-existing bugs: none of these params were ever translated for
// a saved report, and `route-data.js` clamps an unrecognized report type to the first entry in
// REPORTS — so today each of these silently renders a Gantt.
describe('breakdown-primary-report-type', () => {
  it('replaces the removed breakdown type with the Gantt plus its work-breakdown option', () => {
    const params = migrated('primaryReportType=breakdown&jql=project%3DORDER');

    expect(params.get('primaryReportType')).toBe('start-due');
    expect(params.get('primaryReportBreakdown')).toBe('true');
    expect(params.get('jql')).toBe('project=ORDER');
  });

  it('leaves other report types alone', () => {
    expect(migrated('primaryReportType=start-due').get('primaryReportBreakdown')).toBeNull();
    expect(migrateQueryParams('primaryReportType=due').changed).toBe(false);
  });
});

describe('primary-issue-type-to-selected', () => {
  it('renames primaryIssueType to selectedIssueType and drops the old key', () => {
    const params = migrated('primaryIssueType=Initiative&jql=project%3DORDER');

    expect(params.get('selectedIssueType')).toBe('Initiative');
    expect(params.has('primaryIssueType')).toBe(false);
  });

  // Deliberately unlike the URL fix this replaced, which always let the legacy key win.
  // `primaryIssueType` is now derived from `selectedIssueType` (`toSelectedParts(…).primary`), so for
  // a `Release-Epic` pick it reads `Release` — copying that over would flatten the hierarchy
  // selection. Leaving both keys in place is harmless: route-data reads `selectedIssueType` only.
  it('never overwrites a selectedIssueType that is already there', () => {
    const params = migrated('primaryIssueType=Release&selectedIssueType=Release-Epic');

    expect(params.get('selectedIssueType')).toBe('Release-Epic');
    expect(migrateQueryParams('primaryIssueType=Release&selectedIssueType=Release-Epic').changed).toBe(false);
  });

  it('ignores an empty legacy value rather than triggering a write to clean it up', () => {
    expect(migrateQueryParams('primaryIssueType=').changed).toBe(false);
  });
});

describe('table2-to-table', () => {
  it('renames the table2 report key to table', () => {
    const params = migrated('primaryReportType=table2&jql=project%3DORDER');

    expect(params.get('primaryReportType')).toBe('table');
    expect(params.get('jql')).toBe('project=ORDER');
  });

  it('leaves an already-renamed report alone', () => {
    expect(migrateQueryParams('primaryReportType=table').changed).toBe(false);
  });
});

describe('secondary-report-to-inline-document', () => {
  /** The two `inline-report` nodes a migrated config's `sections` describes, as query strings. */
  const childQueries = (params: URLSearchParams): string[] =>
    JSON.parse(params.get('sections') as string).map((node: { params: { query: string } }) => node.params.query);

  const legacy = (extra = '') =>
    `jql=project%3DORDER&primaryReportType=start-due&selectedIssueType=Initiative&secondaryReportType=breakdown${extra}`;

  it('applies to the two slot values that rendered a card board, and nothing else', () => {
    expect(migrateQueryParams(legacy()).applied).toContain('secondary-report-to-inline-document');
    expect(migrateQueryParams('secondaryReportType=status').applied).toContain('secondary-report-to-inline-document');
    expect(migrateQueryParams('secondaryReportType=none').changed).toBe(false);
    expect(migrateQueryParams('secondaryReportType=').changed).toBe(false);
    expect(migrateQueryParams('primaryReportType=start-due').changed).toBe(false);
  });

  // Only the Gantt and the Scatter Plot ever rendered a secondary. A stale key under any other
  // primary describes a card board the user has never seen, and a saved report that is already a
  // document would have its `sections` overwritten by one.
  it('ignores a stale slot value under a primary that never showed a secondary', () => {
    expect(migrateQueryParams('primaryReportType=table&secondaryReportType=status').changed).toBe(false);
    expect(migrateQueryParams('primaryReportType=report-of-reports&secondaryReportType=status').changed).toBe(false);
    // Absent means the default primary, which is the Gantt — so this one does convert.
    expect(migrateQueryParams('secondaryReportType=status').changed).toBe(true);
  });

  // The postcondition the whole write layer rests on: `persistMigrations` overwrites the site-wide
  // saved-reports blob, so an entry that still applies would rewrite shared storage on every load.
  it('stops applying once it has run', () => {
    const once = migrateQueryParams(legacy());

    expect(migrateQueryParams(once.params).applied).toEqual([]);
  });

  it('leaves the caller’s params untouched', () => {
    const input = new URLSearchParams(legacy());

    migrateQueryParams(input);

    expect(input.toString()).toBe(new URLSearchParams(legacy()).toString());
  });

  it('turns the config into a document of two inline reports', () => {
    const params = migrated(legacy());

    expect(params.get('primaryReportType')).toBe('report-of-reports');
    expect(JSON.parse(params.get('sections') as string).map((node: { type: string }) => node.type)).toEqual([
      'inline-report',
      'inline-report',
    ]);
  });

  it('gives the first child the original primary and the second the Cards report in the slot’s mode', () => {
    const [chart, cards] = childQueries(migrated(legacy())).map((query) => new URLSearchParams(query));

    expect(chart.get('primaryReportType')).toBe('start-due');
    expect(chart.get('cardsMode')).toBeNull();
    expect(cards.get('primaryReportType')).toBe('cards');
    expect(cards.get('cardsMode')).toBe('breakdown');
  });

  it('defaults the chart child to the report an absent primaryReportType would have rendered', () => {
    const [chart] = childQueries(migrated('secondaryReportType=status&jql=project%3DORDER'));

    expect(new URLSearchParams(chart).get('primaryReportType')).toBe('start-due');
  });

  // The whole bag, minus the page-level keys — an allow-list here would silently drop settings.
  it('carries every non-page param into both children', () => {
    const queries = childQueries(
      migrated(legacy('&loadChildren=true&statusesToShow=Development&showSettings=REPORTS&report=abc&fullscreen=true')),
    );

    for (const query of queries) {
      const child = new URLSearchParams(query);

      expect(child.get('jql')).toBe('project=ORDER');
      expect(child.get('selectedIssueType')).toBe('Initiative');
      expect(child.get('loadChildren')).toBe('true');
      expect(child.get('statusesToShow')).toBe('Development');
      // Page chrome and the legacy keys belong to neither child.
      expect(child.has('showSettings')).toBe(false);
      expect(child.has('report')).toBe(false);
      expect(child.has('fullscreen')).toBe(false);
      expect(child.has('secondaryReportType')).toBe(false);
      expect(child.has('secondaryFilterRows')).toBe(false);
      expect(child.has('secondaryChildFilterRows')).toBe(false);
    }
  });

  // A card showed iff it passed both lists, and `matchesAllFilterRows` requires every row to match.
  it('gives the cards child the concatenation of both legacy filter lists', () => {
    const primaryRow = { id: 'a', field: 'jiraStatus', operator: 'is', value: ['Development'] };
    const secondaryRow = { id: 'b', field: 'rollupStatus', operator: 'is not', value: ['complete'] };
    const childRow = { id: 'c', field: 'jiraStatus', operator: 'is', value: ['QA'] };

    const [chart, cards] = childQueries(
      migrated(
        legacy(
          `&filterRows=${encodeURIComponent(JSON.stringify([primaryRow]))}` +
            `&secondaryFilterRows=${encodeURIComponent(JSON.stringify([secondaryRow]))}` +
            `&secondaryChildFilterRows=${encodeURIComponent(JSON.stringify([childRow]))}`,
        ),
      ),
    ).map((query) => new URLSearchParams(query));

    expect(JSON.parse(chart.get('filterRows') as string)).toEqual([primaryRow]);
    expect(chart.has('cardsChildFilterRows')).toBe(false);
    expect(JSON.parse(cards.get('filterRows') as string)).toEqual([primaryRow, secondaryRow]);
    expect(JSON.parse(cards.get('cardsChildFilterRows') as string)).toEqual([childRow]);
  });

  it('writes no empty filter lists when there were none to carry', () => {
    const [, cards] = childQueries(migrated(legacy())).map((query) => new URLSearchParams(query));

    expect(cards.has('filterRows')).toBe(false);
    expect(cards.has('cardsChildFilterRows')).toBe(false);
  });

  // Ordering: the entries above run first, so this one copies their output rather than the raw keys.
  it('sees the output of the earlier entries in the table', () => {
    const [chart, cards] = childQueries(
      migrated('primaryReportType=breakdown&primaryIssueType=Initiative&secondaryReportType=status'),
    ).map((query) => new URLSearchParams(query));

    expect(chart.get('primaryReportType')).toBe('start-due');
    expect(chart.get('primaryReportBreakdown')).toBe('true');
    expect(chart.get('selectedIssueType')).toBe('Initiative');
    expect(chart.has('primaryIssueType')).toBe(false);
    expect(cards.get('primaryReportType')).toBe('cards');
    expect(cards.get('selectedIssueType')).toBe('Initiative');
  });
});

describe('combinations', () => {
  it('applies every entry a legacy config qualifies for in one pass', () => {
    const result = migrateQueryParams('primaryReportType=breakdown&primaryIssueType=Initiative&loadChildren=true');

    expect(result.applied).toEqual(['breakdown-primary-report-type', 'primary-issue-type-to-selected']);
    expect(result.params.get('primaryReportType')).toBe('start-due');
    expect(result.params.get('primaryReportBreakdown')).toBe('true');
    expect(result.params.get('selectedIssueType')).toBe('Initiative');
    expect(result.params.get('loadChildren')).toBe('true');
  });

  it('does nothing to a config saved by a current build', () => {
    const current = 'jql=project%3DORDER&primaryReportType=table&selectedIssueType=Initiative&filterRows=%5B%5D';

    const result = migrateQueryParams(current);

    expect(result.changed).toBe(false);
    expect(result.params.toString()).toBe(new URLSearchParams(current).toString());
  });
});
