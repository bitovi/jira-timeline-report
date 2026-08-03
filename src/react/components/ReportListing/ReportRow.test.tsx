import type { Report } from '../../../jira/reports';

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { describeReport } from './describe-report';
import { ReportRow } from './ReportRow';

const described = (name: string, queryParams = '') => describeReport({ id: name, name, queryParams } as Report);

describe('<ReportRow>', () => {
  it('renders the name, the type badge and the jql', () => {
    render(<ReportRow described={described('Alpha', 'primaryReportType=due&jql=project%3DECOM')} onSelect={vi.fn()} />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Scatter Plot')).toBeInTheDocument();
    expect(screen.getByText('project=ECOM')).toBeInTheDocument();
  });

  it('exposes only the report name as the accessible name', () => {
    render(<ReportRow described={described('Alpha', 'primaryReportType=due&jql=project%3DECOM')} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
  });

  it('calls onSelect when the button row is clicked', async () => {
    const onSelect = vi.fn();
    render(<ReportRow described={described('Alpha')} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: 'Alpha' }));

    expect(onSelect).toHaveBeenCalled();
  });

  it('renders a link when given an href', () => {
    render(<ReportRow described={described('Alpha')} href="?report=alpha" />);

    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '?report=alpha');
  });

  it('highlights the query within the name', () => {
    const { container } = render(<ReportRow described={described('Alpha')} query="alp" onSelect={vi.fn()} />);

    expect(container.querySelector('mark')).toHaveTextContent('Alp');
  });

  it('renders trailing content outside the interactive element', () => {
    render(
      <ReportRow
        described={described('Alpha')}
        href="?report=alpha"
        trailing={<button type="button">Manage</button>}
      />,
    );

    const manage = screen.getByRole('button', { name: 'Manage' });

    expect(manage).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alpha' })).not.toContainElement(manage);
  });
});
