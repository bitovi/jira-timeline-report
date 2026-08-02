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
