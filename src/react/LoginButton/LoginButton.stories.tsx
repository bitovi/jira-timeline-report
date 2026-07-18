import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CanObservable } from '../hooks/useCanObservable';

import React from 'react';

import LoginButton from './LoginButton';

// A static fake observable — enough to render a single state in Storybook.
function fakeObservable<T>(value: T): CanObservable<T> {
  const noop = () => {};
  return { value, getData: () => value, get: () => value, on: noop, off: noop, set: noop };
}

const noopStore = {
  login: () => console.log('login()'),
  logout: () => console.log('logout()'),
};

const meta: Meta<typeof LoginButton> = {
  title: 'Shared/LoginButton',
  component: LoginButton,
};
export default meta;

type Story = StoryObj<typeof LoginButton>;

/** Auth in progress — button disabled-looking, shows "Connecting". */
export const Connecting: Story = {
  render: () => (
    <LoginButton
      store={noopStore}
      isPendingObservable={fakeObservable(true)}
      isLoggedInObservable={fakeObservable(false)}
    />
  ),
};

/** Not logged in — shows "Connect to Jira". */
export const LoggedOut: Story = {
  render: () => (
    <LoginButton
      store={noopStore}
      isPendingObservable={fakeObservable(false)}
      isLoggedInObservable={fakeObservable(false)}
    />
  ),
};

/** Logged in — shows "Log Out". */
export const LoggedIn: Story = {
  render: () => (
    <LoginButton
      store={noopStore}
      isPendingObservable={fakeObservable(false)}
      isLoggedInObservable={fakeObservable(true)}
    />
  ),
};
