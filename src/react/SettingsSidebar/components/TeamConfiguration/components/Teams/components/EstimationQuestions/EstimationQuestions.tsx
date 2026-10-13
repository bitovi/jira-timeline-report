import type { FC, ReactNode } from 'react';
import type { Control, UseFormReturn } from 'react-hook-form';
import type { Configuration, EstimateTeamShare, EstimateUnit } from '../../services/team-configuration';
import type { FieldUpdates } from '../../ConfigureTeamsForm';
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
import {
  DAYS_PER_WEEK,
  DEFAULT_ESTIMATE_UNIT,
  describeEstimation,
  describeUnestimated,
  getDefaultTracks,
} from '../../shared/estimation';

export const ESTIMATE_UNIT_OPTIONS: Array<{ value: EstimateUnit; label: string }> = [
  { value: 'storyPoints', label: 'Story Points' },
  { value: 'devDays', label: 'Dev Days' },
  { value: 'teamDays', label: 'Team Working Days' },
  { value: 'teamWeeks', label: 'Team Weeks' },
  { value: 'teamSprints', label: 'Team Sprints' },
];

export const ESTIMATE_TEAM_SHARE_OPTIONS: Array<{ value: EstimateTeamShare; label: string }> = [
  { value: 'full', label: 'Full Team' },
  { value: 'half', label: 'Half Team' },
  { value: 'third', label: 'One Third Team' },
  { value: 'quarter', label: 'Quarter Team' },
];

const ASKS_SPRINT_LENGTH: EstimateUnit[] = ['storyPoints', 'teamSprints'];
const ASKS_TEAM_SHARE: EstimateUnit[] = ['teamDays', 'teamWeeks', 'teamSprints'];

type NumberField = 'sprintLength' | 'velocityPerSprint' | 'teamMembers' | 'tracks';
type SelectField = 'estimateUnit' | 'estimateTeamShare';

/** The parts of a hint that come from the team's answers. */
const Em: FC<{ children: ReactNode }> = ({ children }) => <span className="font-semibold">{children}</span>;

const SectionHeading: FC<{ children: string }> = ({ children }) => (
  <h4 className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
    {children}
    <span aria-hidden className="h-px flex-1 bg-slate-200" />
  </h4>
);

export interface EstimationQuestionsProps {
  /** `global` edits the global defaults directly; `inheriting` adds an inherit/customize toggle per field. */
  mode: 'global' | 'inheriting';
  control: Control<Configuration>;
  register: UseFormReturn<Configuration>['register'];
  update: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
  /** Saves several fields in one write — an answer plus the parallel count it implies. */
  updateFields: (patch: Partial<Configuration>) => void;
  setValue: UseFormReturn<Configuration>['setValue'];
  savedUserData: Configuration;
  toggleInheritance?: (field: keyof Configuration, shouldCustomize: boolean) => void;
  /** `null` on a defaults form, which asks "as a team" about "work items". */
  itemLabel: ItemLabel | null;
  /** The Estimate Field select's options, to name the field the estimates are read from. */
  estimateFieldOptions?: SelectableField[];
}

/**
 * The capacity questions, phrased in the team's own estimate unit. Every answer maps onto the three
 * numbers the scheduler already uses — see `shared/estimation.ts` and
 * spec/040-update-team-estimation-settings.
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
  itemLabel,
  estimateFieldOptions = [],
}) => {
  // The form's default values are already the inherited ones, so an inherited unit drives the
  // questions just like a customized one.
  const values = useWatch({ control }) as Configuration;
  const unit = values.estimateUnit ?? DEFAULT_ESTIMATE_UNIT;

  const items = itemLabel ?? { singular: 'work item', plural: 'work items' };
  const estimateScope = itemLabel ? itemLabel.plural : 'as a team';

  const inheritance = (name: keyof Configuration) => ({
    // `== null` rather than falsy, matching how `sanitizeAllTeamData` decides what is saved.
    isInheriting: savedUserData[name] == null,
    onInheritanceChange: (shouldCustomize: boolean) => toggleInheritance?.(name, shouldCustomize),
  });

  /**
   * Saves an answer, and with it the parallel count it implies (`getDefaultTracks`) when the answer
   * is one parallel follows for the resulting unit: the unit itself, the share for the team-time
   * units, the headcount for Dev Days. Both go in one write — two `update`s in a row would each
   * spread the same saved snapshot, and the second would drop the first.
   */
  const saveAnswer = <TProperty extends keyof Configuration>({ name, value }: FieldUpdates<TProperty>) => {
    const next = { ...values, [name]: value } as Configuration;
    const nextUnit = next.estimateUnit ?? DEFAULT_ESTIMATE_UNIT;
    const drivesTracks =
      name === 'estimateUnit' ||
      (name === 'estimateTeamShare' && ASKS_TEAM_SHARE.includes(nextUnit)) ||
      (name === 'teamMembers' && nextUnit === 'devDays');
    const tracks = drivesTracks ? getDefaultTracks(next) : null;

    if (tracks == null) {
      update({ name, value });
      return;
    }

    setValue('tracks', tracks);
    updateFields({ [name]: value, tracks });
  };

  const numberField = (name: NumberField, label: string, unitLabel?: string, scaleFactor?: number) => {
    const props = {
      name,
      label,
      unit: unitLabel,
      type: 'number',
      min: scaleFactor ? undefined : 1,
      register,
      onSave: name === 'teamMembers' ? saveAnswer : update,
      scale: scaleFactor ? { control, factor: scaleFactor } : undefined,
    };

    return mode === 'global' ? (
      <TextField {...props} />
    ) : (
      <InheritanceTextField {...inheritance(name)} control={control} {...props} />
    );
  };

  const selectField = (name: SelectField, label: string, options: Array<{ value: string; label: string }>) => {
    const props = { name, label, jiraFields: options, control, onSave: saveAnswer };

    return mode === 'global' ? <Select {...props} /> : <InheritanceSelect {...inheritance(name)} {...props} />;
  };

  const unitLabel = ESTIMATE_UNIT_OPTIONS.find((option) => option.value === unit)?.label.toLowerCase();
  // A name-colliding field is stored by id (spec/015-field-selection), so show the option's label.
  const estimateField =
    estimateFieldOptions.find((option) => option.value === values.estimateField)?.label ?? values.estimateField;

  const unestimated = describeUnestimated(values, items);

  const showsOverstaffWarning = unit === 'devDays' && Number(values.tracks) > Number(values.teamMembers);

  return (
    <>
      <SectionHeading>Estimate units</SectionHeading>
      {selectField('estimateUnit', `What units do you use to estimate ${estimateScope}?`, ESTIMATE_UNIT_OPTIONS)}
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
      {ASKS_SPRINT_LENGTH.includes(unit) &&
        // Asked in weeks, stored in working days: the scheduler and every saved config read days.
        numberField('sprintLength', 'How many weeks are in a sprint?', 'weeks', DAYS_PER_WEEK)}
      {ASKS_TEAM_SHARE.includes(unit) &&
        selectField(
          'estimateTeamShare',
          `When estimating, how much of the team do you assume will work on a single ${items.singular}?`,
          ESTIMATE_TEAM_SHARE_OPTIONS,
        )}
      {unit === 'teamWeeks' && <p className="text-xs text-slate-500">One week is 5 working days.</p>}

      <SectionHeading>Team capacity</SectionHeading>
      {unit === 'storyPoints' &&
        numberField(
          'velocityPerSprint',
          'On average, how many story points does your team complete per sprint?',
          'story points',
        )}
      {/* Asked for every unit, but only Dev Days turns it into capacity; the others ignore it. */}
      {numberField('teamMembers', 'How many full-time developers are working on your team?', 'developers')}
      {numberField('tracks', `How many ${items.plural} can your team work on in parallel, on average?`)}
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
          {describeEstimation(values, items)}
        </p>
      </div>
    </>
  );
};

export default EstimationQuestions;
