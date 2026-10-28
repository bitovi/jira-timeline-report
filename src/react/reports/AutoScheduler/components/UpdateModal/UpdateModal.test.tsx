import type { StatsUIData } from '../../scheduler/stats-analyzer';

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlagsProvider } from '@atlaskit/flag';

import UpdateModal from './UpdateModal';

const { editJiraIssueWithNamedFields, reloadIssues, setIsOpen } = vi.hoisted(() => ({
  editJiraIssueWithNamedFields: vi.fn(),
  reloadIssues: vi.fn(),
  setIsOpen: vi.fn(),
}));

vi.mock('../../../../services/jira', () => ({
  useJira: () => ({ fields: { idMap: {} }, editJiraIssueWithNamedFields }),
}));
vi.mock('../../../../services/issues', () => ({ useSelectedIssueType: () => ({ selectedIssueType: 'Epic' }) }));
vi.mock('../../../../hooks/useRouteData', () => ({ useRouteData: () => [true, setIsOpen] }));
vi.mock('../../../../../canjs/routing/route-data', () => ({
  default: {
    teamFieldLookUp: Promise.resolve({
      getFieldFor: ({ field }: { field: string }) => (field === 'startDateField' ? 'Start date' : 'Due date'),
    }),
  },
}));
vi.mock('../../../../../canjs/controls/timeline-configuration/state-helpers', () => ({ reloadIssues }));

const result = (key: string) => ({
  linkedIssue: {
    key,
    summary: `Summary of ${key}`,
    url: `#${key}`,
    hierarchyLevel: 1,
    team: { name: 'ORDER' },
    frozen: null,
    startDate: null,
    dueDate: null,
    derivedTiming: {},
    issue: { key },
  },
  startDayBottom: 0,
  startDateWithTimeEnoughToFinish: 0,
  dueDayBottom: 5,
  dueDayTop: 5,
});

const UI_DATA = { simulationIssueResults: [result('ORDER-1'), result('ORDER-2')] } as unknown as StatsUIData;

function renderModal() {
  render(
    <FlagsProvider>
      <QueryClientProvider client={new QueryClient()}>
        <UpdateModal issues={UI_DATA} startDate={new Date(Date.UTC(2026, 0, 5))} />
      </QueryClientProvider>
    </FlagsProvider>,
  );
}

async function updateAll() {
  const [selectAll] = screen.getAllByRole('checkbox');
  await userEvent.click(selectAll);
  await userEvent.click(screen.getByRole('button', { name: 'Update 2 Epics' }));
}

beforeEach(() => {
  editJiraIssueWithNamedFields.mockReset();
  reloadIssues.mockReset();
  setIsOpen.mockReset();
});

describe('UpdateModal', () => {
  it('reloads issues from Jira once the dates are saved, so the report shows the new dates', async () => {
    editJiraIssueWithNamedFields.mockResolvedValue({});
    renderModal();

    await updateAll();

    await waitFor(() => expect(reloadIssues).toHaveBeenCalledTimes(1));
    expect(setIsOpen).toHaveBeenCalledWith(false);
    // A 5-business-day bar from Monday ends Friday: Jira's due date is the last day worked.
    expect(editJiraIssueWithNamedFields).toHaveBeenCalledWith('ORDER-1', {
      'Start date': '2026-01-05',
      'Due date': '2026-01-09',
    });
  });

  it('after a partial failure, waits for the modal to close before reloading', async () => {
    editJiraIssueWithNamedFields
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ errorMessages: ['You do not have permission'] });
    renderModal();

    await updateAll();

    expect(await screen.findByText('You do not have permission')).toBeInTheDocument();
    expect(reloadIssues).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(reloadIssues).toHaveBeenCalledTimes(1);
  });

  it('does not reload when nothing was saved', async () => {
    editJiraIssueWithNamedFields.mockRejectedValue({ errorMessages: ['Nope'] });
    renderModal();

    await updateAll();
    await screen.findAllByText('Nope');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(reloadIssues).not.toHaveBeenCalled();
  });
});
