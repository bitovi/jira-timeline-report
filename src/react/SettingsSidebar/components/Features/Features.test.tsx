import type { AppStorage } from '../../../../jira/storage/common';
import type { ComponentProps } from 'react';

import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';

import Features from './Features';

const features = [
  { title: 'Estimation Progress', subtitle: '' },
  { title: 'Auto-Scheduler', subtitle: '' },
  { title: 'Estimation Analysis', subtitle: '' },
  { title: 'Estimation Table', subtitle: '' },
  { title: 'Secondary Report', subtitle: '' },
  { title: 'Work Breakdowns', subtitle: '' },
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
});
