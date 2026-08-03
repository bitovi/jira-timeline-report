import type { AppStorage } from '../../storage/common';
import type { Reports } from '../fetcher';

import { persistMigrations, resetPersistMigrationsForTests } from './persist';

const reports: Reports = { r1: { id: 'r1', name: 'Migrated', queryParams: 'primaryReportType=table' } };
const migrated = { reports, changed: true, applied: ['table2-to-table'] };

const makeStorage = (overrides: Partial<AppStorage> = {}) =>
  ({
    get: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(undefined),
    storageInitialized: vi.fn().mockResolvedValue(true),
    ...overrides,
  }) as unknown as AppStorage;

describe('persistMigrations', () => {
  beforeEach(() => {
    resetPersistMigrationsForTests();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the migrated map once', async () => {
    const storage = makeStorage();

    await expect(persistMigrations(storage, migrated, { isLoggedIn: true })).resolves.toBe('written');
    expect(storage.update).toHaveBeenCalledWith('saved-reports', reports);
  });

  // The load-bearing guard. Without it this is a background write to org-shared data on every load.
  it('does not write when the read layer changed nothing', async () => {
    const storage = makeStorage();

    const result = await persistMigrations(storage, { reports, changed: false, applied: [] }, { isLoggedIn: true });

    expect(result).toBe('nothing-to-migrate');
    expect(storage.update).not.toHaveBeenCalled();
  });

  it('does not write for an anonymous sample-data session', async () => {
    const storage = makeStorage();

    await expect(persistMigrations(storage, migrated, { isLoggedIn: false })).resolves.toBe('not-logged-in');
    expect(storage.update).not.toHaveBeenCalled();
  });

  // The web backend's `update` throws without a configuration issue.
  it('does not write when storage is not initialized', async () => {
    const storage = makeStorage({ storageInitialized: vi.fn().mockResolvedValue(false) });

    await expect(persistMigrations(storage, migrated, { isLoggedIn: true })).resolves.toBe('storage-not-initialized');
    expect(storage.update).not.toHaveBeenCalled();
  });

  // `useAllReports` refetches on every invalidation, and every save invalidates.
  it('attempts at most once per session', async () => {
    const storage = makeStorage();

    await persistMigrations(storage, migrated, { isLoggedIn: true });
    const second = await persistMigrations(storage, migrated, { isLoggedIn: true });

    expect(second).toBe('already-attempted');
    expect(storage.update).toHaveBeenCalledTimes(1);
  });

  // Correctness never depends on the write: the read layer already normalized this session.
  it('swallows a failed write and reports it', async () => {
    const storage = makeStorage({ update: vi.fn().mockRejectedValue(new Error('403')) });

    await expect(persistMigrations(storage, migrated, { isLoggedIn: true })).resolves.toBe('failed');
    expect(console.warn).toHaveBeenCalled();
  });

  it('leaves the once-per-session latch alone when it had nothing to do, so a later fetch can still write', async () => {
    const storage = makeStorage();

    await persistMigrations(storage, { reports, changed: false, applied: [] }, { isLoggedIn: true });

    await expect(persistMigrations(storage, migrated, { isLoggedIn: true })).resolves.toBe('written');
  });
});
