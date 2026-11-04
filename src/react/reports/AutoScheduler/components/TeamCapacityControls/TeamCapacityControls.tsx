import type { FC } from 'react';
import type { TeamCapacity, TeamCapacityOverride } from '../../../../services/capacity-overrides';
import type { EstimateTeamShare, EstimateUnit } from '../../../../../jira/shared/types';
import type {
  FieldLabel,
  ItemLabel,
} from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/shared/estimation';

import React, { Suspense, useEffect } from 'react';
import Tooltip from '@atlaskit/tooltip';
import { ErrorBoundary } from '@sentry/react';

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

/**
 * The team's capacity as the row shows it: the saved values with any uncommitted override on top.
 * The provider's baseline wins over the props once remembered — this row is remounted on every re-derive.
 */
const useCurrentCapacity = (
  teamName: string,
  { savedPointsPerPersonDay, savedTeamMembers, savedTracks }: SavedCapacityProps,
) => {
  const { overrides, savedCapacity } = useCapacityOverrides();
  const override = overrides[teamName] ?? {};
  const saved: TeamCapacity = savedCapacity[teamName] ?? {
    pointsPerPersonDay: savedPointsPerPersonDay,
    tracks: savedTracks,
    teamMembers: savedTeamMembers,
  };
  const current: TeamCapacity = {
    pointsPerPersonDay: override.pointsPerPersonDay ?? saved.pointsPerPersonDay,
    tracks: override.tracks ?? saved.tracks,
    teamMembers: override.teamMembers ?? saved.teamMembers,
  };

  return { override, saved, current };
};

interface SavedCapacityProps {
  /** X as derived: estimate units one person finishes per working day. */
  savedPointsPerPersonDay: number;
  savedTeamMembers: number;
  savedTracks: number;
}

interface TeamCapacityInputsProps extends SavedCapacityProps {
  teamName: string;
  /** The hierarchy level of the issues being scheduled — where a commit writes. */
  hierarchyLevel: number;
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
 * Capacity is `X × N` for every unit (spec/042-update-team-estimation-settings/plan.md): tracks
 * only divide it. Story Points edits its points per sprint, which rewrites X at the saved headcount;
 * every other unit edits the headcount, which scales it.
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
  const { setTeamOverride, clearTeamOverride, rememberSavedCapacity, commitSavedCapacity } = useCapacityOverrides();
  const { commit, isSaving, isBlocked } = useTeamCommit();
  const { config, fieldLabel } = useTeamSettings(teamName, hierarchyLevel);

  const { override, saved, current } = useCurrentCapacity(teamName, {
    savedPointsPerPersonDay,
    savedTeamMembers,
    savedTracks,
  });
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

  return (
    <span className="inline-flex min-w-0 grow flex-wrap items-center gap-x-3.5 gap-y-1">
      {/* Tooltip clones its child to attach handlers and a ref, so it needs a host element. */}
      <span className="inline-flex items-center gap-1.5">
        <Tooltip content={trackTooltip(tracks, teamMembers, itemLabel, estimateUnit)}>
          <span className="inline-flex">
            <TrackStepper
              value={tracks}
              itemLabel={itemLabel}
              isDisabled={isSaving}
              onChange={(next) => change({ tracks: next })}
            />
          </span>
        </Tooltip>
      </span>

      {/* Story Points' lever is its points per sprint, below; the headcount stays a settings answer. */}
      {estimateUnit !== 'storyPoints' && (
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
      )}

      {/* The edit rewrites X at the current headcount. */}
      {estimateUnit === 'storyPoints' && capacity.team.perPeriod !== undefined && (
        <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap" data-testid="team-sprint-capacity">
          <CapacityField
            name="Capacity"
            value={formatRate(capacity.team.perPeriod)}
            unitLabel={`${fieldLabel.plural} / sprint`}
            isDisabled={isSaving}
            onChange={(next) => change({ pointsPerPersonDay: next / (teamMembers * periodDays) })}
          />
          <span className="text-neutral-500">Capacity / sprint</span>
        </span>
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
    </span>
  );
};

/** "0.08 Story Points / day (person)", "0.4 Story Points / day (team)" */
const Rate: FC<{ value: number; label: (rounded: number) => string }> = ({ value, label }) => {
  const rounded = formatRate(value);

  return (
    <>
      <span className="font-semibold tabular-nums">{rounded}</span>
      {label(rounded)}
    </>
  );
};

interface TeamRatesProps extends SavedCapacityProps {
  teamName: string;
  hierarchyLevel: number;
  periodDays: number;
  estimateUnit?: EstimateUnit;
}

interface TeamCapacityOutputsProps {
  totalWorkingDays: number;
  /** The team whose rates the tooltip explains; omit for no tooltip. */
  rates?: TeamRatesProps;
}

/** The right, read-only half: a result of the simulation, with the rates behind it in a tooltip. */
export const TeamCapacityOutputs: FC<TeamCapacityOutputsProps> = ({ totalWorkingDays, rates }) => {
  const total = (
    <span tabIndex={rates ? 0 : undefined} className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-neutral-500">Total working days</span>
      <span className="font-semibold tabular-nums">{roundTo(totalWorkingDays, 0)}</span>
    </span>
  );

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-1" data-testid="total-working-days">
      {rates ? (
        <Tooltip
          content={
            // `useTeamSettings` suspends; the tooltip mounts on hover, after the inputs have loaded the
            // same queries, but a failure must not take the report down with it.
            <ErrorBoundary fallback={() => <></>}>
              <Suspense fallback={null}>
                <TeamRates {...rates} />
              </Suspense>
            </ErrorBoundary>
          }
        >
          {total}
        </Tooltip>
      ) : (
        total
      )}
    </span>
  );
};

/** "0.16 Story Points / day (person)" and "0.8 Story Points / day (team)", following any uncommitted edit. */
const TeamRates: FC<TeamRatesProps> = ({
  teamName,
  hierarchyLevel,
  periodDays,
  estimateUnit = DEFAULT_ESTIMATE_UNIT,
  ...saved
}) => {
  const { config, fieldLabel } = useTeamSettings(teamName, hierarchyLevel);
  const { current } = useCurrentCapacity(teamName, saved);
  const { pointsPerPersonDay, teamMembers } = current;

  const capacity = formatCapacity({ unit: estimateUnit, pointsPerPersonDay, teamMembers, sprintLength: periodDays });
  const field = (count: number) => (count === 1 ? fieldLabel.singular : fieldLabel.plural);
  const meaning = describeEstimateUnit(
    { ...config, estimateUnit, pointsPerPersonDay, teamMembers, sprintLength: periodDays },
    fieldLabel,
    '=',
  );

  return (
    <div className="grid gap-1.5" data-testid="team-rates">
      <div data-testid="per-developer">
        <Rate value={capacity.perPerson.perDay} label={(value) => ` ${field(value)} / day (person)`} />
      </div>
      <div data-testid="per-team">
        <Rate value={capacity.team.perDay} label={(value) => ` ${field(value)} / day (team)`} />
      </div>
      <div>{meaning}</div>
    </div>
  );
};

/** "5 people", "1 person", "0.5 people" — the team's headcount split evenly across its tracks. */
export function peoplePerTrack(teamMembers: number, tracks: number) {
  const people = roundTo(teamMembers / tracks, 1);

  return `${people} ${people === 1 ? 'person' : 'people'}`;
}

function trackTooltip(tracks: number, teamMembers: number, item: ItemLabel, estimateUnit: EstimateUnit) {
  // One lever per unit: Story Points teams track their points per sprint, editable on the row.
  const finishFaster = estimateUnit === 'storyPoints' ? 'raise Capacity / sprint' : 'add developers';

  return (
    <div className="grid gap-1">
      <div>
        <span className="font-semibold">
          {tracks} {tracks === 1 ? item.singular : item.plural} in parallel
        </span>{' '}
        ·{' '}
        <span data-testid="people-per-track">
          {peoplePerTrack(teamMembers, tracks)} {tracks === 1 ? 'on it' : 'each'}
        </span>
      </div>
      <div>
        How many {item.plural} your team works on at the same time. More in parallel spreads the same capacity across
        more work, so each {item.singular} takes longer. To finish {item.plural} faster, {finishFaster}.
      </div>
    </div>
  );
}
