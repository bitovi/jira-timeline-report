import type { AppStorage } from '../../jira/storage/common';

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SaveReportsWrapper from './SaveReportsWrapper';
import { ReportLayoutProvider } from '../services/report-layout';
import { UserServicesProvider } from '../services/user';
import { createLocalStarsStore } from '../services/reports';
import { queryClient } from '../services/query';

// Creating reads the report's settings off `routeData.serialize()`. The real route data is a CanJS
// proxy (no spying) whose serialize evaluates the issues request, which fetches from Jira and rejects
// in the background with nobody logged in. These tests only count saved reports, not their contents.
vi.mock('../../canjs/routing/route-data', () => ({
  default: { serialize: () => ({ jql: 'project=ECOM' }) },
}));

const observable = <T,>(value: T) => ({
  on: vi.fn(),
  off: vi.fn(),
  getData: vi.fn(),
  value,
  set: vi.fn(),
  get: vi.fn(),
});

/**
 * Creating a report waits on the account-id lookup (to stamp `ownerId`) before it saves. On Forge an
 * uncached lookup is a real round trip, so these hold it open and check nothing slips through.
 */
describe('creating a report while the account id is still being looked up', () => {
  let releaseAccountId: (id: string) => void;
  let update: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient.clear();
    window.history.replaceState(null, '', '/?jql=project%3DECOM');

    const pendingAccountId = new Promise<string>((resolve) => {
      releaseAccountId = resolve;
    });
    const readCurrentAccountId = vi.fn(() => pendingAccountId);
    update = vi.fn().mockResolvedValue(undefined);

    render(
      <UserServicesProvider
        services={{ readCurrentAccountId, starsStore: createLocalStarsStore(readCurrentAccountId) }}
      >
        <ReportLayoutProvider>
          <SaveReportsWrapper
            linkBuilder={(query) => query}
            shouldShowReportsObservable={observable(true)}
            storage={
              {
                get: vi.fn().mockResolvedValue({}),
                storageInitialized: async () => true,
                update,
              } as unknown as AppStorage
            }
            onViewReportsButtonClicked={vi.fn()}
            queryParamObservable={observable('?jql=project%3DECOM')}
          />
        </ReportLayoutProvider>
      </UserServicesProvider>,
    );
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  const openAndConfirm = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Save report' }));

    // The modal reads `form.name.value`. Browsers resolve `form.name` to the field named "name"
    // (forms let named fields override built-ins); jsdom returns the form's own empty `name`
    // attribute instead, so give the form what a browser would.
    const input = await screen.findByRole('textbox', { name: /name/i });
    Object.defineProperty(input.closest('form')!, 'name', { configurable: true, get: () => input });

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  };

  // One test, not two: it has to release the lookup before it ends, or the next test's cache clear
  // cancels it and the cancellation rejects in the background.
  it('disables the modal from the first Confirm and saves one report however many times it is submitted', async () => {
    await openAndConfirm();

    // Still looking up the account id: nothing saved, and both buttons already disabled.
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    // The button is disabled now; submit the form directly, as a second Enter would.
    screen.getByRole('textbox', { name: /name/i }).closest('form')!.requestSubmit();

    releaseAccountId('acct-me');

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));

    const [, reports] = update.mock.calls[0] as [string, Record<string, { ownerId?: string }>];

    expect(Object.values(reports)).toHaveLength(1);
    expect(Object.values(reports)[0].ownerId).toBe('acct-me');
  });
});
