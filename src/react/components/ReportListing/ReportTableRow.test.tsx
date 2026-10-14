import type { Report } from '../../../jira/reports';
import type { ReportTableRowProps } from './ReportTableRow';

import React from 'react';
import { render, screen } from '@testing-library/react';
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
      renderRow({ isMine: true, owner: { accountId: 'me', displayName: 'Arthur P' } });

      expect(screen.getByText('You')).toBeInTheDocument();
    });

    it("shows someone else's name, with initials when there is no avatar", () => {
      renderRow({ owner: { accountId: 'ada', displayName: 'Ada Lovelace', active: true } });

      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
      expect(screen.getByText('AL')).toBeInTheDocument();
    });

    it('shows the avatar when there is one', () => {
      const { container } = renderRow({
        owner: { accountId: 'ada', displayName: 'Ada Lovelace', avatarUrl: 'https://example.com/a.png' },
      });

      expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/a.png');
    });

    it('says "Former user" for a deactivated account', () => {
      renderRow({ owner: { accountId: 'gone', displayName: 'Gone Person', active: false } });

      expect(screen.getByText('Former user')).toBeInTheDocument();
      expect(screen.queryByText('Gone Person')).not.toBeInTheDocument();
    });

    it('says "Unknown" with no owner, or no name for one', () => {
      const { unmount } = renderRow();
      expect(screen.getByText('Unknown')).toBeInTheDocument();
      unmount();

      renderRow({ owner: { accountId: 'someone' } });
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });
});
