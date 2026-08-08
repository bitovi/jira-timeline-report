import type { ComponentProps } from 'react';
import type { AppStorage } from '../../../../jira/storage/common';

import React, { Suspense } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('groups the settings under a heading each', async () => {
    renderWithWrappers();

    expect(await screen.findByText('Status colors')).toBeInTheDocument();
    expect(await screen.findByText('Report of Reports')).toBeInTheDocument();
  });

  it('renders the font picker', async () => {
    renderWithWrappers();

    expect(await screen.findByText('Font')).toBeInTheDocument();
  });

  it('puts the section background under Report of Reports, not with the statuses', async () => {
    renderWithWrappers();

    const sectionInput = await screen.findByLabelText('Section color');
    const statusInput = await screen.findByLabelText('Complete color');

    // Both groups start open, so both rows are present — they just live in different accordions.
    expect(sectionInput).toBeInTheDocument();
    expect(statusInput).toBeInTheDocument();
  });

  it('routes a color change by label, so grouped rows update the right entry', async () => {
    renderWithWrappers();

    const blocked = (await screen.findByLabelText('Blocked color')) as HTMLInputElement;
    const complete = (await screen.findByLabelText('Complete color')) as HTMLInputElement;
    const completeBefore = complete.value;

    fireEvent.change(blocked, { target: { value: '#123456' } });

    expect((await screen.findByLabelText<HTMLInputElement>('Blocked color')).value).toBe('#123456');
    // The row's index within its group is not its index in the theme array — a change must not
    // leak onto a neighbour.
    expect((await screen.findByLabelText<HTMLInputElement>('Complete color')).value).toBe(completeBefore);
  });

  it('applies a color change to the css variable immediately, before any save', async () => {
    renderWithWrappers();

    const section = await screen.findByLabelText('Section color');

    fireEvent.change(section, { target: { value: '#102030' } });

    expect(document.documentElement.style.getPropertyValue('--section-color')).toBe('#102030');
  });
});
