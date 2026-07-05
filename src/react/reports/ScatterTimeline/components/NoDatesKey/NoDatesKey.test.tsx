import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoDatesKey } from './NoDatesKey';
import { undatedIssues } from '../../fixtures';

afterEach(cleanup);

describe('NoDatesKey', () => {
  test('renders nothing when there are no undated issues', () => {
    const { container } = render(<NoDatesKey issues={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('shows the count of undated issues', () => {
    render(<NoDatesKey issues={undatedIssues} />);
    expect(screen.getByText(`${undatedIssues.length} without dates`)).toBeInTheDocument();
  });

  test('opens the modal listing the issues when clicked', async () => {
    const user = userEvent.setup();
    render(<NoDatesKey issues={undatedIssues} />);

    expect(screen.queryByText('Issues without dates')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /without dates/ }));

    expect(screen.getByText('Issues without dates')).toBeInTheDocument();
    for (const issue of undatedIssues) {
      expect(screen.getByText(issue.key)).toBeInTheDocument();
      expect(screen.getByText(issue.summary)).toBeInTheDocument();
    }
  });

  test('closes the modal when Close is clicked', async () => {
    const user = userEvent.setup();
    render(<NoDatesKey issues={undatedIssues} />);

    await user.click(screen.getByRole('button', { name: /without dates/ }));
    expect(screen.getByText('Issues without dates')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Issues without dates')).not.toBeInTheDocument();
  });
});
