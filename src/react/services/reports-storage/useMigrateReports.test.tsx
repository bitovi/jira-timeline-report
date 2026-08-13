import type { ComponentProps, FC, ReactNode } from 'react';
import type { Report, Reports } from '../../../jira/reports';

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JiraProvider } from '../jira';
import { StorageProvider } from '../storage';
import { useMigrateReports } from './useMigrateReports';

const gantt: Report = { id: 'gantt', name: 'Gantt', queryParams: 'primaryReportType=start-due' };
const table: Report = { id: 'table', name: 'Table', queryParams: 'primaryReportType=table' };

type Storage = ComponentProps<typeof StorageProvider>['storage'];
type Jira = ComponentProps<typeof JiraProvider>['jira'];

const makeStorage = (reports: Reports): Storage =>
  ({
    get: vi.fn().mockResolvedValue(reports),
    update: vi.fn().mockResolvedValue(undefined),
    storageInitialized: vi.fn().mockResolvedValue(true),
  }) as unknown as Storage;

/** A space that actually accumulates what gets created in it, so a second run can see the first. */
const makeSpace = () => {
  const issues: Array<{ key: string; fields: { summary: string; description: unknown } }> = [];

  const jira = {
    fetchAllJiraIssuesWithJQL: vi.fn(async () => issues),
    createJiraIssue: vi.fn(async (fields: Record<string, any>) => {
      const key = `STATREPS-${issues.length + 1}`;

      issues.push({ key, fields: { summary: fields.summary, description: fields.description } });

      return { id: key, key };
    }),
    editJiraIssueWithNamedFields: vi.fn(async () => undefined),
  };

  return { issues, jira: jira as unknown as Jira & typeof jira };
};

const renderMigrateHook = ({ storage, jira }: { storage: Storage; jira: Jira }) => {
  const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <StorageProvider storage={storage}>
      <JiraProvider jira={jira}>{children}</JiraProvider>
    </StorageProvider>
  );

  return renderHook(() => useMigrateReports(), { wrapper });
};

describe('migrating saved reports into a space', () => {
  it('creates one work item per legacy report', async () => {
    const storage = makeStorage({ gantt, table });
    const { jira } = makeSpace();
    const { result } = renderMigrateHook({ storage, jira });

    await act(async () => {
      const outcome = await result.current.migrate({ spaceName: 'STATREPS', spaceType: 'Story' });

      expect(outcome).toEqual({ copied: 2, total: 2, alreadyThere: 0, failures: [] });
    });

    expect(jira.createJiraIssue).toHaveBeenCalledTimes(2);
    expect(jira.createJiraIssue.mock.calls.map(([fields]) => fields.summary)).toEqual(['Gantt', 'Table']);
  });

  // One search, then one create per *missing* report — the id→work-item map the first listing builds
  // is what every `upsert` answers from, so report count doesn't multiply the reads.
  it('lists the space once however many reports it copies', async () => {
    const { jira } = makeSpace();
    const { result } = renderMigrateHook({ storage: makeStorage({ gantt, table }), jira });

    await act(async () => {
      await result.current.migrate({ spaceName: 'STATREPS', spaceType: 'Story' });
    });

    expect(jira.fetchAllJiraIssuesWithJQL).toHaveBeenCalledTimes(1);
  });

  // "Just press it again" has to be the right answer to a half-finished copy, which it only is if
  // re-running repairs rather than duplicates. Matched on `report.id`, not on the summary.
  it('copies nothing the second time, so a re-run repairs instead of duplicating', async () => {
    const storage = makeStorage({ gantt, table });
    const { jira } = makeSpace();
    const { result } = renderMigrateHook({ storage, jira });

    await act(async () => {
      await result.current.migrate({ spaceName: 'STATREPS', spaceType: 'Story' });
    });

    await act(async () => {
      const outcome = await result.current.migrate({ spaceName: 'STATREPS', spaceType: 'Story' });

      // `alreadyThere` is what the panel needs to say "nothing was copied because they're all
      // there" instead of closing the modal in silence.
      expect(outcome).toEqual({ copied: 0, total: 0, alreadyThere: 2, failures: [] });
    });

    expect(jira.createJiraIssue).toHaveBeenCalledTimes(2);
  });

  // Reported by name so the user knows which ones to retry, and — critically — the caller leaves the
  // pointer alone, so the app keeps reading the legacy record that still holds everything.
  it('names the reports it could not copy and keeps going', async () => {
    const storage = makeStorage({ gantt, table });
    const { jira } = makeSpace();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    jira.createJiraIssue.mockRejectedValueOnce(new Error('no permission'));

    const { result } = renderMigrateHook({ storage, jira });

    await act(async () => {
      const outcome = await result.current.migrate({ spaceName: 'STATREPS', spaceType: 'Story' });

      expect(outcome).toEqual({ copied: 1, total: 2, alreadyThere: 0, failures: ['Gantt'] });
    });

    vi.restoreAllMocks();
  });

  it('never touches the legacy record it is copying out of', async () => {
    const storage = makeStorage({ gantt, table });
    const { jira } = makeSpace();
    const { result } = renderMigrateHook({ storage, jira });

    await act(async () => {
      await result.current.migrate({ spaceName: 'STATREPS', spaceType: 'Story' });
    });

    expect(storage.update).not.toHaveBeenCalled();
  });
});
