import type { AppStorage } from '../storage/common';
import type { Reports } from './fetcher';

import { getAllReports, updateReports } from './fetcher';

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

    expect((await getAllReports(storage)).doc?.sections).toEqual(sections);
  });

  it('loads a report saved before sections existed', async () => {
    const storage = makeStorage();

    await updateReports(storage, {
      gantt: { id: 'gantt', name: 'Gantt', queryParams: 'jql=project%3DORDER&primaryReportType=start-due' },
    });

    const loaded = await getAllReports(storage);

    expect(loaded.gantt?.name).toBe('Gantt');
    expect(loaded.gantt?.sections).toBeUndefined();
  });

  it('keeps fields it does not know about, so a newer document survives a save', async () => {
    const storage = makeStorage();
    const withFutureField = { id: 'doc', name: 'Doc', queryParams: '', sections, theme: 'compact' };

    await updateReports(storage, { doc: withFutureField } as unknown as Reports);

    expect(await getAllReports(storage)).toEqual({ doc: withFutureField });
  });

  it('returns an empty map when nothing has been saved', async () => {
    expect(await getAllReports(makeStorage())).toEqual({});
  });
});
