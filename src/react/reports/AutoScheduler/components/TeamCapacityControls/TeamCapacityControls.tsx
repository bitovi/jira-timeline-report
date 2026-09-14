import type { FC } from 'react';

import React from 'react';
import Tooltip from '@atlaskit/tooltip';

import { useCapacityOverrides } from '../../../../services/capacity-overrides';
import { roundTo } from '../../../../../utils/number/number';
import { CapacityField } from './CapacityField';
import { TrackStepper } from './TrackStepper';
import { useTeamCommit } from './useTeamCommit';

/** A team reads as dirty when anything on its row is uncommitted — capacity or tracks, alike. */
export const useTeamIsDirty = (teamName: string) => {
  const { overrides } = useCapacityOverrides();
  const override = overrides[teamName];

  return !!override && (override.velocityPerSprint !== undefined || override.tracks !== undefined);
};

interface TeamCapacityInputsProps {
  teamName: string;
  savedVelocityPerSprint: number;
  savedTracks: number;
}

const buttonClasses =
  'rounded-[3px] border border-neutral-40 bg-white px-2.5 py-[3px] text-xs font-semibold text-slate-600 ' +
  'hover:bg-neutral-20';

/**
 * The left, editable half of a team header row: tracks, capacity, and — only while the team is
 * dirty — Reset and Commit. The buttons live at the end of the input group so the row grows leftward
 * and the output columns never shift.
 */
export const TeamCapacityInputs: FC<TeamCapacityInputsProps> = ({ teamName, savedVelocityPerSprint, savedTracks }) => {
  const { overrides, setTeamOverride, clearTeamOverride } = useCapacityOverrides();
  const { commit, isSaving } = useTeamCommit();

  const override = overrides[teamName] ?? {};
  const isDirty = useTeamIsDirty(teamName);

  const velocityPerSprint = override.velocityPerSprint ?? savedVelocityPerSprint;
  const tracks = override.tracks ?? savedTracks;

  return (
    <span className="inline-flex min-w-0 items-center gap-3.5">
      {/* Tooltip clones its child to attach handlers and a ref, so it needs a host element. */}
      <Tooltip content={trackTooltip(tracks, velocityPerSprint)}>
        <span className="inline-flex">
          <TrackStepper value={tracks} onChange={(next) => setTeamOverride(teamName, { tracks: next })} />
        </span>
      </Tooltip>

      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-neutral-500">Capacity</span>
        <CapacityField
          value={velocityPerSprint}
          onChange={(next) => setTeamOverride(teamName, { velocityPerSprint: next })}
        />
        <span className="text-[11px] text-neutral-500">pts / sprint</span>
      </span>

      {isDirty && (
        <span className="inline-flex gap-1.5">
          <button type="button" className={buttonClasses} onClick={() => clearTeamOverride(teamName)}>
            Reset
          </button>
          <button
            type="button"
            className="rounded-[3px] border border-blue-600 bg-blue-600 px-2.5 py-[3px] text-xs font-semibold text-white hover:bg-blue-700"
            disabled={isSaving}
            onClick={() => {
              commit(teamName, override);
              clearTeamOverride(teamName);
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
  <span className="inline-flex items-center gap-3.5">
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
        sprint; each track gets a share of it, so every epic takes proportionally longer and more run at once.
      </div>
      <div>Epics with no estimate also shrink — their default estimate is capacity ÷ tracks.</div>
    </div>
  );
}
