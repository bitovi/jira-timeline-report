import type { FC, ReactNode } from 'react';
import type { CapacityOverrides, TeamCapacityOverride } from './types';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface CapacityOverridesContextValue {
  overrides: CapacityOverrides;
  setTeamOverride: (team: string, patch: TeamCapacityOverride) => void;
  clearTeamOverride: (team: string) => void;
}

const CapacityOverridesContext = createContext<CapacityOverridesContextValue | null>(null);

export const useCapacityOverrides = () => {
  const context = useContext(CapacityOverridesContext);

  if (!context) {
    throw new Error('Cannot use useCapacityOverrides outside of its provider');
  }

  return context;
};

/**
 * Session-only what-if changes to team scheduling inputs. Deliberately not URL-backed: a shared link
 * that silently rebuilt a plan on capacity that does not exist would be worse than losing the edit.
 */
export const CapacityOverridesProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [overrides, setOverrides] = useState<CapacityOverrides>({});

  const setTeamOverride = useCallback((team: string, patch: TeamCapacityOverride) => {
    setOverrides((previous) => ({ ...previous, [team]: { ...previous[team], ...patch } }));
  }, []);

  const clearTeamOverride = useCallback((team: string) => {
    setOverrides((previous) => {
      if (!(team in previous)) return previous;
      const { [team]: _removed, ...rest } = previous;
      return rest;
    });
  }, []);

  const value = useMemo(
    () => ({ overrides, setTeamOverride, clearTeamOverride }),
    [overrides, setTeamOverride, clearTeamOverride],
  );

  return <CapacityOverridesContext.Provider value={value}>{children}</CapacityOverridesContext.Provider>;
};
