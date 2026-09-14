import type { FC, ReactNode } from 'react';
import type { NormalizeIssueConfig } from '../../../jira/normalized/normalize';
import type { CapacityOverrides, TeamCapacityOverride } from './types';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface CapacityOverridesContextValue {
  overrides: CapacityOverrides;
  setTeamOverride: (team: string, patch: TeamCapacityOverride) => void;
  clearTeamOverride: (team: string) => void;
  onTeamDataSaved?: (config: Partial<NormalizeIssueConfig>) => void;
}

const CapacityOverridesContext = createContext<CapacityOverridesContextValue | null>(null);

export const useCapacityOverrides = () => {
  const context = useContext(CapacityOverridesContext);

  if (!context) {
    throw new Error('Cannot use useCapacityOverrides outside of its provider');
  }

  return context;
};

interface CapacityOverridesProviderProps {
  children: ReactNode;
  /**
   * Run when a commit finishes writing team settings, with the normalize config derived from what was
   * saved. The shell uses it to refresh the base config a live override is layered onto — without it a
   * commit re-derives from the pre-commit base and the plan visibly snaps back.
   */
  onTeamDataSaved?: (config: Partial<NormalizeIssueConfig>) => void;
}

/**
 * Session-only what-if changes to team scheduling inputs. Deliberately not URL-backed: a shared link
 * that silently rebuilt a plan on capacity that does not exist would be worse than losing the edit.
 */
export const CapacityOverridesProvider: FC<CapacityOverridesProviderProps> = ({ children, onTeamDataSaved }) => {
  const [overrides, setOverrides] = useState<CapacityOverrides>({});

  // An explicit `undefined` removes the field rather than merging, so a value edited back to what is
  // saved stops being an override at all — which is what keeps "has an override" and "differs from
  // saved" the same question for every consumer of `overrides`.
  const setTeamOverride = useCallback((team: string, patch: TeamCapacityOverride) => {
    setOverrides((previous) => {
      const merged = { ...previous[team], ...patch };
      const next = Object.fromEntries(
        Object.entries(merged).filter(([, value]) => value !== undefined),
      ) as TeamCapacityOverride;

      if (Object.keys(next).length === 0) {
        if (!(team in previous)) return previous;
        const { [team]: _removed, ...rest } = previous;
        return rest;
      }

      return { ...previous, [team]: next };
    });
  }, []);

  const clearTeamOverride = useCallback((team: string) => {
    setOverrides((previous) => {
      if (!(team in previous)) return previous;
      const { [team]: _removed, ...rest } = previous;
      return rest;
    });
  }, []);

  const value = useMemo(
    () => ({ overrides, setTeamOverride, clearTeamOverride, onTeamDataSaved }),
    [overrides, setTeamOverride, clearTeamOverride, onTeamDataSaved],
  );

  return <CapacityOverridesContext.Provider value={value}>{children}</CapacityOverridesContext.Provider>;
};
