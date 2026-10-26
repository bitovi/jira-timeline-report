import type { FC, ReactNode } from 'react';
import type { Control, UseFormReturn } from 'react-hook-form';
import type { Configuration, EstimateTeamShare, EstimateUnit } from '../../services/team-configuration';
import type { FieldUpdates } from '../../ConfigureTeamsForm';
import type { AlsoWrite } from '../../useTeamForm';
import type { ItemLabel } from '../../shared/estimation';
import type { SelectableField } from '../../shared/selectable-fields';

import React from 'react';
import { useWatch } from 'react-hook-form';
import SectionMessage from '@atlaskit/section-message';
import InformationIcon from '@atlaskit/icon/core/information';

import TextField from '../TextField';
import Select from '../Select';
import InheritanceTextField from '../InheritanceTextField';
import InheritanceSelect from '../InheritanceSelect';
import DerivedNumberField from './DerivedNumberField';
import {
  DAYS_PER_WEEK,
  DEFAULT_ESTIMATE_UNIT,
  describeEstimation,
  describeUnestimated,
  fieldLabelFor,
  getDefaultTracks,
  getPeoplePerEstimate,
  getPointsPerPersonDay,
  getTeamMembers,
  getVelocityPerSprint,
  isTeamTimeUnit,
  pointsPerPersonDayFor,
  pointsPerPersonDayForHeadcount,
  pointsPerPersonDayForSprintLength,
  pointsPerPersonDayForUnit,
  usesSprintLength,
} from '../../shared/estimation';
import { roundTo } from '../../../../../../../../utils/number/number';

export const ESTIMATE_UNIT_OPTIONS: Array<{ value: EstimateUnit; label: string }> = [
  { value: 'storyPoints', label: 'Story Points' },
  { value: 'devDays', label: 'Dev Days' },
  { value: 'teamDays', label: 'Team Working Days' },
  { value: 'teamWeeks', label: 'Team Weeks' },
  { value: 'teamSprints', label: 'Team Sprints' },
];

export const ESTIMATE_TEAM_SHARE_OPTIONS: Array<{ value: EstimateTeamShare; label: string }> = [
  { value: 'full', label: 'Full team' },
  { value: 'half', label: 'Half team' },
  { value: 'third', label: 'One third team' },
  { value: 'quarter', label: 'Quarter team' },
];

const SHARE_PHRASE: Record<EstimateTeamShare, string> = {
  full: 'full team',
  half: 'half team',
  third: 'one third team',
  quarter: 'quarter team',
};

/**
 * The fields that say what one estimate unit means. They inherit together: X is in the unit's own
 * terms, so a level can't take one from its parent and set the other itself (see `inheritance.ts`).
 */
const CAPACITY_FIELDS_CLEARED: Partial<Configuration> = {
  estimateUnit: null,
  pointsPerPersonDay: null,
  velocityPerSprint: null,
  estimateTeamShare: null,
};

/** The parts of a hint that come from the team's answers. */
const Em: FC<{ children: ReactNode }> = ({ children }) => <span className="font-semibold">{children}</span>;

const SectionHeading: FC<{ children: string }> = ({ children }) => (
  <h4 className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
    {children}
    <span aria-hidden className="h-px flex-1 bg-slate-200" />
  </h4>
);

const plural = (count: number, singular: string, many: string) => `${count} ${count === 1 ? singular : many}`;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export interface EstimationQuestionsProps {
  /** `global` edits the global defaults directly; `inheriting` adds an inherit/customize toggle per field. */
  mode: 'global' | 'inheriting';
  control: Control<Configuration>;
  register: UseFormReturn<Configuration>['register'];
  update: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
  /** Saves several fields in one write — an answer plus everything it implies. */
  updateFields: (patch: Partial<Configuration>) => void;
  setValue: UseFormReturn<Configuration>['setValue'];
  savedUserData: Configuration;
  /** `alsoWrite` goes out in the same write as the toggled field. */
  toggleInheritance?: (field: keyof Configuration, shouldCustomize: boolean, alsoWrite?: AlsoWrite) => void;
  /**
   * Did the team ever enter a headcount anywhere in this level's chain? If not, the first one
   * re-anchors capacity instead of scaling it (`pointsPerPersonDayForHeadcount`).
   */
  hasSavedHeadcount?: boolean;
  /** `null` on a defaults form, which asks "as a team" about "work items". */
  itemLabel: ItemLabel | null;
  /** The Estimate Field select's options, to name the field the estimates are read from. */
  estimateFieldOptions?: SelectableField[];
}

/**
 * The capacity questions, phrased in the team's own estimate unit. Every unit's answers come down to
 * one number, X (`pointsPerPersonDay`), which the headcount scales — see `shared/estimation.ts` and
 * spec/042-update-team-estimation-settings/plan.md. Story Points stores X (shown as points per
 * sprint); the team-time units derive it from their share of the team, so they never store it.
 */
const EstimationQuestions: FC<EstimationQuestionsProps> = ({
  mode,
  control,
  register,
  update,
  updateFields,
  setValue,
  savedUserData,
  toggleInheritance,
  hasSavedHeadcount = false,
  itemLabel,
  estimateFieldOptions = [],
}) => {
  // The form's default values are already the inherited ones, so an inherited unit drives the
  // questions just like a customized one.
  const values = useWatch({ control }) as Configuration;
  const unit = values.estimateUnit ?? DEFAULT_ESTIMATE_UNIT;
  const teamMembers = getTeamMembers(values);
  const pointsPerPersonDay = getPointsPerPersonDay(values);
  const peoplePerEstimate = getPeoplePerEstimate(values);

  const items = itemLabel ?? { singular: 'work item', plural: 'work items' };
  const estimateScope = itemLabel ? itemLabel.plural : 'as a team';

  /**
   * Saves fields in one write — two `update`s in a row would each spread the same saved snapshot, and
   * the second would drop the first — and shows them at once, which the global form needs: it never
   * resets from what was saved.
   */
  const write = (patch: Partial<Configuration>) => {
    for (const [name, value] of Object.entries(patch)) {
      setValue(name as keyof Configuration, value as never);
    }

    updateFields(patch);
  };

  /**
   * Adds the parallel count the patched answers imply (`getDefaultTracks`), when they imply one: the
   * unit, the people per estimate, the headcount. Story Points implies none, so tracks stay.
   */
  const withTracks = (patch: Partial<Configuration>) => {
    const tracks = getDefaultTracks({ ...values, ...patch });

    return tracks == null ? patch : { ...patch, tracks };
  };

  const share = values.estimateTeamShare ?? 'full';

  const saveUnit = (next: EstimateUnit) => {
    // A team-time unit's X comes from its share, so it saves the share and clears any stored X.
    write(
      withTracks(
        isTeamTimeUnit(next)
          ? { estimateUnit: next, estimateTeamShare: share, pointsPerPersonDay: null }
          : { estimateUnit: next, pointsPerPersonDay: pointsPerPersonDayForUnit(values, next) },
      ),
    );
  };

  const saveSprintLength = (days: number) => {
    if (!(days > 0)) return;

    // Story Points keeps its points per sprint; Team Sprints derives X from its share and the sprint.
    write({
      sprintLength: days,
      pointsPerPersonDay: unit === 'teamSprints' ? null : pointsPerPersonDayForSprintLength(values, days),
    });
  };

  const saveVelocity = (velocityPerSprint: number) => {
    write({
      pointsPerPersonDay: pointsPerPersonDayFor('storyPoints', {
        velocityPerSprint,
        teamMembers,
        sprintLength: values.sprintLength,
      }),
    });
  };

  const saveShare = (next: EstimateTeamShare) => {
    write(withTracks({ estimateTeamShare: next, pointsPerPersonDay: null }));
  };

  const saveHeadcount = (next: number) => {
    if (!Number.isFinite(next) || !(next > 0)) return;

    // Story Points' points per sprint follow the headcount, so a level inheriting them customizes them
    // too: it would otherwise read "inheriting" next to a number the inherited answer doesn't have.
    const customizesCapacity = mode !== 'global' && unit === 'storyPoints' && isCapacityInheriting;
    const anchored =
      pointsPerPersonDayForHeadcount(values, next, hasSavedHeadcount) ??
      (customizesCapacity ? pointsPerPersonDay : undefined);
    // A team-time unit's X follows its share of the saved team, so a stored one would pin it.
    const clearsStoredX = isTeamTimeUnit(unit) && savedUserData.pointsPerPersonDay != null;

    write(
      withTracks({
        teamMembers: next,
        ...(customizesCapacity && { estimateUnit: unit }),
        ...(anchored !== undefined && { pointsPerPersonDay: anchored }),
        ...(clearsStoredX && { pointsPerPersonDay: null }),
      }),
    );
  };

  const inheritance = (name: keyof Configuration) => ({
    // `== null` rather than falsy, matching how `sanitizeAllTeamData` decides what is saved.
    isInheriting: savedUserData[name] == null,
    onInheritanceChange: (shouldCustomize: boolean) => toggleInheritance?.(name, shouldCustomize),
  });

  /** The unit and the capacity expressed in it customize — and inherit — together. */
  const capacityInheritance =
    (name: 'estimateUnit' | 'pointsPerPersonDay' | 'estimateTeamShare') => (shouldCustomize: boolean) =>
      toggleInheritance?.(
        name,
        shouldCustomize,
        !shouldCustomize
          ? CAPACITY_FIELDS_CLEARED
          : isTeamTimeUnit(unit)
            ? { estimateUnit: unit, estimateTeamShare: share }
            : { estimateUnit: unit, pointsPerPersonDay },
      );

  const isCapacityInheriting = (Object.keys(CAPACITY_FIELDS_CLEARED) as Array<keyof Configuration>).every(
    (field) => savedUserData[field] == null,
  );

  const tracksField = (label: string) => {
    const props = { name: 'tracks' as const, label, type: 'number', min: 1, register, onSave: update };

    return mode === 'global' ? (
      <TextField {...props} />
    ) : (
      <InheritanceTextField {...inheritance('tracks')} control={control} {...props} />
    );
  };

  /**
   * Headcount and sprint length save more than themselves, computed from what they were before. A
   * registered input would already hold the typed value by blur time, so these commit on blur
   * instead and leave the form's values untouched until then.
   */
  const ownInheritance = (
    name: 'teamMembers' | 'sprintLength',
    inheritedValue: string,
    { onCustomize, onInherit }: { onCustomize?: Partial<Configuration>; onInherit?: AlsoWrite } = {},
  ) =>
    mode === 'global'
      ? undefined
      : {
          isInheriting: savedUserData[name] == null,
          onInheritanceChange: (shouldCustomize: boolean) =>
            toggleInheritance?.(name, shouldCustomize, shouldCustomize ? onCustomize : onInherit),
          inheritedValue,
        };

  /**
   * A Story Points sprint length returning to inheritance keeps points per sprint, as typing the
   * inherited length would (`saveSprintLength`) — when X is this level's own. An inherited X already
   * matches the inherited sprint length.
   */
  const keepVelocityOnInheritedSprint = (parent: Configuration): Partial<Configuration> =>
    unit === 'storyPoints' && savedUserData.pointsPerPersonDay != null && Number(parent.sprintLength) > 0
      ? { pointsPerPersonDay: pointsPerPersonDayForSprintLength(values, Number(parent.sprintLength)) }
      : {};

  // Customizing the headcount enters it, which re-anchors capacity like any first headcount.
  const anchoredOnCustomize = pointsPerPersonDayForHeadcount(values, teamMembers, hasSavedHeadcount);
  const sprintWeeksValue = values.sprintLength == null ? null : Number(values.sprintLength) / DAYS_PER_WEEK;

  const derivedInheritance = (inheritedValue: string) =>
    mode === 'global'
      ? undefined
      : {
          isInheriting: isCapacityInheriting,
          onInheritanceChange: capacityInheritance('pointsPerPersonDay'),
          inheritedValue,
        };

  const unitLabel = ESTIMATE_UNIT_OPTIONS.find((option) => option.value === unit)?.label.toLowerCase();
  // A name-colliding field is stored by id (spec/015-field-selection), so show the option's label.
  const estimateField =
    estimateFieldOptions.find((option) => option.value === values.estimateField)?.label ?? values.estimateField;

  const unestimated = describeUnestimated(values, items);

  const showsOverstaffWarning = unit === 'devDays' && Number(values.tracks) > teamMembers;

  const unitSelectProps = {
    name: 'estimateUnit' as const,
    label: `What units do you use to estimate ${estimateScope}?`,
    jiraFields: ESTIMATE_UNIT_OPTIONS,
    control,
    onSave: ({ value }: FieldUpdates<keyof Configuration>) => saveUnit(value as EstimateUnit),
  };

  const velocity = roundTo(getVelocityPerSprint(values), 2);
  const shareSelectProps = {
    name: 'estimateTeamShare' as const,
    label: 'How much of the team does one estimate assume?',
    jiraFields: ESTIMATE_TEAM_SHARE_OPTIONS,
    control,
    onSave: ({ value }: FieldUpdates<keyof Configuration>) => saveShare(value as EstimateTeamShare),
  };

  return (
    <>
      <SectionHeading>Estimate units</SectionHeading>
      {mode === 'global' ? (
        <Select {...unitSelectProps} />
      ) : (
        <InheritanceSelect
          {...unitSelectProps}
          isInheriting={savedUserData.estimateUnit == null}
          onInheritanceChange={capacityInheritance('estimateUnit')}
        />
      )}
      <div className="grid gap-0.5 text-xs text-slate-500">
        {/* The unit says what the estimate field's numbers mean; it does not convert them. Story points
            mean story points, so the sentence would only repeat the answer. */}
        {unit !== 'storyPoints' && (
          <p data-testid="unit-hint">
            The {estimateField ? <Em>{estimateField}</Em> : 'estimates'} your team puts on your <Em>{items.plural}</Em>{' '}
            represent <Em>{unitLabel}</Em>.
          </p>
        )}
        <p data-testid="unestimated-hint">
          <Em>{unestimated.items}</Em> without estimates default to <Em>{unestimated.period}</Em>.
        </p>
      </div>
      {usesSprintLength(unit) && (
        // Asked in weeks, stored in working days: the scheduler and every saved config read days.
        <DerivedNumberField
          name="sprintLength"
          label="How many weeks are in a sprint?"
          value={sprintWeeksValue}
          unit="weeks"
          onCommit={(weeks) => saveSprintLength(weeks * DAYS_PER_WEEK)}
          inheritance={ownInheritance(
            'sprintLength',
            sprintWeeksValue == null ? 'Not set' : plural(roundTo(sprintWeeksValue, 2), 'week', 'weeks'),
            { onInherit: keepVelocityOnInheritedSprint },
          )}
        />
      )}
      {isTeamTimeUnit(unit) && (
        <>
          {mode === 'global' ? (
            <Select {...shareSelectProps} />
          ) : (
            <InheritanceSelect
              {...shareSelectProps}
              isInheriting={isCapacityInheriting}
              onInheritanceChange={capacityInheritance('estimateTeamShare')}
            />
          )}
          {peoplePerEstimate != null && (
            <p className="text-xs text-slate-500" data-testid="people-share">
              {capitalize(SHARE_PHRASE[share])} of {plural(roundTo(teamMembers, 2), 'developer', 'developers')}:
              estimates assume <Em>{plural(roundTo(peoplePerEstimate, 2), 'person', 'people')}</Em>.
            </p>
          )}
        </>
      )}
      {unit === 'teamWeeks' && <p className="text-xs text-slate-500">One week is 5 working days.</p>}

      <SectionHeading>Team capacity</SectionHeading>
      <DerivedNumberField
        name="teamMembers"
        label="How many developers are on the team?"
        value={teamMembers}
        unit="developers"
        onCommit={saveHeadcount}
        inheritance={ownInheritance(
          'teamMembers',
          plural(roundTo(teamMembers, 2), 'developer', 'developers'),
          anchoredOnCustomize === undefined ? {} : { onCustomize: { pointsPerPersonDay: anchoredOnCustomize } },
        )}
      />
      {unit === 'storyPoints' && (
        <DerivedNumberField
          name="velocityPerSprint"
          label="On average, how many story points does your team complete per sprint?"
          value={velocity}
          unit="story points"
          onCommit={saveVelocity}
          inheritance={derivedInheritance(plural(velocity, 'story point', 'story points'))}
        />
      )}
      {tracksField(`How many ${items.plural} can your team work on in parallel, on average?`)}
      {showsOverstaffWarning && (
        <SectionMessage appearance="warning">
          Team members will need to split their time across multiple {items.plural}.
        </SectionMessage>
      )}

      <div className="mt-2 flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2">
        {/* `token('color.icon.information')` rendered black here, so the icon takes the text color. */}
        <span className="flex shrink-0 text-blue-500">
          <InformationIcon label="" color="currentColor" />
        </span>
        <p className="text-sm text-slate-700" data-testid="estimation-summary">
          {describeEstimation({ ...values, pointsPerPersonDay }, items, fieldLabelFor(estimateField))}
        </p>
      </div>
    </>
  );
};

export default EstimationQuestions;
