import type { ComponentProps } from 'react';
import type { AppStorage } from '../../../../jira/storage/common';

import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlagsProvider } from '@atlaskit/flag';

import Theme from './Theme';
import { StorageProvider } from '../../../services/storage';

type OverrideStorage = Omit<AppStorage, 'get'> & {
  get: (key: string) => any;
};

type RenderConfig = {
  props: ComponentProps<typeof Theme>;
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
            <Theme {...props} />
          </QueryClientProvider>
        </StorageProvider>
      </FlagsProvider>
    </Suspense>,
  );
};

describe('Theme Component', () => {
  const mockOnBackButtonClicked = vi.fn();

  it('renders without crashing', async () => {
    renderWithWrappers({ props: { onBackButtonClicked: mockOnBackButtonClicked } });

    const themeHeading = await screen.findByText('Theme');
    expect(themeHeading).toBeInTheDocument();

    const reset = await screen.findByText('Reset theme');
    expect(reset).toBeInTheDocument();
  });
});
