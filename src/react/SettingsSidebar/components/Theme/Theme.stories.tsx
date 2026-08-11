import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import type { AppStorage } from '../../../../jira/storage/common';

import React, { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlagsProvider } from '@atlaskit/flag';

import Theme from './Theme';
import { StorageProvider } from '../../../services/storage';

/**
 * The Theme panel, credential-free: storage is an in-memory stub, so this renders and round-trips
 * saves without Jira. Wrapped at the real sidebar width (`w-80`) — the panel is designed against
 * that constraint, so reviewing it any wider is misleading.
 */
const inMemoryStorage = (): AppStorage => {
  const store: Record<string, unknown> = {};

  return {
    get: async (key: string, defaultShape?: unknown) => (store[key] ?? defaultShape ?? null) as any,
    update: async (key: string, value: unknown) => {
      store[key] = value;
    },
    storageInitialized: async () => true,
  } as unknown as AppStorage;
};

const meta = {
  title: 'Settings/Theme',
  component: Theme,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="w-80 border-r border-neutral-301 h-screen px-6 py-2 overflow-y-auto">
        <Suspense fallback="loading">
          <FlagsProvider>
            <StorageProvider storage={inMemoryStorage() as ComponentProps<typeof StorageProvider>['storage']}>
              <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <Story />
              </QueryClientProvider>
            </StorageProvider>
          </FlagsProvider>
        </Suspense>
      </div>
    ),
  ],
} satisfies Meta<typeof Theme>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
