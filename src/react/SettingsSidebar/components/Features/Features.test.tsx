import type { AppStorage } from '../../../../jira/storage/common';
import type { ComponentProps } from 'react';

import React, { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Features from './Features';

const features = [
  { title: 'Estimation Progress', subtitle: '' },
  { title: 'Auto-Scheduler', subtitle: '' },
  { title: 'Estimation Analysis', subtitle: '' },
  // 'Secondary Report' was retired with the slot it gated; 'Cards' is the report it used to show.
  // See spec/018-card-report/alt-plan.md.
  { title: 'Cards', subtitle: 'Status and work-breakdown cards, one per issue' },
  { title: 'Work Breakdowns', subtitle: '' },
  {
    title: 'Reports Storage',
    subtitle: 'Choose where saved reports are stored, including one Jira work item per report.',
  },
];

import { StorageProvider } from '../../../services/storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlagsProvider } from '@atlaskit/flag';

type OverrideStorage = Omit<AppStorage, 'get'> & {
  get: (key: string) => any;
};

type RenderConfig = {
  props: ComponentProps<typeof Features>;
  storage: Partial<OverrideStorage>;
};

async function get<T>(key: string): Promise<T | null> {
  return null;
}

async function update<T>(key: string, updates: T): Promise<void> {}

const renderWithWrappers = (config?: Partial<RenderConfig>) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const { props, storage }: RenderConfig = {
    props: { onBackButtonClicked: vi.fn(), ...(config?.props ?? {}) },
    storage: {
      get,
      update,
      storageInitialized: async () => true,
      ...(config?.storage ?? {}),
    },
  };

  return render(
    <Suspense fallback="loading">
      <FlagsProvider>
        <StorageProvider storage={storage as ComponentProps<typeof StorageProvider>['storage']}>
          <QueryClientProvider client={queryClient}>
            <Features {...props} />
          </QueryClientProvider>
        </StorageProvider>
      </FlagsProvider>
    </Suspense>,
  );
};

describe('<Features />', () => {
  // `useUpdateFeatures` reloads the page on success; jsdom has no navigation, so the real one prints
  // "Not implemented" over the top of whatever the test was actually asserting. `reload` itself is
  // not redefinable, so the whole `location` is swapped for a stand-in carrying the fields anything
  // under test might read.
  const realLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: realLocation.href,
        origin: realLocation.origin,
        pathname: realLocation.pathname,
        search: realLocation.search,
        hash: realLocation.hash,
        reload: vi.fn(),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  });

  it('renders without crashing', async () => {
    renderWithWrappers(<Features />);

    const heading = await screen.findByText('Features');
    expect(heading).toBeInTheDocument();

    const description = screen.getByText(/turn on new features under active development/i);
    expect(description).toBeInTheDocument();

    features.forEach((feature) => {
      const featureText = screen.getByText(feature.title);

      expect(featureText).toBeInTheDocument();
    });

    const feedbackText = screen.getByText(/got feedback\?/i);
    expect(feedbackText).toBeInTheDocument();

    const feedbackLink = screen.getByRole('link', { name: /let us know on github/i });
    expect(feedbackLink).toBeInTheDocument();
  });

  // The toggle reveals a panel that repoints where every saved report on the site is read and
  // written, so it asks before writing the flag — not after, since `update` persists the whole set.
  it('confirms before turning Reports Storage on, and writes nothing if you cancel', async () => {
    const update = vi.fn().mockResolvedValue(undefined);

    renderWithWrappers({ storage: { update } });

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Reports Storage' }));

    expect(await screen.findByText('Turn on Reports Storage?')).toBeInTheDocument();
    expect(screen.getByText(/Jira admin/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Reports Storage' })).not.toBeChecked();
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('turns Reports Storage on once you continue', async () => {
    const update = vi.fn().mockResolvedValue(undefined);

    renderWithWrappers({ storage: { update } });

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Reports Storage' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith(
        'features',
        expect.objectContaining({
          reportsStorage: true,
        }),
      );
    });
  });

  // Off is the safe direction: the panel goes away and the storage pointer is left alone.
  it('does not confirm when turning Reports Storage off', async () => {
    const update = vi.fn().mockResolvedValue(undefined);

    renderWithWrappers({
      storage: { update, get: async () => ({ reportsStorage: true }) as any },
    });

    const toggle = await screen.findByRole('checkbox', { name: 'Reports Storage' });
    await waitFor(() => expect(toggle).toBeChecked());

    await userEvent.click(toggle);

    expect(screen.queryByText('Turn on Reports Storage?')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith(
        'features',
        expect.objectContaining({
          reportsStorage: false,
        }),
      );
    });
  });
});
