import type { ComponentProps, FC, ReactNode } from 'react';
import type { PeekConnectProperty } from './connect-migration';

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JiraProvider } from '../jira';
import { StorageProvider } from '../storage';
import { connectMigrationKey, probeConnectData } from './connect-migration';
import { useMigrateConnectData } from './useMigrateConnectData';

type Storage = ComponentProps<typeof StorageProvider>['storage'];
type Jira = ComponentProps<typeof JiraProvider>['jira'];

const spacePointer = { kind: 'space', spaceName: 'STATREPS', spaceType: 'Story' };

const connectData: Record<string, unknown> = {
  'reports-storage-config': spacePointer,
  'saved-reports': { gantt: { id: 'gantt', name: 'Gantt', queryParams: '' } },
  'all-team-data': { __GLOBAL__: { velocityPerSprint: 21 } },
  theme: { primary: '#123456' },
  themeFont: { family: 'Inter' },
  features: { reportsStorage: true },
};

/** Reads out of a fixed Connect store; a key that was never written reads as `undefined`. */
const makePeek = (data: Record<string, unknown> = connectData) =>
  vi.fn(async (key: string) => data[key]) as unknown as PeekConnectProperty & ReturnType<typeof vi.fn>;

/** A KVS store that actually accumulates writes, in order, so a second run can see the first. */
const makeStorage = (initial: Record<string, unknown> = {}) => {
  const data: Record<string, unknown> = { ...initial };
  const writes: string[] = [];

  const storage = {
    get: vi.fn(async (key: string, defaultShape: unknown = {}) => (key in data ? data[key] : defaultShape)),
    update: vi.fn(async (key: string, value: unknown) => {
      writes.push(key);
      data[key] = value;
    }),
    storageInitialized: vi.fn().mockResolvedValue(true),
  };

  return { data, writes, storage: storage as unknown as Storage & typeof storage };
};

const renderMigrateHook = ({ storage, peek }: { storage: Storage; peek: PeekConnectProperty }) => {
  const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <StorageProvider storage={storage}>
      <JiraProvider jira={{ appKey: 'bitovi.status-report', host: 'forge' } as unknown as Jira}>
        {children}
      </JiraProvider>
    </StorageProvider>
  );

  return renderHook(() => useMigrateConnectData({ peek }), { wrapper });
};

const allGroups = ['reports', 'teams', 'appearance', 'features'] as const;

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('copying Connect app properties into KVS', () => {
  it('copies every key of every chosen group, overwriting what KVS held', async () => {
    const { data, storage } = makeStorage({ 'saved-reports': { test: { id: 'test', name: 'test' } } });
    const { result } = renderMigrateHook({ storage, peek: makePeek() });

    await act(async () => {
      const outcome = await result.current.migrate([...allGroups]);

      expect(outcome).toEqual({ copied: 4, total: 4, failures: [] });
    });

    for (const [key, value] of Object.entries(connectData)) {
      expect(data[key]).toEqual(value);
    }
  });

  it('copies only the groups it was asked for', async () => {
    const { data, storage } = makeStorage();
    const { result } = renderMigrateHook({ storage, peek: makePeek() });

    await act(async () => {
      await result.current.migrate(['teams']);
    });

    expect(data['all-team-data']).toEqual(connectData['all-team-data']);
    expect(data.theme).toBeUndefined();
    expect(data['saved-reports']).toBeUndefined();
  });

  it('skips a key Connect never wrote rather than writing undefined', async () => {
    const { writes, storage } = makeStorage();
    const { themeFont: _, ...withoutFont } = connectData;
    const { result } = renderMigrateHook({ storage, peek: makePeek(withoutFont) });

    await act(async () => {
      await result.current.migrate(['appearance']);
    });

    expect(writes).toEqual(['theme', connectMigrationKey]);
  });

  it('leaves the other groups copied when one fails, and names the failed one', async () => {
    const { data, storage } = makeStorage();
    const peek = makePeek();
    peek.mockImplementation(async (key: string) => {
      if (key === 'all-team-data') {
        throw new Error('no permission');
      }

      return connectData[key];
    });
    const { result } = renderMigrateHook({ storage, peek });

    await act(async () => {
      const outcome = await result.current.migrate([...allGroups]);

      expect(outcome).toEqual({ copied: 3, total: 4, failures: ['Team settings'] });
    });

    expect(data.features).toEqual(connectData.features);
    expect(data.theme).toEqual(connectData.theme);
    expect(result.current.progress.failures).toEqual(['Team settings']);
  });

  // "Press it again" repairs a partial run: overwrite needs no bookkeeping about what landed.
  it('succeeds on a re-run after a partial failure', async () => {
    const { data, storage } = makeStorage();
    storage.update.mockRejectedValueOnce(new Error('KVS hiccup'));
    const { result } = renderMigrateHook({ storage, peek: makePeek() });

    await act(async () => {
      const outcome = await result.current.migrate([...allGroups]);

      expect(outcome.failures).toEqual(['Saved reports']);
    });

    await act(async () => {
      const outcome = await result.current.migrate([...allGroups]);

      expect(outcome).toEqual({ copied: 4, total: 4, failures: [] });
    });

    expect(data['saved-reports']).toEqual(connectData['saved-reports']);
    expect(data[connectMigrationKey]).toBeDefined();
  });

  it('fails theme and font as one unit', async () => {
    const { storage } = makeStorage();
    const peek = makePeek();
    peek.mockImplementation(async (key: string) => {
      if (key === 'themeFont') {
        throw new Error('boom');
      }

      return connectData[key];
    });
    const { result } = renderMigrateHook({ storage, peek });

    await act(async () => {
      const outcome = await result.current.migrate(['appearance']);

      expect(outcome).toEqual({ copied: 0, total: 1, failures: ['Appearance'] });
    });

    // The whole group is read before any of it is written, so a failed font read leaves no theme.
    expect(storage.update).not.toHaveBeenCalled();
  });

  describe('with a space pointer', () => {
    it('copies the pointer and the blob, pointer first', async () => {
      const { data, writes, storage } = makeStorage();
      const { result } = renderMigrateHook({ storage, peek: makePeek() });

      await act(async () => {
        await result.current.migrate(['reports']);
      });

      expect(writes.slice(0, 2)).toEqual(['reports-storage-config', 'saved-reports']);
      expect(data['reports-storage-config']).toEqual(spacePointer);
      expect(data['saved-reports']).toEqual(connectData['saved-reports']);
    });

    // Forge stays on the space — correct — and a retry fills in the dormant blob.
    it('keeps the pointer in KVS when the blob write fails', async () => {
      const { data, storage } = makeStorage();
      const update = storage.update.getMockImplementation()!;
      storage.update.mockImplementation(async (key: string, value: unknown) => {
        if (key === 'saved-reports') {
          throw new Error('too big');
        }

        return update(key, value);
      });
      const { result } = renderMigrateHook({ storage, peek: makePeek() });

      await act(async () => {
        const outcome = await result.current.migrate(['reports']);

        expect(outcome.failures).toEqual(['Saved reports']);
      });

      expect(data['reports-storage-config']).toEqual(spacePointer);
      expect(data['saved-reports']).toBeUndefined();
    });
  });

  it('writes the flag only when nothing failed', async () => {
    const failing = makeStorage();
    failing.storage.update.mockRejectedValueOnce(new Error('KVS hiccup'));
    const { result: failed } = renderMigrateHook({ storage: failing.storage, peek: makePeek() });

    await act(async () => {
      await failed.current.migrate([...allGroups]);
    });

    expect(failing.data[connectMigrationKey]).toBeUndefined();

    const passing = makeStorage();
    const { result: passed } = renderMigrateHook({ storage: passing.storage, peek: makePeek() });

    await act(async () => {
      await passed.current.migrate(['teams', 'features']);
    });

    expect(passing.data[connectMigrationKey]).toEqual({
      migratedAt: expect.any(String),
      groups: ['teams', 'features'],
    });
  });

  it('never writes to the Connect store it reads from', async () => {
    const { storage } = makeStorage();
    const peek = makePeek();
    const { result } = renderMigrateHook({ storage, peek });

    await act(async () => {
      await result.current.migrate([...allGroups]);
    });

    // The peek is the only handle on Connect, and it is read-only by type; every write went to KVS.
    expect(storage.update.mock.calls.map(([key]) => key)).toEqual([
      'reports-storage-config',
      'saved-reports',
      'all-team-data',
      'theme',
      'themeFont',
      'features',
      connectMigrationKey,
    ]);
  });
});

describe('probing the Connect store', () => {
  it('offers nothing when Connect only holds seeded defaults', async () => {
    const probe = await probeConnectData(
      makePeek({ 'reports-storage-config': { kind: 'legacy' }, 'saved-reports': {}, features: {}, theme: {} }),
    );

    expect(probe.available).toEqual([]);
  });

  it('offers the reports group for a space pointer even with an empty blob', async () => {
    const probe = await probeConnectData(makePeek({ 'reports-storage-config': spacePointer, 'saved-reports': {} }));

    expect(probe.available).toEqual(['reports']);
    expect(probe.reportsConfig).toEqual(spacePointer);
  });

  it('counts the reports in the blob', async () => {
    const probe = await probeConnectData(makePeek());

    expect(probe.available).toEqual([...allGroups]);
    expect(probe.reportCount).toBe(1);
  });
});
