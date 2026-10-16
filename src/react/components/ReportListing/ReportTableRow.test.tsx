import type { Report } from '../../../jira/reports';
import type { ReportTableRowProps } from './ReportTableRow';

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { describeReport } from './describe-report';
import { ReportTableRow } from './ReportTableRow';

const described = (name: string, queryParams = 'primaryReportType=due&jql=project%3DECOM') =>
  describeReport({ id: name, name, queryParams } as Report);

const renderRow = (props: Partial<ReportTableRowProps> = {}) =>
  render(
    <div role="table">
      <ReportTableRow
        described={described('Alpha')}
        href="?report=alpha"
        isStarred={false}
        onToggleStar={vi.fn()}
        {...props}
      />
    </div>,
  );

/** The row's cells, in column order: star, name, owner, last updated, type, delete. */
const cell = (index: number) => screen.getAllByRole('cell')[index];
const OWNER = 2;
const UPDATED = 3;

describe('<ReportTableRow>', () => {
  it('renders the name as a link, the jql and the type badge', () => {
    renderRow();

    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '?report=alpha');
    expect(screen.getByText('project=ECOM')).toBeInTheDocument();
    expect(screen.getByText('Scatter Plot')).toBeInTheDocument();
  });

  it('hides the jql line on request', () => {
    renderRow({ showJql: false });

    expect(screen.queryByText('project=ECOM')).not.toBeInTheDocument();
  });

  it('labels the star by what clicking it will do', () => {
    const { rerender } = renderRow();

    expect(screen.getByRole('button', { name: 'Star Alpha' })).toBeInTheDocument();

    rerender(<ReportTableRow described={described('Alpha')} href="?report=alpha" isStarred onToggleStar={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Unstar Alpha' })).toBeInTheDocument();
  });

  // The buttons are siblings of the link, not children: a click must never open the report.
  it('toggles the star without following the link', async () => {
    const onToggleStar = vi.fn();
    const onLinkClick = vi.fn((event: Event) => event.preventDefault());
    renderRow({ onToggleStar });
    screen.getByRole('link', { name: 'Alpha' }).addEventListener('click', onLinkClick);

    await userEvent.click(screen.getByRole('button', { name: 'Star Alpha' }));

    expect(onToggleStar).toHaveBeenCalledTimes(1);
    expect(onLinkClick).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Alpha' })).not.toContainElement(
      screen.getByRole('button', { name: 'Star Alpha' }),
    );
  });

  it('deletes without following the link', async () => {
    const onDelete = vi.fn();
    const onLinkClick = vi.fn((event: Event) => event.preventDefault());
    renderRow({ onDelete });
    screen.getByRole('link', { name: 'Alpha' }).addEventListener('click', onLinkClick);

    await userEvent.click(screen.getByRole('button', { name: 'Delete Alpha' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onLinkClick).not.toHaveBeenCalled();
  });

  it('offers no delete button unless given onDelete', () => {
    renderRow();

    expect(screen.queryByRole('button', { name: 'Delete Alpha' })).not.toBeInTheDocument();
  });

  describe('owner', () => {
    it('says "You" for your own report', () => {
      renderRow({ isMine: true, ownerId: 'me' });

      expect(screen.getByText('You')).toBeInTheDocument();
    });

    it('says "Someone else" for a report another account owns, without a name or avatar', () => {
      const { container } = renderRow({ ownerId: 'ada' });

      expect(screen.getByText('Someone else')).toBeInTheDocument();
      expect(container.querySelector('img')).not.toBeInTheDocument();
    });

    it('shows a dash for a report with no recorded owner', () => {
      renderRow();

      expect(cell(OWNER)).toHaveTextContent('—');
    });
  });

  describe('last updated', () => {
    const now = new Date('2026-10-15T12:00:00.000Z');

    it('shows how long ago, with the exact timestamp on the <time> element', () => {
      renderRow({ updatedAt: '2026-10-12T09:30:00.000Z', now });

      const time = within(cell(UPDATED)).getByText('3 days ago');

      expect(time.tagName).toBe('TIME');
      expect(time).toHaveAttribute('dateTime', '2026-10-12T09:30:00.000Z');
    });

    it('shows a dash for a report saved before it was kept', () => {
      renderRow({ now });

      expect(cell(UPDATED)).toHaveTextContent('—');
    });

    it('shows a dash rather than "Invalid Date" for a mangled timestamp', () => {
      renderRow({ updatedAt: 'garbage', now });

      expect(cell(UPDATED)).toHaveTextContent('—');
    });
  });
});
