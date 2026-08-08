import type { ComponentProps } from 'react';
import type { AppStorage } from '../../../../jira/storage/common';

import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import StatusKey from './StatusKey';
import { StorageProvider } from '../../../services/storage';
import { defaultTheme } from '../../../../jira/theme';

const renderWithWrappers = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const storage = {
    get: async () => null,
    update: async () => {},
    storageInitialized: async () => true,
  } as unknown as AppStorage;

  return render(
    <Suspense fallback="loading">
      <StorageProvider storage={storage as ComponentProps<typeof StorageProvider>['storage']}>
        <QueryClientProvider client={queryClient}>
          <StatusKey />
        </QueryClientProvider>
      </StorageProvider>
    </Suspense>,
  );
};

describe('StatusKey', () => {
  it('renders a lozenge for every status', async () => {
    renderWithWrappers();

    for (const { label } of defaultTheme.filter(({ group }) => group === 'status')) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
  });

  it('leaves non-status theme entries out of the legend', async () => {
    renderWithWrappers();

    // Wait for the suspense boundary to resolve before asserting an absence.
    await screen.findByText('Complete');

    // The Section background is themeable but is not a status, so it must not appear as a key.
    expect(screen.queryByText('Section')).not.toBeInTheDocument();
  });
});
