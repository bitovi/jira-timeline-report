import type { FC, ReactNode } from 'react';
import type { NormalizeIssueConfig } from '../../../jira/normalized/normalize';
import type { CapacityOverrides, SavedTeamCapacities, TeamCapacity, TeamCapacityOverride } from './types';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface CapacityOverridesContextValue {
  overrides: CapacityOverrides;
  savedCapacity: SavedTeamCapacities;
  setTeamOverride: (team: string, patch: TeamCapacityOverride) => void;
  clearTeamOverride: (team: string) => void;
  rememberSavedCapacity: (team: string, values: TeamCapacity) => void;
  commitSavedCapacity: (team: string, values: TeamCapacity) => void;
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
 *
 * Also holds each team's saved baseline, because the row that edits it is unmounted and remounted
 * every time an override re-derives the report — component state there cannot survive to say what an
 * override is a change *from*.
 */
export const CapacityOverridesProvider: FC<CapacityOverridesProviderProps> = ({ children, onTeamDataSaved }) => {
  // Overrides and baselines share one state so an update can read both: recording a baseline has to
  // know whether the team is currently overridden, and a commit has to move one while dropping the other.
  const [{ overrides, savedCapacity }, setState] = useState<CapacityState>({ overrides: {}, savedCapacity: {} });

  // An explicit `undefined` removes the field rather than merging, so a value edited back to what is
  // saved stops being an override at all — which is what keeps "has an override" and "differs from
  // saved" the same question for every consumer of `overrides`.
  const setTeamOverride = useCallback((team: string, patch: TeamCapacityOverride) => {
    setState((previous) => {
      const merged = { ...previous.overrides[team], ...patch };
      const next = Object.fromEntries(
        Object.entries(merged).filter(([, value]) => value !== undefined),
      ) as TeamCapacityOverride;

      if (Object.keys(next).length === 0) {
        return removeOverride(previous, team);
      }

      return { ...previous, overrides: { ...previous.overrides, [team]: next } };
    });
  }, []);

  const clearTeamOverride = useCallback((team: string) => {
    setState((previous) => removeOverride(previous, team));
  }, []);

  /**
   * Records what a team's inputs look like with nothing overriding them. Callers pass the values the
   * derived pipeline reports, which become the overridden numbers once an override lands — so an
   * overridden team is ignored here rather than trusted to know its own baseline.
   */
  const rememberSavedCapacity = useCallback((team: string, values: TeamCapacity) => {
    setState((previous) => {
      if (team in previous.overrides) return previous;

      const current = previous.savedCapacity[team];
      if (current && current.velocityPerSprint === values.velocityPerSprint && current.tracks === values.tracks) {
        return previous;
      }

      return { ...previous, savedCapacity: { ...previous.savedCapacity, [team]: values } };
    });
  }, []);

  /** A successful write makes the what-if the new baseline, so the override has nothing left to say. */
  const commitSavedCapacity = useCallback((team: string, values: TeamCapacity) => {
    setState((previous) => ({
      overrides: removeOverride(previous, team).overrides,
      savedCapacity: { ...previous.savedCapacity, [team]: values },
    }));
  }, []);

  const value = useMemo(
    () => ({
      overrides,
      savedCapacity,
      setTeamOverride,
      clearTeamOverride,
      rememberSavedCapacity,
      commitSavedCapacity,
      onTeamDataSaved,
    }),
    [
      overrides,
      savedCapacity,
      setTeamOverride,
      clearTeamOverride,
      rememberSavedCapacity,
      commitSavedCapacity,
      onTeamDataSaved,
    ],
  );

  return <CapacityOverridesContext.Provider value={value}>{children}</CapacityOverridesContext.Provider>;
};

interface CapacityState {
  overrides: CapacityOverrides;
  savedCapacity: SavedTeamCapacities;
}

function removeOverride(state: CapacityState, team: string): CapacityState {
  if (!(team in state.overrides)) return state;

  const { [team]: _removed, ...rest } = state.overrides;
  return { ...state, overrides: rest };
}
