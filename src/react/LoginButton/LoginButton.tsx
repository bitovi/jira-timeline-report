import type { FC } from 'react';
import type { CanObservable } from '../hooks/useCanObservable';

import React from 'react';

import { useCanObservable } from '../hooks/useCanObservable';

/**
 * Actions the button triggers. Backed by the CanJS `Login` store, but typed
 * structurally so tests can pass a fake with spies.
 */
export interface LoginActions {
  login: () => void;
  logout: () => void;
}

interface LoginButtonProps {
  store: LoginActions;
  isLoggedInObservable: CanObservable<boolean>;
  isPendingObservable: CanObservable<boolean>;
}

// Shared button styling — preserved verbatim from the old <jira-login> element.
const buttonClass = 'p-1 block pointer bg-orange-400 text-white rounded-lg font-bitovipoppins font-lg font-bold';

/**
 * Thin React view of login state — one button in three states. Owns no auth
 * state; it reads the `Login` store observably and calls `store.login()` /
 * `store.logout()`.
 *
 * ⚠️ The exact labels ("Connecting" / "Log Out" / "Connect to Jira") and
 * testids ("connecting-button" / "logout-button" / "login-button") are load
 * bearing — `playwright/auth.setup.ts` and the authenticated e2e suite depend
 * on them. Do not change without updating those.
 */
const LoginButton: FC<LoginButtonProps> = ({ store, isLoggedInObservable, isPendingObservable }) => {
  const isPending = useCanObservable(isPendingObservable);
  const isLoggedIn = useCanObservable(isLoggedInObservable);

  if (isPending) {
    return (
      <button className={buttonClass} style={{ border: 'none' }} data-testid="connecting-button">
        Connecting
      </button>
    );
  }

  if (isLoggedIn) {
    return (
      <button
        className={buttonClass}
        style={{ border: 'none' }}
        data-testid="logout-button"
        onClick={() => store.logout()}
      >
        Log Out
      </button>
    );
  }

  return (
    <button className={buttonClass} style={{ border: 'none' }} data-testid="login-button" onClick={() => store.login()}>
      Connect to Jira
    </button>
  );
};

export default LoginButton;
