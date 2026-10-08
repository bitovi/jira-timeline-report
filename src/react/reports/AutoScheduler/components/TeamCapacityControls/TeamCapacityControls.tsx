import type { FC } from 'react';
import type { TeamCapacity } from '../../../../services/capacity-overrides';
import type { EstimateTeamShare, EstimateUnit } from '../../../../../jira/shared/types';
import type {
  CapacityReadout,
  ItemLabel,
} from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/shared/estimation';

import React, { useEffect } from 'react';
import Tooltip from '@atlaskit/tooltip';

import { useCapacityOverrides } from '../../../../services/capacity-overrides';
import { roundTo } from '../../../../../utils/number/number';
import { CapacityField } from './CapacityField';
import { TrackStepper } from './TrackStepper';
import { useTeamCommit } from './useTeamCommit';
import {
  formatCapacity,
  WORK_ITEMS_LABEL,
} from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/shared/estimation';

/**
 * A team reads as dirty when anything on its row is uncommitted — capacity, members or tracks alike. The
 * provider drops a field set back to its saved value, so "has an override" and "differs from what is
 * saved" are the same question here.
 */
export const useTeamIsDirty = (teamName: string) => {
  const { overrides } = useCapacityOverrides();
  const override = overrides[teamName];

  return (
    !!override &&
    (override.velocityPerSprint !== undefined || override.tracks !== undefined || override.teamMembers !== undefined)
  );
};

interface TeamCapacityInputsProps {
  teamName: string;
  /** The hierarchy level of the issues being scheduled — where a commit writes. */
  hierarchyLevel: number;
  /** The team's effective velocity as derived — estimate units per sprint, whatever the unit. */
  savedVelocityPerSprint: number;
  savedTracks: number;
  daysPerSprint: number;
  estimateUnit?: EstimateUnit;
  estimateTeamShare?: EstimateTeamShare;
  /** The scheduled level's name, e.g. "Epic" / "Epics". */
  itemLabel?: ItemLabel;
}

const buttonClasses =
  'rounded-[3px] border border-neutral-40 bg-white px-2.5 py-[3px] text-xs font-semibold text-slate-600 ' +
  'hover:bg-neutral-20 disabled:cursor-not-allowed disabled:text-neutral-50';

/**
 * The left, editable half of a team header row: tracks, capacity, and — only while the team is
 * dirty — Reset and Commit. The buttons live at the end of the input group so the row grows leftward
 * and the output columns never shift.
 *
 * Capacity reads in the team's own unit (spec/040-update-team-estimation-settings). Story Points edits
 * velocity per sprint, Dev Days edits team members (its dev days per day), and the team-time units
 * have no editable capacity at all: theirs follows only from the team share, which is a setting.
 */
export const TeamCapacityInputs: FC<TeamCapacityInputsProps> = ({
  teamName,
  hierarchyLevel,
  savedVelocityPerSprint,
  savedTracks,
  daysPerSprint,
  estimateUnit = 'storyPoints',
  estimateTeamShare = 'full',
  itemLabel = WORK_ITEMS_LABEL,
}) => {
  const { overrides, savedCapacity, setTeamOverride, clearTeamOverride, rememberSavedCapacity, commitSavedCapacity } =
    useCapacityOverrides();
  const { commit, isSaving, isBlocked } = useTeamCommit();

  const override = overrides[teamName] ?? {};
  const isDirty = useTeamIsDirty(teamName);

  // The values passed in come from the derived pipeline, so they are the saved ones only until an
  // override lands. The provider keeps the baseline — this row is remounted on every re-derive.
  const isDevDays = estimateUnit === 'devDays';
  // A Dev Days team's effective velocity is members × sprint length, so its headcount is recoverable.
  const savedTeamMembers = isDevDays ? roundTo(savedVelocityPerSprint / daysPerSprint, 2) : undefined;

  useEffect(() => {
    rememberSavedCapacity(teamName, {
      velocityPerSprint: savedVelocityPerSprint,
      tracks: savedTracks,
      teamMembers: savedTeamMembers,
    });
  }, [rememberSavedCapacity, teamName, savedVelocityPerSprint, savedTracks, savedTeamMembers]);

  const saved = savedCapacity[teamName] ?? {
    velocityPerSprint: savedVelocityPerSprint,
    tracks: savedTracks,
    teamMembers: savedTeamMembers,
  };

  const velocityPerSprint = override.velocityPerSprint ?? saved.velocityPerSprint;
  const tracks = override.tracks ?? saved.tracks;
  const teamMembers = override.teamMembers ?? saved.teamMembers;

  const effectiveVelocity = isDevDays && teamMembers !== undefined ? teamMembers * daysPerSprint : velocityPerSprint;
  const capacity = formatCapacity(estimateUnit, estimateTeamShare, effectiveVelocity, daysPerSprint);

  // `undefined` removes the field, so editing back to the saved value leaves the row clean instead of
  // arming a Commit that would write what is already stored.
  const change = (patch: Partial<TeamCapacity>) => {
    const next = { velocityPerSprint, tracks, teamMembers, ...patch };

    setTeamOverride(teamName, {
      velocityPerSprint: next.velocityPerSprint === saved.velocityPerSprint ? undefined : next.velocityPerSprint,
      tracks: next.tracks === saved.tracks ? undefined : next.tracks,
      teamMembers: next.teamMembers === saved.teamMembers ? undefined : next.teamMembers,
    });
  };

  return (
    <span className="inline-flex min-w-0 items-center gap-3.5">
      {/* Tooltip clones its child to attach handlers and a ref, so it needs a host element. */}
      <Tooltip content={trackTooltip(tracks, capacity.perPeriod ?? capacity.perDay, itemLabel)}>
        <span className="inline-flex">
          <TrackStepper
            value={tracks}
            itemLabel={itemLabel}
            isDisabled={isSaving}
            onChange={(next) => change({ tracks: next })}
          />
        </span>
      </Tooltip>

      {estimateUnit === 'storyPoints' && capacity.perPeriod && (
        <CapacityReadoutView label={capacity.perPeriod.label}>
          <CapacityField
            value={velocityPerSprint}
            unitLabel={capacity.perPeriod.label}
            isDisabled={isSaving}
            onChange={(next) => change({ velocityPerSprint: next })}
          />
        </CapacityReadoutView>
      )}

      {isDevDays && teamMembers !== undefined && (
        <CapacityReadoutView label={capacity.perDay.label}>
          <CapacityField
            value={teamMembers}
            unitLabel={capacity.perDay.label}
            isDisabled={isSaving}
            onChange={(next) => change({ teamMembers: next })}
          />
        </CapacityReadoutView>
      )}

      {!isDevDays && estimateUnit !== 'storyPoints' && (
        <Tooltip content={teamShareTooltip(estimateTeamShare, itemLabel)}>
          <span tabIndex={0}>
            <CapacityReadoutView label={(capacity.perPeriod ?? capacity.perDay).label}>
              <span className="font-semibold tabular-nums">{(capacity.perPeriod ?? capacity.perDay).value}</span>
            </CapacityReadoutView>
          </span>
        </Tooltip>
      )}

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
                onSuccess: () =>
                  commitSavedCapacity(teamName, { velocityPerSprint: effectiveVelocity, tracks, teamMembers }),
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

const CapacityReadoutView: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
    <span className="text-neutral-500">Capacity</span>
    {children}
    <span className="text-[11px] text-neutral-500">{label}</span>
  </span>
);

interface TeamCapacityOutputsProps {
  /** Effective velocity: estimate units the whole team finishes per sprint. */
  velocity: number;
  daysPerSprint: number;
  estimateUnit?: EstimateUnit;
  estimateTeamShare?: EstimateTeamShare;
  totalWorkingDays: number;
}

/**
 * The right, read-only half: capacity per working day, and a result of the simulation. A Dev Days or
 * Team Working Days team's capacity already is per day, so the inputs half shows it and this one
 * does not repeat it.
 */
export const TeamCapacityOutputs: FC<TeamCapacityOutputsProps> = ({
  velocity,
  daysPerSprint,
  estimateUnit = 'storyPoints',
  estimateTeamShare = 'full',
  totalWorkingDays,
}) => {
  const capacity = formatCapacity(estimateUnit, estimateTeamShare, velocity, daysPerSprint);

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-1">
      {capacity.perPeriod && (
        <Tooltip content="Capacity ÷ sprint length. A readout, not a setting.">
          <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap" tabIndex={0}>
            <span className="font-semibold tabular-nums">{capacity.perDay.value}</span>
            <span className="text-neutral-500">{capacity.perDay.label}</span>
          </span>
        </Tooltip>
      )}
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="text-neutral-500">Total working days</span>
        <span className="font-semibold tabular-nums">{roundTo(totalWorkingDays, 0)}</span>
      </span>
    </span>
  );
};

const SHARE_OF_TEAM: Record<EstimateTeamShare, string> = {
  full: 'the whole team',
  half: 'half the team',
  third: 'a third of the team',
  quarter: 'a quarter of the team',
};

/** Where a team-time capacity comes from, and where to change it. */
function teamShareTooltip(share: EstimateTeamShare, item: ItemLabel) {
  return `Estimates assume ${SHARE_OF_TEAM[share]} works on each ${item.singular}. Change this in Team Configuration.`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "20 points / sprint" → "20 points per sprint", for running text. */
const inWords = ({ value, label }: CapacityReadout) => `${value} ${label.replace(' / ', ' per ')}`;

function trackTooltip(tracks: number, capacity: CapacityReadout, item: ItemLabel) {
  return (
    <div className="grid gap-1.5">
      <div className="font-semibold">
        {tracks} {tracks === 1 ? item.singular : item.plural} in parallel
      </div>
      <div>How many {item.plural} this team works on at once.</div>
      <div>
        Working on more at once does <strong>not</strong> add capacity. The team still delivers {inWords(capacity)};
        each {item.singular} gets a share of it, so every <em>estimated</em> {item.singular} takes proportionally longer
        and more run at once.
      </div>
      <div>
        {capitalize(item.plural)} with <em>no</em> estimate are the exception: their default estimate is one sprint of
        capacity shared across the {item.plural} in parallel, which shrinks by exactly the same factor, so their
        duration does not move at all.
      </div>
    </div>
  );
}
