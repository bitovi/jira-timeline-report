import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from './LoginPage';

describe('LoginPage', () => {
  const mockProps = {
    onJiraLogin: vi.fn(),
    onGuestAccess: vi.fn(),
    isLoginPending: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the login page with all elements', () => {
    render(<LoginPage {...mockProps} />);

    expect(screen.getByText('Status Reports for Jira')).toBeInTheDocument();
    expect(screen.getByTestId('jira-login-button')).toBeInTheDocument();
    expect(screen.getByTestId('guest-access-button')).toBeInTheDocument();
    expect(screen.getByText('Connect to Jira:')).toBeInTheDocument();
    expect(screen.getByText('Try as Guest:')).toBeInTheDocument();
  });

  it('calls onJiraLogin when Jira login button is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginPage {...mockProps} />);

    const jiraButton = screen.getByTestId('jira-login-button');
    await user.click(jiraButton);

    expect(mockProps.onJiraLogin).toHaveBeenCalledTimes(1);
  });

  it('calls onGuestAccess when guest button is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginPage {...mockProps} />);

    const guestButton = screen.getByTestId('guest-access-button');
    await user.click(guestButton);

    expect(mockProps.onGuestAccess).toHaveBeenCalledTimes(1);
  });

  it('shows loading state for Jira login', async () => {
    const user = userEvent.setup();
    render(<LoginPage {...mockProps} isLoginPending={true} />);

    // First click to set selectedOption to 'jira'
    const jiraButton = screen.getByTestId('jira-login-button');
    await user.click(jiraButton);

    // Re-render with pending state
    render(<LoginPage {...mockProps} isLoginPending={true} />);

    expect(screen.getByText('Connect to Jira')).toBeInTheDocument();
  });

  it('disables buttons when login is pending', () => {
    render(<LoginPage {...mockProps} isLoginPending={true} />);

    expect(screen.getByTestId('jira-login-button')).toBeDisabled();
    expect(screen.getByTestId('guest-access-button')).toBeDisabled();
  });

  it('includes external links', () => {
    render(<LoginPage {...mockProps} />);

    const bitoviLink = screen.getByText('Bitovi').closest('a');
    const githubLink = screen.getByText('View on GitHub').closest('a');

    expect(bitoviLink).toHaveAttribute('href', 'https://www.bitovi.com/services/agile-project-management-consulting');
    expect(githubLink).toHaveAttribute('href', 'https://github.com/bitovi/jira-timeline-report');
  });
});
