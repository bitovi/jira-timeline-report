import type { Migration } from './types';
import type { Reports } from '../fetcher';

import { migrateQueryParams, migrateReport, migrateReports } from './index';

// Runner mechanics, tested against a synthetic table so these cases stay true no matter what the
// real table holds (and keep passing after an entry is deleted at its end of life). The real
// entries are covered in migrations.test.ts.
const renameFooToBar: Migration = {
  id: 'foo-to-bar',
  addedOn: '2026-01-01',
  onDrop: 'lossy',
  describe: 'renames foo to bar',
  applies: (params) => params.has('foo'),
  migrate: (params) => {
    params.set('bar', params.get('foo') as string);
    params.delete('foo');
  },
};

const upperCaseBar: Migration = {
  id: 'bar-uppercase',
  addedOn: '2026-02-01',
  onDrop: 'lossy',
  describe: 'uppercases bar',
  applies: (params) => !!params.get('bar') && params.get('bar') !== params.get('bar')?.toUpperCase(),
  migrate: (params) => params.set('bar', (params.get('bar') as string).toUpperCase()),
};

/**
 * A synthetic stand-in for `secondary-report-to-inline-document`: the only kind of entry whose
 * output is a whole document rather than a setting, which is what the `sections` lift below exists
 * for. Kept fake for the same reason the two above are — these cases must survive that entry's
 * deletion at end of life.
 */
const toDocument: Migration = {
  id: 'to-document',
  addedOn: '2026-03-01',
  onDrop: 'lossy',
  describe: 'turns a legacy config into a document',
  applies: (params) => params.has('legacySlot'),
  migrate: (params) => {
    params.set('sections', JSON.stringify([{ type: 'inline-report', params: { query: 'jql=one' } }]));
    params.delete('legacySlot');
  },
};

const table = [renameFooToBar, upperCaseBar];
const documentTable = [toDocument];

describe('migrateQueryParams', () => {
  it('applies nothing and reports no change when the table has nothing to do', () => {
    const result = migrateQueryParams('jql=project%3DORDER', table);

    expect(result.changed).toBe(false);
    expect(result.applied).toEqual([]);
    expect(result.params.get('jql')).toBe('project=ORDER');
  });

  it('applies in table order, so a later migration sees an earlier one’s output', () => {
    const result = migrateQueryParams('foo=abc', table);

    expect(result.applied).toEqual(['foo-to-bar', 'bar-uppercase']);
    expect(result.changed).toBe(true);
    expect(result.params.get('bar')).toBe('ABC');
    expect(result.params.has('foo')).toBe(false);
  });

  it('never mutates the caller’s params', () => {
    const input = new URLSearchParams('foo=abc');

    migrateQueryParams(input, table);

    expect(input.toString()).toBe('foo=abc');
  });

  it('leaves params no migration claims alone', () => {
    const result = migrateQueryParams('foo=abc&jql=project%3DORDER&filterRows=%5B%5D', table);

    expect(result.params.get('jql')).toBe('project=ORDER');
    expect(result.params.get('filterRows')).toBe('[]');
  });

  // The write layer only writes when something applied, so a second pass reporting `changed` again
  // would rewrite the org-shared storage blob on every page load.
  it('is idempotent — a second pass changes nothing', () => {
    const first = migrateQueryParams('foo=abc', table);
    const second = migrateQueryParams(first.params, table);

    expect(second.changed).toBe(false);
    expect(second.applied).toEqual([]);
    expect(second.params.toString()).toBe(first.params.toString());
  });

  it('warns about a migration whose `applies` stays true after it ran', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const alwaysApplies: Migration = { ...renameFooToBar, id: 'always', applies: () => true, migrate: () => {} };

    migrateQueryParams('anything=1', [alwaysApplies]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('always'));
    warn.mockRestore();
  });
});

describe('migrateReport', () => {
  const report = { id: 'r1', name: 'Legacy', queryParams: 'foo=abc&jql=project%3DORDER' };

  it('rewrites queryParams only', () => {
    const result = migrateReport(report, table);

    expect(result.changed).toBe(true);
    expect(new URLSearchParams(result.report.queryParams).get('bar')).toBe('ABC');
    expect(result.report.id).toBe('r1');
    expect(result.report.name).toBe('Legacy');
  });

  it('returns the same object when nothing applied, so callers can compare by reference', () => {
    const clean = { id: 'r2', name: 'Fine', queryParams: 'jql=project%3DORDER' };

    const result = migrateReport(clean, table);

    expect(result.changed).toBe(false);
    expect(result.report).toBe(clean);
  });

  // fetcher.test.ts pins this for storage round trips; the migration layer must not undo it.
  it('preserves fields it does not know about, including sections', () => {
    const withExtras = { ...report, sections: [{ type: 'saved-report', params: { reportId: 'x' } }], theme: 'compact' };

    const { report: migrated } = migrateReport(withExtras as any, table);

    expect((migrated as any).theme).toBe('compact');
    expect(migrated.sections).toBe(withExtras.sections);
  });

  it('tolerates an empty queryParams string', () => {
    const empty = { id: 'doc', name: 'Document', queryParams: '' };

    expect(migrateReport(empty, table)).toEqual({ report: empty, changed: false, applied: [] });
  });

  // The record-level half of § Two destinations: a URL keeps its `sections` param (the provider
  // reads it first), while a record's document has to land in the field the provider reads.
  describe('the sections lift', () => {
    const legacy = { id: 'r3', name: 'Legacy', queryParams: 'legacySlot=status&jql=project%3DORDER' };

    it('moves a produced document onto the record and out of queryParams', () => {
      const { report } = migrateReport(legacy, documentTable);

      expect(report.sections).toEqual([{ type: 'inline-report', params: { query: 'jql=one' } }]);
      expect(new URLSearchParams(report.queryParams).has('sections')).toBe(false);
      expect(new URLSearchParams(report.queryParams).get('jql')).toBe('project=ORDER');
    });

    it('never clobbers a document the record already has', () => {
      const existing = [{ type: 'saved-report' as const, params: { reportId: 'x' } }];

      const { report } = migrateReport({ ...legacy, sections: existing }, documentTable);

      expect(report.sections).toBe(existing);
      // Left in `queryParams` rather than dropped — losing it would be worse than leaving it.
      expect(new URLSearchParams(report.queryParams).has('sections')).toBe(true);
    });

    it('treats an empty sections array as no document, so a lift can still fill it', () => {
      const { report } = migrateReport({ ...legacy, sections: [] }, documentTable);

      expect(report.sections).toEqual([{ type: 'inline-report', params: { query: 'jql=one' } }]);
    });

    it('leaves an unparseable sections param alone rather than throwing', () => {
      const mangled: Migration = {
        ...toDocument,
        migrate: (params) => {
          params.set('sections', '{oops');
          params.delete('legacySlot');
        },
      };

      const { report } = migrateReport(legacy, [mangled]);

      expect(report.sections).toBeUndefined();
      expect(new URLSearchParams(report.queryParams).get('sections')).toBe('{oops');
    });

    // The URL consumer has no lift: `migrateQueryParams` is what `migrateUrlParams` writes back.
    it('is a record-level step only — the params keep their sections key', () => {
      expect(migrateQueryParams(legacy.queryParams, documentTable).params.has('sections')).toBe(true);
    });
  });
});

describe('migrateReports', () => {
  it('migrates only the reports that need it and collects the ids that applied', () => {
    const reports: Reports = {
      legacy: { id: 'legacy', name: 'Legacy', queryParams: 'foo=abc' },
      fine: { id: 'fine', name: 'Fine', queryParams: 'jql=project%3DORDER' },
    };

    const result = migrateReports(reports, table);

    expect(result.changed).toBe(true);
    expect(result.applied).toEqual(['foo-to-bar', 'bar-uppercase']);
    expect(result.reports.legacy?.queryParams).toBe('bar=ABC');
    expect(result.reports.fine).toBe(reports.fine);
  });

  it('returns the same map when nothing applied', () => {
    const reports: Reports = { fine: { id: 'fine', name: 'Fine', queryParams: 'jql=project%3DORDER' } };

    const result = migrateReports(reports, table);

    expect(result.changed).toBe(false);
    expect(result.reports).toBe(reports);
  });

  it('passes undefined slots through (the map is Partial)', () => {
    const reports = { gone: undefined, legacy: { id: 'legacy', name: 'L', queryParams: 'foo=abc' } } as Reports;

    const result = migrateReports(reports, table);

    expect(result.reports.gone).toBeUndefined();
    expect('gone' in result.reports).toBe(true);
  });

  it('handles an empty map', () => {
    expect(migrateReports({}, table)).toEqual({ reports: {}, changed: false, applied: [] });
  });
});
