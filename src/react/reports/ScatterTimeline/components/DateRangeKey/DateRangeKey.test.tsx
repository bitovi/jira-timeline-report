import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangeKey } from './DateRangeKey';
import { undatedIssues } from '../../fixtures';

afterEach(cleanup);

describe('DateRangeKey', () => {
  test('renders nothing when no date range is active', () => {
    const { container } = render(<DateRangeKey issues={[]} hasDateRange={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing when no date range is active, even with issues passed in', () => {
    const { container } = render(<DateRangeKey issues={undatedIssues} hasDateRange={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('shows a "0 outside date range" count when a range is active but nothing is excluded', () => {
    render(<DateRangeKey issues={[]} hasDateRange={true} />);
    expect(screen.getByText('0 outside date range')).toBeInTheDocument();
  });

  test('shows the count of excluded issues when a range is active', () => {
    render(<DateRangeKey issues={undatedIssues} hasDateRange={true} />);
    expect(screen.getByText(`${undatedIssues.length} outside date range`)).toBeInTheDocument();
  });

  test('opens the modal listing the issues when clicked', async () => {
    const user = userEvent.setup();
    render(<DateRangeKey issues={undatedIssues} hasDateRange={true} />);

    expect(screen.queryByText('Issues outside date range')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /outside date range/ }));

    expect(screen.getByText('Issues outside date range')).toBeInTheDocument();
    for (const issue of undatedIssues) {
      expect(screen.getByText(issue.key)).toBeInTheDocument();
      expect(screen.getByText(issue.summary)).toBeInTheDocument();
    }
  });

  test('closes the modal when Close is clicked', async () => {
    const user = userEvent.setup();
    render(<DateRangeKey issues={undatedIssues} hasDateRange={true} />);

    await user.click(screen.getByRole('button', { name: /outside date range/ }));
    expect(screen.getByText('Issues outside date range')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Issues outside date range')).not.toBeInTheDocument();
  });
});
