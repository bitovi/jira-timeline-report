import type { Jira } from '../../../jira-oidc-helpers';
import type { AppStorage } from '../../storage/common';

import { getReportsBackend, getReportsStorageConfig, initReportsStorage, resetReportsStorageForTests } from './index';

const makeStorage = (pointer: unknown): AppStorage =>
  ({
    get: vi.fn(async (key: string) => (key === 'reports-storage-config' ? pointer : {})),
    update: vi.fn().mockResolvedValue(undefined),
    storageInitialized: vi.fn().mockResolvedValue(true),
  }) as unknown as AppStorage;

const makeJira = () =>
  ({
    fetchAllJiraIssuesWithJQL: vi.fn().mockResolvedValue([]),
    createJiraIssue: vi.fn(),
    editJiraIssueWithNamedFields: vi.fn(),
  }) as unknown as Jira & { fetchAllJiraIssuesWithJQL: ReturnType<typeof vi.fn> };

describe('choosing a reports backend from the pointer', () => {
  beforeEach(() => {
    resetReportsStorageForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the legacy record when nothing has been configured', async () => {
    const storage = makeStorage(undefined);
    const jira = makeJira();

    void initReportsStorage({ storage, jiraHelpers: jira });

    await expect(getReportsBackend(storage).readAll()).resolves.toEqual({});
    expect(storage.get).toHaveBeenCalledWith('saved-reports');
    expect(jira.fetchAllJiraIssuesWithJQL).not.toHaveBeenCalled();
  });

  // The reason boot does not have to await the pointer read: a read issued while it is still in
  // flight waits for it rather than racing it into the wrong store.
  it('waits for the pointer read before touching either store', async () => {
    const storage = makeStorage({ kind: 'space', spaceName: 'STATREPS', spaceType: 'Story' });
    const jira = makeJira();

    // Deliberately not awaited — this is exactly what `main-helper.js` does.
    void initReportsStorage({ storage, jiraHelpers: jira });

    await expect(getReportsBackend(storage).readAll()).resolves.toEqual({});
    expect(jira.fetchAllJiraIssuesWithJQL).toHaveBeenCalledTimes(1);
    expect(storage.get).not.toHaveBeenCalledWith('saved-reports');
  });

  it('falls back to the legacy record for a pointer written by a newer client', async () => {
    const storage = makeStorage({ kind: 'forge-entity-property' });
    const jira = makeJira();

    await initReportsStorage({ storage, jiraHelpers: jira });

    expect(getReportsStorageConfig()).toEqual({ kind: 'legacy' });

    await getReportsBackend(storage).readAll();

    expect(storage.get).toHaveBeenCalledWith('saved-reports');
  });

  it('falls back to the legacy record when the pointer cannot be read at all', async () => {
    const storage = {
      get: vi.fn().mockRejectedValue(new Error('offline')),
      update: vi.fn(),
      storageInitialized: vi.fn().mockResolvedValue(true),
    } as unknown as AppStorage;

    await initReportsStorage({ storage, jiraHelpers: makeJira() });

    expect(getReportsStorageConfig()).toEqual({ kind: 'legacy' });
    expect(console.warn).toHaveBeenCalled();
  });
});
