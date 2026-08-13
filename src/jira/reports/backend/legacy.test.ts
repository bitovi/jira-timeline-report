import type { AppStorage } from '../../storage/common';
import type { Report, Reports } from '../fetcher';

import { createLegacyReportsBackend } from './legacy';

const a: Report = { id: 'a', name: 'A', queryParams: 'primaryReportType=table' };
const b: Report = { id: 'b', name: 'B', queryParams: 'primaryReportType=start-due' };

const makeStorage = (overrides: Partial<AppStorage> = {}) =>
  ({
    get: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(undefined),
    storageInitialized: vi.fn().mockResolvedValue(true),
    ...overrides,
  }) as unknown as AppStorage;

/**
 * This backend is the path 100% of installs are on. These assertions are about bytes, not
 * behaviour: same key, same whole-collection payload, one write per mutation — whatever the seam
 * above it now looks like.
 */
describe('the legacy reports backend', () => {
  it('reads the saved-reports record', async () => {
    const reports: Reports = { a, b };
    const storage = makeStorage({ get: vi.fn().mockResolvedValue(reports) });

    await expect(createLegacyReportsBackend(storage).readAll()).resolves.toEqual(reports);
    expect(storage.get).toHaveBeenCalledWith('saved-reports');
  });

  it('reads an empty map when nothing has ever been saved', async () => {
    await expect(createLegacyReportsBackend(makeStorage()).readAll()).resolves.toEqual({});
  });

  // The single report is the argument this backend ignores — the collection *is* the record.
  it.each([
    ['upsert', (backend: ReturnType<typeof createLegacyReportsBackend>) => backend.upsert(a, { a, b })],
    ['remove', (backend: ReturnType<typeof createLegacyReportsBackend>) => backend.remove(a, { a, b })],
    ['writeMigrated', (backend: ReturnType<typeof createLegacyReportsBackend>) => backend.writeMigrated([a], { a, b })],
  ])('writes the whole collection once on %s', async (_name, mutate) => {
    const storage = makeStorage();

    await mutate(createLegacyReportsBackend(storage));

    expect(storage.update).toHaveBeenCalledTimes(1);
    expect(storage.update).toHaveBeenCalledWith('saved-reports', { a, b });
  });

  it('reports that it cannot write before the web build has a configuration issue', async () => {
    const storage = makeStorage({ storageInitialized: vi.fn().mockResolvedValue(false) });

    await expect(createLegacyReportsBackend(storage).canWrite()).resolves.toBe(false);
  });
});
