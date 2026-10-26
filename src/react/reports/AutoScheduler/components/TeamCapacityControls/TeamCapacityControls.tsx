import type { FC, ReactNode } from 'react';
import type { TeamCapacity, TeamCapacityOverride } from '../../../../services/capacity-overrides';
import type { EstimateTeamShare, EstimateUnit } from '../../../../../jira/shared/types';
import type {
  FieldLabel,
  ItemLabel,
} from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/shared/estimation';

import React, { useEffect } from 'react';
import Tooltip from '@atlaskit/tooltip';

import { useCapacityOverrides } from '../../../../services/capacity-overrides';
import { roundTo } from '../../../../../utils/number/number';
import { CapacityField } from './CapacityField';
import { HeadcountCommitSteps } from './HeadcountCommitSteps';
import { TrackStepper } from './TrackStepper';
import { useTeamCommit } from './useTeamCommit';
import { useTeamSettings } from './useTeamSettings';
import {
  DEFAULT_ESTIMATE_UNIT,
  describeEstimateUnit,
  formatCapacity,
  formatRate,
  getPeoplePerEstimate,
  isTeamTimeUnit,
  WORK_ITEMS_LABEL,
} from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/shared/estimation';

/**
 * A team reads as dirty when anything on its row is uncommitted — capacity, headcount or tracks alike.
 * The provider drops a field set back to its saved value, so "has an override" and "differs from what
 * is saved" are the same question here.
 */
export const useTeamIsDirty = (teamName: string) => {
  const { overrides } = useCapacityOverrides();
  const override = overrides[teamName];

  return (
    !!override &&
    (override.pointsPerPersonDay !== undefined || override.tracks !== undefined || override.teamMembers !== undefined)
  );
};

interface TeamCapacityInputsProps {
  teamName: string;
  /** The hierarchy level of the issues being scheduled — where a commit writes. */
  hierarchyLevel: number;
  /** X as derived: estimate units one person finishes per working day. */
  savedPointsPerPersonDay: number;
  savedTeamMembers: number;
  savedTracks: number;
  /** Working days in the scheduling period (`NormalizedTeam.daysPerSprint`) — the sprint, for the sprint units. */
  periodDays: number;
  estimateUnit?: EstimateUnit;
  /** The scheduled level's name, e.g. "Epic" / "Epics". */
  itemLabel?: ItemLabel;
}

const SHARE_PHRASE: Record<EstimateTeamShare, string> = {
  full: 'full team',
  half: 'half team',
  third: 'one third team',
  quarter: 'quarter team',
};

const commitButtonClasses =
  'rounded-[3px] border border-blue-600 bg-blue-600 px-2.5 py-[3px] text-xs font-semibold text-white ' +
  'hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-blue-300 disabled:bg-blue-300';

const buttonClasses =
  'rounded-[3px] border border-neutral-40 bg-white px-2.5 py-[3px] text-xs font-semibold text-slate-600 ' +
  'hover:bg-neutral-20 disabled:cursor-not-allowed disabled:text-neutral-50';

/**
 * The left, editable half of a team header row: tracks, headcount and capacity, and — only while the
 * team is dirty — Reset and Commit. The buttons live at the end of the input group so the row grows
 * leftward and the output columns never shift.
 *
 * Capacity is `X × N` for every unit (spec/042-update-team-estimation-settings/plan.md): the
 * headcount is editable for every unit and scales it, tracks only divide it, and Story Points can
 * also edit its points per sprint, which rewrites X.
 */
export const TeamCapacityInputs: FC<TeamCapacityInputsProps> = ({
  teamName,
  hierarchyLevel,
  savedPointsPerPersonDay,
  savedTeamMembers,
  savedTracks,
  periodDays,
  estimateUnit = DEFAULT_ESTIMATE_UNIT,
  itemLabel = WORK_ITEMS_LABEL,
}) => {
  const { overrides, savedCapacity, setTeamOverride, clearTeamOverride, rememberSavedCapacity, commitSavedCapacity } =
    useCapacityOverrides();
  const { commit, isSaving, isBlocked } = useTeamCommit();
  const { config, fieldLabel } = useTeamSettings(teamName, hierarchyLevel);

  const override = overrides[teamName] ?? {};
  const isDirty = useTeamIsDirty(teamName);

  // The values passed in come from the derived pipeline, so they are the saved ones only until an
  // override lands. The provider keeps the baseline — this row is remounted on every re-derive.
  useEffect(() => {
    rememberSavedCapacity(teamName, {
      pointsPerPersonDay: savedPointsPerPersonDay,
      tracks: savedTracks,
      teamMembers: savedTeamMembers,
    });
  }, [rememberSavedCapacity, teamName, savedPointsPerPersonDay, savedTracks, savedTeamMembers]);

  const saved = savedCapacity[teamName] ?? {
    pointsPerPersonDay: savedPointsPerPersonDay,
    tracks: savedTracks,
    teamMembers: savedTeamMembers,
  };

  const current: TeamCapacity = {
    pointsPerPersonDay: override.pointsPerPersonDay ?? saved.pointsPerPersonDay,
    tracks: override.tracks ?? saved.tracks,
    teamMembers: override.teamMembers ?? saved.teamMembers,
  };
  const { pointsPerPersonDay, tracks, teamMembers } = current;

  const capacity = formatCapacity({ unit: estimateUnit, pointsPerPersonDay, teamMembers, sprintLength: periodDays });

  // `undefined` removes the field, so editing back to the saved value leaves the row clean instead of
  // arming a Commit that would write what is already stored.
  const change = (patch: TeamCapacityOverride) => {
    const next = { ...current, ...patch };

    setTeamOverride(teamName, {
      pointsPerPersonDay: next.pointsPerPersonDay === saved.pointsPerPersonDay ? undefined : next.pointsPerPersonDay,
      tracks: next.tracks === saved.tracks ? undefined : next.tracks,
      teamMembers: next.teamMembers === saved.teamMembers ? undefined : next.teamMembers,
    });
  };

  // Always scales — the AutoScheduler is where you see what more people would do. Unlike the
  // settings form, a first headcount here never re-anchors X: per-developer stays put, the team grows.
  const changeHeadcount = (next: number) => change({ teamMembers: next });

  // On a team-time unit, estimates assume a share of the team, so a new headcount redefines every
  // estimate in Jira. That can't be saved from here; Commit explains the manual steps instead.
  const savedPeoplePerEstimate = getPeoplePerEstimate({
    ...config,
    estimateUnit,
    pointsPerPersonDay: saved.pointsPerPersonDay,
    teamMembers: saved.teamMembers,
    sprintLength: periodDays,
  });
  const needsManualCommit =
    isTeamTimeUnit(estimateUnit) && override.teamMembers !== undefined && savedPeoplePerEstimate != null;

  const field = (count: number) => (count === 1 ? fieldLabel.singular : fieldLabel.plural);
  const meaning = describeEstimateUnit(
    { ...config, estimateUnit, pointsPerPersonDay, teamMembers, sprintLength: periodDays },
    fieldLabel,
    '=',
  );

  return (
    <span className="inline-flex min-w-0 grow flex-wrap items-center gap-x-3.5 gap-y-1">
      {/* Tooltip clones its child to attach handlers and a ref, so it needs a host element. */}
      <span className="inline-flex items-center gap-1.5">
        <Tooltip content={trackTooltip(tracks, capacity.team.perDay, fieldLabel, itemLabel)}>
          <span className="inline-flex">
            <TrackStepper
              value={tracks}
              itemLabel={itemLabel}
              isDisabled={isSaving}
              onChange={(next) => change({ tracks: next })}
            />
          </span>
        </Tooltip>
        <span className="whitespace-nowrap text-[11px] text-neutral-500" data-testid="people-per-track">
          ({peoplePerTrack(teamMembers, tracks)} each)
        </span>
      </span>

      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap" data-testid="team-capacity">
        <CapacityField
          name="Developers"
          value={teamMembers}
          unitLabel={teamMembers === 1 ? 'developer' : 'developers'}
          isDisabled={isSaving}
          onChange={changeHeadcount}
        />
        <span className="text-neutral-500">{teamMembers === 1 ? 'developer' : 'developers'}</span>
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
          {needsManualCommit ? (
            <HeadcountCommitSteps
              savedTeamMembers={saved.teamMembers}
              teamMembers={teamMembers}
              peoplePerEstimate={savedPeoplePerEstimate!}
              sharePhrase={SHARE_PHRASE[config.estimateTeamShare ?? 'full']}
              field={fieldLabel}
              className={commitButtonClasses}
              isDisabled={isSaving}
            />
          ) : (
            <button
              type="button"
              className={commitButtonClasses}
              disabled={isSaving || isBlocked}
              title={isBlocked ? 'Another team is being saved. Wait for it to finish.' : undefined}
              onClick={() => {
                // Only on success: a failed write rolls the save back, and dropping the override here
                // would throw the what-if away with nothing saved in its place.
                commit(teamName, hierarchyLevel, override, {
                  onSuccess: () => commitSavedCapacity(teamName, current),
                });
              }}
            >
              Commit
            </button>
          )}
        </span>
      )}

      {/* Right-aligned, next to the outputs: the rates read as results of the inputs on the left. */}
      <span className="ml-auto inline-flex items-baseline gap-1.5 whitespace-nowrap" data-testid="team-rates">
        <Tooltip content={meaning}>
          <span tabIndex={0} className="inline-flex items-baseline gap-1.5" data-testid="per-developer">
            <Rate value={capacity.perPerson.perDay} label={(value) => `${field(value)} / day (person)`} />
          </span>
        </Tooltip>
        <Separator />
        <span className="inline-flex items-baseline gap-1.5" data-testid="per-team">
          {/* Story Points reads per sprint; the team and dev units read per day, like the per-person rate. */}
          {estimateUnit === 'storyPoints' && capacity.team.perPeriod !== undefined ? (
            // Story Points keeps its points per sprint editable; the edit rewrites X at the current headcount.
            <Rate
              value={capacity.team.perPeriod}
              label={(value) => `${field(value)} / sprint (team)`}
              editable={
                <CapacityField
                  value={formatRate(capacity.team.perPeriod)}
                  unitLabel={`${fieldLabel.plural} / sprint`}
                  isDisabled={isSaving}
                  onChange={(next) => change({ pointsPerPersonDay: next / (teamMembers * periodDays) })}
                />
              }
            />
          ) : (
            <Rate value={capacity.team.perDay} label={(value) => `${field(value)} / day (team)`} />
          )}
        </span>
      </span>
    </span>
  );
};

const Separator = () => (
  <span aria-hidden className="text-neutral-400">
    ·
  </span>
);

/** "0.08 Story Points / day (person)", "0.4 Story Points / day (team)", "21 Story Points / sprint (team)" */
const Rate: FC<{
  value: number;
  label: (rounded: number) => string;
  /** Replaces the number, for an editable one. */
  editable?: ReactNode;
}> = ({ value, label, editable }) => {
  const rounded = formatRate(value);

  return (
    <>
      {editable ?? <span className="font-semibold tabular-nums">{rounded}</span>}
      <span className="text-neutral-500">{label(rounded)}</span>
    </>
  );
};

interface TeamCapacityOutputsProps {
  totalWorkingDays: number;
}

/** The right, read-only half: a result of the simulation. */
export const TeamCapacityOutputs: FC<TeamCapacityOutputsProps> = ({ totalWorkingDays }) => (
  <span className="inline-flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-1">
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-neutral-500">Total working days</span>
      <span className="font-semibold tabular-nums">{roundTo(totalWorkingDays, 0)}</span>
    </span>
  </span>
);

/** "5 people", "1 person", "0.5 people" — the team's headcount split evenly across its tracks. */
export function peoplePerTrack(teamMembers: number, tracks: number) {
  const people = roundTo(teamMembers / tracks, 1);

  return `${people} ${people === 1 ? 'person' : 'people'}`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function trackTooltip(tracks: number, teamPerDay: number, field: FieldLabel, item: ItemLabel) {
  const perDay = formatRate(teamPerDay);

  return (
    <div className="grid gap-1.5">
      <div className="font-semibold">
        {tracks} {tracks === 1 ? item.singular : item.plural} in parallel
      </div>
      <div>How many {item.plural} this team works on at once.</div>
      <div>
        Working on more at once does <strong>not</strong> add capacity. The team still delivers {perDay}{' '}
        {perDay === 1 ? field.singular : field.plural} per day; each {item.singular} gets a share of the team's
        developers, so every <em>estimated</em> {item.singular} takes proportionally longer and more run at once. Adding
        developers is what adds capacity.
      </div>
      <div>
        {capitalize(item.plural)} with <em>no</em> estimate are the exception: their default estimate is one sprint of
        capacity shared across the {item.plural} in parallel, which shrinks by exactly the same factor, so their
        duration does not move at all.
      </div>
    </div>
  );
}
