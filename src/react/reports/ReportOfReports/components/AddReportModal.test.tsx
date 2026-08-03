import type { Report } from '../../../../jira/reports';

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AddReportModal } from './AddReportModal';

const report = (id: string, name: string): Report => ({ id, name, queryParams: `jql=project%3D${id}` });

const renderModal = (overrides: Partial<React.ComponentProps<typeof AddReportModal>> = {}) => {
  const props = {
    isOpen: true,
    reports: [report('a', 'Alpha'), report('b', 'Beta')],
    onSelect: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };

  render(<AddReportModal {...props} />);

  return props;
};

describe('<AddReportModal>', () => {
  it('lists the reports it is given', async () => {
    renderModal();

    expect(await screen.findByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beta' })).toBeInTheDocument();
  });

  it('reports the chosen report id', async () => {
    const { onSelect } = renderModal();

    await userEvent.click(await screen.findByRole('button', { name: 'Beta' }));

    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('explains itself when there is nothing left to add', async () => {
    renderModal({ reports: [] });

    expect(await screen.findByText(/No other saved reports/)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole('button', { name: 'Alpha' })).not.toBeInTheDocument();
  });

  it('closes on cancel', async () => {
    const { onClose } = renderModal();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });

  it("shows each report's type as a badge", async () => {
    renderModal({
      reports: [{ id: 'a', name: 'Alpha', queryParams: 'primaryReportType=due' }],
    });

    expect(await screen.findByText('Scatter Plot')).toBeInTheDocument();
  });

  it('filters by name as the user types', async () => {
    renderModal({
      reports: [
        { id: 'a', name: 'Alpha', queryParams: 'primaryReportType=due' },
        { id: 'b', name: 'Beta', queryParams: 'primaryReportType=table' },
      ],
    });

    await userEvent.type(screen.getByRole('textbox'), 'alph');

    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Beta' })).not.toBeInTheDocument();
  });

  it('matches on report type too', async () => {
    renderModal({ reports: [{ id: 'b', name: 'Beta', queryParams: 'primaryReportType=table' }] });

    await userEvent.type(screen.getByRole('textbox'), 'table');

    expect(screen.getByRole('button', { name: 'Beta' })).toBeInTheDocument();
  });

  it('shows a search-specific empty state when nothing matches', async () => {
    renderModal();

    await userEvent.type(screen.getByRole('textbox'), 'zzz');

    expect(screen.getByText(/No reports match/)).toBeInTheDocument();
  });

  it('selects the top filtered report on Enter', async () => {
    const { onSelect } = renderModal({
      reports: [
        { id: 'a', name: 'Alpha', queryParams: 'primaryReportType=due' },
        { id: 'b', name: 'Beta', queryParams: 'primaryReportType=table' },
      ],
    });

    await userEvent.type(screen.getByRole('textbox'), 'alph');
    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('a');
  });
});
