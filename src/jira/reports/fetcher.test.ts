import type { AppStorage } from '../storage/common';
import type { Reports } from './fetcher';

import { getAllReports, readAllReports, updateReports } from './fetcher';
import { createLegacyReportsBackend } from './backend/legacy';

/**
 * A storage double that does a real JSON round trip, like both production backends: the web build
 * stringifies into a codeBlock in an issue description, the plugin into an app property. Neither has
 * a schema or enumerates keys, which is what lets `sections` ride along.
 * See spec/016-report-of-reports Phase 3.
 */
const makeStorage = (): AppStorage => {
  let blob = '{}';

  return {
    get: async <T>(key: string) => (JSON.parse(blob)[key] ?? null) as T | null,
    update: async <T>(key: string, value: T) => {
      blob = JSON.stringify({ ...JSON.parse(blob), [key]: value });
    },
    storageInitialized: async () => true,
  } as unknown as AppStorage;
};

const sections = [
  {
    type: 'section' as const,
    params: { title: 'Delivery' },
    children: [{ type: 'saved-report' as const, params: { reportId: 'child-a' } }],
  },
  { type: 'saved-report' as const, params: { reportId: 'child-b' } },
];

describe('saved report persistence', () => {
  it('round-trips a document tree through storage', async () => {
    const storage = makeStorage();
    const reports: Reports = {
      doc: { id: 'doc', name: 'Q3 Exec Review', queryParams: 'primaryReportType=report-of-reports', sections },
    };

    await updateReports(storage, reports);

    expect((await getAllReports(createLegacyReportsBackend(storage))).doc?.sections).toEqual(sections);
  });

  it('loads a report saved before sections existed', async () => {
    const storage = makeStorage();

    await updateReports(storage, {
      gantt: { id: 'gantt', name: 'Gantt', queryParams: 'jql=project%3DORDER&primaryReportType=start-due' },
    });

    const loaded = await getAllReports(createLegacyReportsBackend(storage));

    expect(loaded.gantt?.name).toBe('Gantt');
    expect(loaded.gantt?.sections).toBeUndefined();
  });

  it('keeps fields it does not know about, so a newer document survives a save', async () => {
    const storage = makeStorage();
    const withFutureField = { id: 'doc', name: 'Doc', queryParams: '', sections, theme: 'compact' };

    await updateReports(storage, { doc: withFutureField } as unknown as Reports);

    expect(await getAllReports(createLegacyReportsBackend(storage))).toEqual({ doc: withFutureField });
  });

  it('returns an empty map when nothing has been saved', async () => {
    expect(await getAllReports(createLegacyReportsBackend(makeStorage()))).toEqual({});
  });
});

// The read layer is the correctness layer: a saved report's params never pass through the URL, so the
// boot-time URL rewrite could never reach them and legacy keys survived indefinitely.
// See spec/018-card-report/saved-report-migrations/plan.md.
describe('read-time migration', () => {
  it('normalizes legacy params on the way out of storage', async () => {
    const storage = makeStorage();

    await updateReports(storage, {
      legacy: { id: 'legacy', name: 'Old Table', queryParams: 'jql=project%3DORDER&primaryReportType=table2' },
    });

    const params = new URLSearchParams((await getAllReports(createLegacyReportsBackend(storage))).legacy?.queryParams);

    expect(params.get('primaryReportType')).toBe('table');
    expect(params.get('jql')).toBe('project=ORDER');
  });

  it('reports what it migrated, so the write-back layer can converge storage', async () => {
    const storage = makeStorage();

    await updateReports(storage, {
      legacy: { id: 'legacy', name: 'Old', queryParams: 'primaryReportType=breakdown' },
      fine: { id: 'fine', name: 'Fine', queryParams: 'primaryReportType=start-due' },
    });

    const { changed, applied } = await readAllReports(createLegacyReportsBackend(storage));

    expect(changed).toBe(true);
    expect(applied).toEqual(['breakdown-primary-report-type']);
  });

  it('reports no change for reports a current build saved', async () => {
    const storage = makeStorage();

    await updateReports(storage, {
      gantt: { id: 'gantt', name: 'Gantt', queryParams: 'jql=project%3DORDER&primaryReportType=start-due' },
    });

    expect(await readAllReports(createLegacyReportsBackend(storage))).toMatchObject({ changed: false, applied: [] });
  });

  it('keeps a document tree and unknown fields through a migration', async () => {
    const storage = makeStorage();
    const doc = { id: 'doc', name: 'Doc', queryParams: 'primaryReportType=table2', sections, theme: 'compact' };

    await updateReports(storage, { doc } as unknown as Reports);

    const loaded = (await getAllReports(createLegacyReportsBackend(storage))).doc as unknown as typeof doc;

    expect(loaded.sections).toEqual(sections);
    expect(loaded.theme).toBe('compact');
    expect(new URLSearchParams(loaded.queryParams).get('primaryReportType')).toBe('table');
  });
});
