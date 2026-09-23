import type { FC } from 'react';
import type { TeamCapacity } from '../../../../services/capacity-overrides';

import React, { useEffect } from 'react';
import Tooltip from '@atlaskit/tooltip';

import { useCapacityOverrides } from '../../../../services/capacity-overrides';
import { roundTo } from '../../../../../utils/number/number';
import { CapacityField } from './CapacityField';
import { TrackStepper } from './TrackStepper';
import { useTeamCommit } from './useTeamCommit';

/**
 * A team reads as dirty when anything on its row is uncommitted — capacity or tracks, alike. The
 * provider drops a field set back to its saved value, so "has an override" and "differs from what is
 * saved" are the same question here.
 */
export const useTeamIsDirty = (teamName: string) => {
  const { overrides } = useCapacityOverrides();
  const override = overrides[teamName];

  return !!override && (override.velocityPerSprint !== undefined || override.tracks !== undefined);
};

interface TeamCapacityInputsProps {
  teamName: string;
  /** The hierarchy level of the issues being scheduled — where a commit writes. */
  hierarchyLevel: number;
  savedVelocityPerSprint: number;
  savedTracks: number;
}

const buttonClasses =
  'rounded-[3px] border border-neutral-40 bg-white px-2.5 py-[3px] text-xs font-semibold text-slate-600 ' +
  'hover:bg-neutral-20 disabled:cursor-not-allowed disabled:text-neutral-50';

/**
 * The left, editable half of a team header row: tracks, capacity, and — only while the team is
 * dirty — Reset and Commit. The buttons live at the end of the input group so the row grows leftward
 * and the output columns never shift.
 */
export const TeamCapacityInputs: FC<TeamCapacityInputsProps> = ({
  teamName,
  hierarchyLevel,
  savedVelocityPerSprint,
  savedTracks,
}) => {
  const { overrides, savedCapacity, setTeamOverride, clearTeamOverride, rememberSavedCapacity, commitSavedCapacity } =
    useCapacityOverrides();
  const { commit, isSaving, isBlocked } = useTeamCommit();

  const override = overrides[teamName] ?? {};
  const isDirty = useTeamIsDirty(teamName);

  // The values passed in come from the derived pipeline, so they are the saved ones only until an
  // override lands. The provider keeps the baseline — this row is remounted on every re-derive.
  useEffect(() => {
    rememberSavedCapacity(teamName, { velocityPerSprint: savedVelocityPerSprint, tracks: savedTracks });
  }, [rememberSavedCapacity, teamName, savedVelocityPerSprint, savedTracks]);

  const saved = savedCapacity[teamName] ?? { velocityPerSprint: savedVelocityPerSprint, tracks: savedTracks };

  const velocityPerSprint = override.velocityPerSprint ?? saved.velocityPerSprint;
  const tracks = override.tracks ?? saved.tracks;

  // `undefined` removes the field, so editing back to the saved value leaves the row clean instead of
  // arming a Commit that would write what is already stored.
  const change = (patch: Partial<TeamCapacity>) => {
    const next = { velocityPerSprint, tracks, ...patch };

    setTeamOverride(teamName, {
      velocityPerSprint: next.velocityPerSprint === saved.velocityPerSprint ? undefined : next.velocityPerSprint,
      tracks: next.tracks === saved.tracks ? undefined : next.tracks,
    });
  };

  return (
    <span className="inline-flex min-w-0 items-center gap-3.5">
      {/* Tooltip clones its child to attach handlers and a ref, so it needs a host element. */}
      <Tooltip content={trackTooltip(tracks, velocityPerSprint)}>
        <span className="inline-flex">
          <TrackStepper value={tracks} isDisabled={isSaving} onChange={(next) => change({ tracks: next })} />
        </span>
      </Tooltip>

      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-neutral-500">Capacity</span>
        <CapacityField
          value={velocityPerSprint}
          isDisabled={isSaving}
          onChange={(next) => change({ velocityPerSprint: next })}
        />
        <span className="text-[11px] text-neutral-500">pts / sprint</span>
      </span>

      {isDirty && (
        <span className="inline-flex gap-1.5">
          {/* The whole row freezes mid-commit: the values were captured at click time, so an edit
              landing before the write returns would be dropped by the success handler. */}
          <button
            type="button"
            className={buttonClasses}
            disabled={isSaving}
            onClick={() => clearTeamOverride(teamName)}
          >
            Reset
          </button>
          <button
            type="button"
            className="rounded-[3px] border border-blue-600 bg-blue-600 px-2.5 py-[3px] text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-blue-300 disabled:bg-blue-300"
            disabled={isSaving || isBlocked}
            title={isBlocked ? 'Another team is being saved. Wait for it to finish.' : undefined}
            onClick={() => {
              // Only on success: a failed write rolls the save back, and dropping the override here
              // would throw the what-if away with nothing saved in its place.
              commit(teamName, hierarchyLevel, override, {
                onSuccess: () => commitSavedCapacity(teamName, { velocityPerSprint, tracks }),
              });
            }}
          >
            Commit
          </button>
        </span>
      )}
    </span>
  );
};

interface TeamCapacityOutputsProps {
  pointsPerDay: number;
  totalWorkingDays: number;
}

/** The right, read-only half: a unit conversion of capacity, and a result of the simulation. */
export const TeamCapacityOutputs: FC<TeamCapacityOutputsProps> = ({ pointsPerDay, totalWorkingDays }) => (
  <span className="inline-flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-1">
    <Tooltip content="Capacity ÷ sprint length. Change capacity to move this — it is a readout, not a setting.">
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap" tabIndex={0}>
        <span className="text-neutral-500">Points / Day</span>
        <span className="font-semibold tabular-nums">{roundTo(pointsPerDay, 2)}</span>
      </span>
    </Tooltip>
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-neutral-500">Total Working Days</span>
      <span className="font-semibold tabular-nums">{roundTo(totalWorkingDays, 0)}</span>
    </span>
  </span>
);

function trackTooltip(tracks: number, velocityPerSprint: number) {
  return (
    <div className="grid gap-1.5">
      <div className="font-semibold">Tracks — {tracks}</div>
      <div>Parallel work streams inside this team. Each track works one epic at a time.</div>
      <div>
        Adding a track does <strong>not</strong> add capacity. The team still delivers {velocityPerSprint} points per
        sprint; each track gets a share of it, so every <em>estimated</em> epic takes proportionally longer and more run
        at once.
      </div>
      <div>
        Epics with <em>no</em> estimate are the exception: their default estimate is capacity ÷ tracks, which shrinks by
        exactly the same factor as each track&rsquo;s throughput, so their duration does not move at all.
      </div>
    </div>
  );
}
