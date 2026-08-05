import type { FC, ReactNode } from 'react';
import type { AppStorage } from '../../../jira/storage/common';
import type { Reports } from '../../../jira/reports';

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlagsProvider } from '@atlaskit/flag';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { StorageProvider } from '../storage';
import { useCreateReport, useUpdateReport } from './useSaveReports';
import { reportKeys } from './key-factory';
import routeData from '../../../canjs/routing/route-data';

const existing = {
  id: 'existing',
  name: 'Existing',
  queryParams: 'report=existing&jql=project%3DORDER&primaryReportType=start-due',
};

const makeStorage = (update = vi.fn().mockResolvedValue(undefined)): AppStorage =>
  ({
    get: vi.fn().mockResolvedValue({}),
    update,
    storageInitialized: async () => true,
  }) as unknown as AppStorage;

const renderSaveHook = <THook,>(hook: () => THook, { storage = makeStorage() } = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });

  // Seeded rather than fetched: both hooks read the current map straight out of the cache, which in
  // the app is filled by `useAllReports` before either can be reached.
  queryClient.setQueryData<Reports>(reportKeys.allReports, { existing });

  const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <StorageProvider storage={storage}>
      <FlagsProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </FlagsProvider>
    </StorageProvider>
  );

  return { ...renderHook(hook, { wrapper }), queryClient };
};

/** What `route-data.js` resolves for the open report — the record every setting falls back to. */
const reportDataFor = (id: string) => (routeData.reportsData as unknown as Reports | undefined)?.[id];

describe('saving a report', () => {
  beforeEach(() => {
    // @ts-ignore — the app's boot fetch seeds this; each test starts from the pre-save map.
    routeData.reportsData = { existing };
  });

  // Saving points the URL at `?report=<id>` and nothing refetches (see the `onSettled` note in
  // useSaveReports.tsx), so a `reportsData` left behind by the save is what the report renders
  // from: no record at all for a new id, which resolves `jql` to '' — "Configure a JQL in the
  // sidebar" over a report that was just saved with one.
  it('publishes a created report to routeData before anything can read it back', async () => {
    const created = { id: 'new-report', name: 'New', queryParams: 'report=new-report&jql=project%3DECOM' };
    const { result } = renderSaveHook(() => useCreateReport());

    act(() => {
      result.current.createReport(created);
    });

    await waitFor(() => {
      expect(reportDataFor('new-report')).toMatchObject(created);
    });

    expect(reportDataFor('existing')).toMatchObject(existing);
  });

  it('publishes an updated report to routeData, so the save does not silently revert', async () => {
    const { result } = renderSaveHook(() => useUpdateReport());

    result.current.updateReport('existing', { queryParams: 'report=existing&jql=project%3DECOM' });

    await waitFor(() => {
      expect(reportDataFor('existing')?.queryParams).toBe('report=existing&jql=project%3DECOM');
    });
  });

  it('rolls routeData back with the cache when the save fails', async () => {
    const storage = makeStorage(vi.fn().mockRejectedValue(new Error('storage is down')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result, queryClient } = renderSaveHook(() => useCreateReport(), { storage });

    result.current.createReport({ id: 'doomed', name: 'Doomed', queryParams: 'report=doomed' });

    await waitFor(() => {
      expect(queryClient.getQueryData<Reports>(reportKeys.allReports)).toEqual({ existing });
    });

    expect(reportDataFor('doomed')).toBeUndefined();
    expect(reportDataFor('existing')).toMatchObject(existing);
  });
});
