import type { FC, ReactNode } from 'react';
import type { ReadCurrentAccountId } from './identity';
import type { StarsStore } from '../reports/stars-store';

import React, { createContext, useContext, useMemo } from 'react';

import { readNoAccountId } from './identity';
import { createLocalStarsStore } from '../reports/stars-store';

/**
 * The host-specific pieces the saved-reports UI needs to know who the user is. Built by the host
 * entry point (`forge.main.ts` / `web.main.ts`) next to `createStorage`, and provided once around
 * the app in `shared/main-helper.js` — portals (the Saved Reports page) still see it.
 */
export interface UserServices {
  readCurrentAccountId: ReadCurrentAccountId;
  starsStore: StarsStore;
  /**
   * Sends the user back through Atlassian's consent screen to pick up newly added scopes. Web only:
   * a Forge app's scopes come from the manifest, so there is nothing for a user to re-consent to.
   */
  reauthorize?: () => void;
}

const UserServicesContext = createContext<UserServices | null>(null);

/**
 * Outside a provider (tests, Storybook) there is no user: no account id, and stars kept in
 * localStorage under the un-suffixed key.
 */
const useFallbackServices = (): UserServices =>
  useMemo(() => ({ readCurrentAccountId: readNoAccountId, starsStore: createLocalStarsStore(readNoAccountId) }), []);

export const useUserServices = (): UserServices => {
  const services = useContext(UserServicesContext);
  const fallback = useFallbackServices();

  return services ?? fallback;
};

export const UserServicesProvider: FC<{ services: UserServices; children: ReactNode }> = ({ services, children }) => (
  <UserServicesContext.Provider value={services}>{children}</UserServicesContext.Provider>
);
