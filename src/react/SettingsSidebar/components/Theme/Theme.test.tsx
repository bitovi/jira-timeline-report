import type { ComponentProps } from 'react';
import type { AppStorage } from '../../../../jira/storage/common';

import React, { Suspense } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

/**
 * A save must be caused by an edit and by nothing else. When the panel decided whether to save by
 * diffing its working copy against the saved one, `save` changed the thing being diffed: any round
 * trip that came back different from what was written left the two unequal, and the panel saved
 * again — at roughly 3,500 writes/second, two config-issue searches apiece. Both cases below used to
 * exhaust the heap; each asserts a single attempt. See the revert of e528ebae.
 */
describe('Theme saving does not feed back on itself', () => {
  const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 1500)));

  it('attempts one save when the write fails, and rolls the color back', async () => {
    const update = vi.fn(async () => {
      throw new Error('nope');
    });

    renderWithWrappers({ storage: { update } });

    const blocked = await screen.findByLabelText<HTMLInputElement>('Blocked color');
    const before = blocked.value;

    fireEvent.change(blocked, { target: { value: '#123456' } });
    await settle();

    expect(update).toHaveBeenCalledTimes(1);
    expect((await screen.findByLabelText<HTMLInputElement>('Blocked color')).value).toBe(before);
  }, 10000);

  it('attempts one save when the write succeeds but reads back stale', async () => {
    // The theme is written with `PUT /rest/api/3/issue/:id` and read back through `/search/jql`,
    // which serves an index that lags the write — so a read right after a successful save can still
    // return the old colors. `get` here never reflects the write, the worst case of that lag.
    const update = vi.fn(async () => {});
    const get = vi.fn(async () => null);

    renderWithWrappers({ storage: { get, update } });

    fireEvent.change(await screen.findByLabelText('Blocked color'), { target: { value: '#123456' } });
    await settle();

    expect(update).toHaveBeenCalledTimes(1);
    // The working copy stands: a stale read must not drag the panel back to the old color.
    expect((await screen.findByLabelText<HTMLInputElement>('Blocked color')).value).toBe('#123456');
  }, 10000);

  it('coalesces a burst of color changes into one save', async () => {
    const update = vi.fn(async (_key: string, _value: unknown) => {});

    renderWithWrappers({ storage: { update } });

    const blocked = await screen.findByLabelText('Blocked color');

    // Dragging a color input fires continuously.
    fireEvent.change(blocked, { target: { value: '#111111' } });
    fireEvent.change(blocked, { target: { value: '#222222' } });
    fireEvent.change(blocked, { target: { value: '#333333' } });
    await settle();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining([{ label: 'Blocked', backgroundColor: '#333333' }]),
    );
  }, 10000);

  it('saves a pending change when the panel closes before the debounce elapses', async () => {
    const update = vi.fn(async (_key: string, _value: unknown) => {});

    const { unmount } = renderWithWrappers({ storage: { update } });

    fireEvent.change(await screen.findByLabelText('Blocked color'), { target: { value: '#abcdef' } });
    // No debounce wait: closing the settings panel used to clear the pending timeout and drop the
    // change. Unmounting flushes it instead — the tick is only for the mutation's own `onMutate`,
    // which react-query awaits before it calls storage.
    unmount();
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining([{ label: 'Blocked', backgroundColor: '#abcdef' }]),
    );
  });

  it('attempts one save when a font change fails', async () => {
    const update = vi.fn(async (_key: string, _value: unknown) => {
      throw new Error('nope');
    });

    renderWithWrappers({ storage: { update } });

    const select = await screen.findByLabelText('Font');

    fireEvent.focus(select);
    fireEvent.keyDown(select, { key: 'ArrowDown' });
    fireEvent.keyDown(select, { key: 'Enter' });
    await settle();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0]).toBe('themeFont');
  }, 10000);
});
