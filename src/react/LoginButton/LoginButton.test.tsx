import type { CanObservable } from '../hooks/useCanObservable';

import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import LoginButton from './LoginButton';

// Hand-rolled fake observable, matching the pattern in SampleDataNotice.test.tsx.
function fakeObservable<T>(value: T): CanObservable<T> {
  return {
    value,
    getData: () => value,
    get: () => value,
    on: vi.fn(),
    off: vi.fn(),
    set: vi.fn(),
  };
}

function renderButton({
  isLoggedIn = false,
  isPending = false,
}: {
  isLoggedIn?: boolean;
  isPending?: boolean;
} = {}) {
  const store = { login: vi.fn(), logout: vi.fn() };
  render(
    <LoginButton
      store={store}
      isLoggedInObservable={fakeObservable(isLoggedIn)}
      isPendingObservable={fakeObservable(isPending)}
    />,
  );
  return store;
}

describe('<LoginButton />', () => {
  it('renders the "Connecting" state while pending', () => {
    renderButton({ isPending: true, isLoggedIn: true });

    const button = screen.getByTestId('connecting-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Connecting');
    // pending takes precedence over logged-in
    expect(screen.queryByTestId('logout-button')).not.toBeInTheDocument();
  });

  it('renders the "Log Out" state when logged in', () => {
    renderButton({ isLoggedIn: true });

    const button = screen.getByTestId('logout-button');
    expect(button).toBeInTheDocument();
    // exact accessible name — the e2e auth suite depends on it
    expect(screen.getByRole('button', { name: 'Log Out' })).toBeInTheDocument();
  });

  it('renders the "Connect to Jira" state when logged out', () => {
    renderButton({ isLoggedIn: false });

    const button = screen.getByTestId('login-button');
    expect(button).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect to Jira' })).toBeInTheDocument();
  });

  it('calls store.login() when "Connect to Jira" is clicked', async () => {
    const user = userEvent.setup();
    const store = renderButton({ isLoggedIn: false });

    await user.click(screen.getByTestId('login-button'));

    expect(store.login).toHaveBeenCalledTimes(1);
    expect(store.logout).not.toHaveBeenCalled();
  });

  it('calls store.logout() when "Log Out" is clicked', async () => {
    const user = userEvent.setup();
    const store = renderButton({ isLoggedIn: true });

    await user.click(screen.getByTestId('logout-button'));

    expect(store.logout).toHaveBeenCalledTimes(1);
    expect(store.login).not.toHaveBeenCalled();
  });
});
