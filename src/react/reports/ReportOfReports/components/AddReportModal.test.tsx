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
});
