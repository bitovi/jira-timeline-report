import type { ComponentProps } from 'react';
import type { MockInstance } from 'vitest';
import type { ReportsStorageConfig } from '../../../../jira/storage/reports-config';

import React, { Suspense } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlagsProvider } from '@atlaskit/flag';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import Storage from './Storage';
import { JiraProvider } from '../../../services/jira';
import { StorageProvider } from '../../../services/storage';
import { resetReportsStorageForTests } from '../../../../jira/reports/backend';

type AppStorage = ComponentProps<typeof StorageProvider>['storage'];
type Jira = ComponentProps<typeof JiraProvider>['jira'];

const makeStorage = (pointer: ReportsStorageConfig, savedReports: Record<string, unknown> = {}): AppStorage =>
  ({
    get: vi.fn(async (key: string) => (key === 'reports-storage-config' ? pointer : savedReports)),
    update: vi.fn().mockResolvedValue(undefined),
    storageInitialized: vi.fn().mockResolvedValue(true),
  }) as unknown as AppStorage;

const makeJira = (host: 'jira' | 'hosted') => {
  const jira = {
    host,
    fetchJiraProject: vi.fn().mockResolvedValue({ key: 'STATREPS', name: 'Status Reports' }),
    fetchProjectIssueTypes: vi.fn().mockResolvedValue({ issueTypes: [{ id: '1', name: 'Story' }] }),
    fetchIssueTypes: vi.fn().mockResolvedValue([{ id: '9', name: 'Site Wide Type' }]),
    fetchAllJiraIssuesWithJQL: vi.fn().mockResolvedValue([]),
    createJiraIssue: vi.fn(async () => ({ id: 'STATREPS-1', key: 'STATREPS-1' })),
    editJiraIssueWithNamedFields: vi.fn(),
  };

  return jira as unknown as Jira & typeof jira;
};

const renderStorage = ({ storage, jira }: { storage: AppStorage; jira: Jira }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <Suspense fallback="loading">
      <FlagsProvider>
        <StorageProvider storage={storage}>
          <JiraProvider jira={jira}>
            <QueryClientProvider client={queryClient}>
              <Storage />
            </QueryClientProvider>
          </JiraProvider>
        </StorageProvider>
      </FlagsProvider>
    </Suspense>,
  );
};

/**
 * The select stays disabled until this space's type list arrives, which is behind the 300ms debounce
 * on Space Name — so this waits for it rather than racing it, then opens the menu to reach an option.
 */
const chooseSpaceType = async (name: string) => {
  await waitFor(() => expect(screen.getByLabelText(/Space Type/)).toBeEnabled());
  await userEvent.click(screen.getByLabelText(/Space Type/));
  await userEvent.click(await screen.findByText(name));
};

/** Both cards carry a "Reports Space" radio, so every assertion has to say which card it means. */
const card = (title: 'Connect' | 'Web') => within(screen.getByRole('region', { name: `${title} storage` }));

describe('<Storage />', () => {
  // Restored individually, not through `vi.restoreAllMocks()`: that also resets the global
  // `window.matchMedia` stub in vitest.setup.ts, and `ModalTransition` reads it on every render.
  let warn: MockInstance;

  beforeEach(() => {
    resetReportsStorageForTests();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  // The other host's card documents how that host works; it does not show its state. A Connect app
  // property is a Connect-only resource the web build cannot read, so there is nothing live to show.
  it('renders both hosts and only lets you change the one you are in', async () => {
    renderStorage({ storage: makeStorage({ kind: 'legacy' }), jira: makeJira('jira') });

    expect(await screen.findByRole('region', { name: 'Connect storage' })).toBeInTheDocument();

    expect(card('Connect').getByRole('radio', { name: /Key\/Value/ })).toBeEnabled();
    expect(card('Connect').getByRole('radio', { name: /Key\/Value/ })).toBeChecked();

    expect(card('Web').getByRole('radio', { name: /Configuration Issue/ })).toBeDisabled();
    expect(card('Web').getByRole('radio', { name: /Configuration Issue/ })).not.toBeChecked();
    expect(card('Web').getByRole('radio', { name: /Reports Space/ })).not.toBeChecked();
  });

  // Same stored shape either way — only the label differs, because "app property" and "code block in
  // an issue" are what each host's users would recognise.
  it('labels the legacy option per host', async () => {
    renderStorage({ storage: makeStorage({ kind: 'legacy' }), jira: makeJira('hosted') });

    expect(await screen.findByRole('region', { name: 'Web storage' })).toBeInTheDocument();
    expect(card('Web').getByRole('radio', { name: /Configuration Issue/ })).toBeEnabled();
    expect(card('Connect').getByRole('radio', { name: /Key\/Value/ })).toBeDisabled();
  });

  it('shows the saved space when one is configured', async () => {
    const pointer: ReportsStorageConfig = { kind: 'space', spaceName: 'STATREPS', spaceType: 'Story' };

    renderStorage({ storage: makeStorage(pointer), jira: makeJira('jira') });

    expect(await screen.findByDisplayValue('STATREPS')).toBeInTheDocument();
    expect(card('Connect').getByRole('radio', { name: /Reports Space/ })).toBeChecked();
  });

  it('will not save a space with no key', async () => {
    const storage = makeStorage({ kind: 'legacy' });

    renderStorage({ storage, jira: makeJira('jira') });

    expect(await screen.findByRole('region', { name: 'Connect storage' })).toBeInTheDocument();

    await userEvent.click(card('Connect').getByRole('radio', { name: /Reports Space/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Enter the key of a space/)).toBeInTheDocument();
    expect(storage.update).not.toHaveBeenCalled();
  });

  // A typo would otherwise be indistinguishable from "all my reports are gone": the pointer would
  // save, the search would come back empty, and the legacy record — still intact — would be
  // invisible until the user found their way back to this panel.
  it('refuses to point at a space it cannot reach', async () => {
    const storage = makeStorage({ kind: 'space', spaceName: 'TYPO', spaceType: 'Story' });
    const jira = makeJira('jira');
    jira.fetchJiraProject.mockRejectedValue(new Error('404'));

    renderStorage({ storage, jira });

    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText(/Could not find a space with the key "TYPO"/)).toBeInTheDocument();
    });

    expect(storage.update).not.toHaveBeenCalled();
  });

  // The whole point of asking this space for its own types: a key that isn't there fails to load
  // them, and that is the earliest honest signal available. Falling back to the site-wide catalog
  // (which this hook used to do) would fill the dropdown with plausible types for a space that does
  // not exist, and hide the mistake until Save.
  it('says so under Space Name when the space cannot be read, and never offers site-wide types', async () => {
    const storage = makeStorage({ kind: 'legacy' });
    const jira = makeJira('jira');
    jira.fetchProjectIssueTypes.mockRejectedValue(new Error('404'));

    renderStorage({ storage, jira });

    expect(await screen.findByRole('region', { name: 'Connect storage' })).toBeInTheDocument();

    await userEvent.click(card('Connect').getByRole('radio', { name: /Reports Space/ }));
    await userEvent.type(screen.getByLabelText('Space Name'), 'TYPO');

    expect(await screen.findByText(/Could not read "TYPO"/)).toBeInTheDocument();
    expect(jira.fetchIssueTypes).not.toHaveBeenCalled();
    expect(screen.queryByText('Site Wide Type')).not.toBeInTheDocument();
  });

  // A reachable space you cannot create in would otherwise only fail on the first saved report —
  // or, during a migration, partway through one.
  it('says so when the space offers no work item types you can create', async () => {
    const jira = makeJira('jira');
    jira.fetchProjectIssueTypes.mockResolvedValue({ issueTypes: [] });

    renderStorage({ storage: makeStorage({ kind: 'space', spaceName: 'LOCKED', spaceType: 'Story' }), jira });

    expect(await screen.findByText(/You cannot create work items in "LOCKED"/)).toBeInTheDocument();
  });

  // One request per settled edit, not one per keystroke — every distinct key is its own query key,
  // so `staleTime` alone cannot collapse them.
  it('asks Jira once for a space name typed in one go', async () => {
    const jira = makeJira('jira');

    renderStorage({ storage: makeStorage({ kind: 'legacy' }), jira });

    expect(await screen.findByRole('region', { name: 'Connect storage' })).toBeInTheDocument();

    await userEvent.click(card('Connect').getByRole('radio', { name: /Reports Space/ }));
    await userEvent.type(screen.getByLabelText('Space Name'), 'STATREPS');

    await waitFor(() => {
      expect(jira.fetchProjectIssueTypes).toHaveBeenCalledWith('STATREPS');
    });

    expect(jira.fetchProjectIssueTypes).toHaveBeenCalledTimes(1);
  });

  // Reports created while pointed at a space live only there, so switching away stops listing them.
  // Shown only when true, so nobody who has never used a space is nagged by it.
  it('warns about leaving a space, and only then', async () => {
    renderStorage({
      storage: makeStorage({ kind: 'space', spaceName: 'STATREPS', spaceType: 'Story' }),
      jira: makeJira('jira'),
    });

    expect(await screen.findByRole('region', { name: 'Connect storage' })).toBeInTheDocument();
    expect(screen.queryByText(/stay there/)).not.toBeInTheDocument();

    await userEvent.click(card('Connect').getByRole('radio', { name: /Key\/Value/ }));

    expect(await screen.findByText(/stay there, but/)).toBeInTheDocument();
    expect(screen.getByText(/is selected. Switching back lists them again/)).toBeInTheDocument();
    // Names the space it is talking about — the space fields are hidden by now, so this is the warning.
    expect(screen.getByText('STATREPS')).toBeInTheDocument();
  });

  it('does not warn when the saved setting was never a space', async () => {
    renderStorage({ storage: makeStorage({ kind: 'legacy' }), jira: makeJira('jira') });

    expect(await screen.findByRole('region', { name: 'Connect storage' })).toBeInTheDocument();

    await userEvent.click(card('Connect').getByRole('radio', { name: /Reports Space/ }));
    await userEvent.click(card('Connect').getByRole('radio', { name: /Key\/Value/ }));

    expect(screen.queryByText(/stay there/)).not.toBeInTheDocument();
  });

  // This setting is itself a setting, so on the web build it needs the configuration issue to exist
  // even though the reports themselves are headed for a space. The raw store error names an internal
  // function; this one names the thing to go and create.
  it('says what to create when the web build has no configuration issue', async () => {
    const storage = makeStorage({ kind: 'legacy' });
    (storage.storageInitialized as unknown as MockInstance).mockResolvedValue(false);

    renderStorage({ storage, jira: makeJira('hosted') });

    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText(/Settings are stored in a Jira issue titled/)).toBeInTheDocument();
    });

    expect(storage.update).not.toHaveBeenCalled();
  });

  // The reported scenario: migrate 5, switch back to the legacy store, switch to the space again.
  // The copy correctly does nothing — every id is already there — and used to close the modal in
  // total silence, which is indistinguishable from a failed no-op.
  it('says nothing was copied when the space already holds every report', async () => {
    const gantt = { id: 'gantt', name: 'Gantt', queryParams: '' };
    const storage = makeStorage({ kind: 'legacy' }, { gantt });
    const jira = makeJira('jira');
    // The space already holds it, from an earlier migration.
    jira.fetchAllJiraIssuesWithJQL.mockResolvedValue([
      {
        key: 'STATREPS-1',
        fields: {
          summary: 'Gantt',
          description: {
            type: 'doc',
            content: [
              {
                type: 'codeBlock',
                attrs: { language: 'json' },
                content: [{ type: 'text', text: JSON.stringify(gantt) }],
              },
            ],
          },
        },
      },
    ]);

    renderStorage({ storage, jira });

    expect(await screen.findByRole('region', { name: 'Connect storage' })).toBeInTheDocument();

    await userEvent.click(card('Connect').getByRole('radio', { name: /Reports Space/ }));
    await userEvent.type(screen.getByLabelText('Space Name'), 'STATREPS');
    await chooseSpaceType('Story');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, migrate' }));

    expect(await screen.findByText(/were already in STATREPS, so nothing was copied/)).toBeInTheDocument();
    expect(jira.createJiraIssue).not.toHaveBeenCalled();
  });

  it('saves a reachable space', async () => {
    const storage = makeStorage({ kind: 'space', spaceName: 'STATREPS', spaceType: 'Story' });

    renderStorage({ storage, jira: makeJira('jira') });

    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(storage.update).toHaveBeenCalledWith('reports-storage-config', {
        kind: 'space',
        spaceName: 'STATREPS',
        spaceType: 'Story',
      });
    });
  });
});
