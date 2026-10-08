import type { FC } from 'react';
import type { Control, UseFormReturn } from 'react-hook-form';
import type { Configuration, EstimateTeamShare, EstimateUnit } from '../../services/team-configuration';
import type { FieldUpdates } from '../../ConfigureTeamsForm';
import type { ItemLabel } from '../../shared/estimation';
import type { SelectableField } from '../../shared/selectable-fields';

import React from 'react';
import { useWatch } from 'react-hook-form';
import Heading from '@atlaskit/heading';
import SectionMessage from '@atlaskit/section-message';
import InformationIcon from '@atlaskit/icon/core/information';
import { token } from '@atlaskit/tokens';

import TextField from '../TextField';
import Select from '../Select';
import InheritanceTextField from '../InheritanceTextField';
import InheritanceSelect from '../InheritanceSelect';
import { describeEstimation } from '../../shared/estimation';

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

export interface EstimationQuestionsProps {
  /** `global` edits the global defaults directly; `inheriting` adds an inherit/customize toggle per field. */
  mode: 'global' | 'inheriting';
  control: Control<Configuration>;
  register: UseFormReturn<Configuration>['register'];
  update: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
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
  savedUserData,
  toggleInheritance,
  itemLabel,
  estimateFieldOptions = [],
}) => {
  // The form's default values are already the inherited ones, so an inherited unit drives the
  // questions just like a customized one.
  const values = useWatch({ control }) as Configuration;
  const unit = values.estimateUnit ?? 'storyPoints';

  const items = itemLabel ?? { singular: 'work item', plural: 'work items' };
  const estimateScope = itemLabel ? itemLabel.plural : 'as a team';

  const inheritance = (name: keyof Configuration) => ({
    // `== null` rather than falsy, matching how `sanitizeAllTeamData` decides what is saved.
    isInheriting: savedUserData[name] == null,
    onInheritanceChange: (shouldCustomize: boolean) => toggleInheritance?.(name, shouldCustomize),
  });

  const numberField = (name: NumberField, label: string, unitLabel?: string) => {
    const props = { name, label, unit: unitLabel, type: 'number', min: 1, register, onSave: update };

    return mode === 'global' ? <TextField {...props} /> : <InheritanceTextField {...inheritance(name)} {...props} />;
  };

  const selectField = (name: SelectField, label: string, options: Array<{ value: string; label: string }>) => {
    const props = { name, label, jiraFields: options, control, onSave: update };

    return mode === 'global' ? <Select {...props} /> : <InheritanceSelect {...inheritance(name)} {...props} />;
  };

  // A name-colliding field is stored by id (spec/015-field-selection), so show the option's label.
  const estimateField =
    estimateFieldOptions.find((option) => option.value === values.estimateField)?.label ?? values.estimateField;

  const showsOverstaffWarning = unit === 'devDays' && Number(values.tracks) > Number(values.teamMembers);

  return (
    <>
      <div className="mt-2">
        <Heading size="xsmall">Estimate units</Heading>
      </div>
      {selectField('estimateUnit', `What units do you use to estimate ${estimateScope}?`, ESTIMATE_UNIT_OPTIONS)}
      {/* The unit says what the estimate field's numbers mean; it does not convert them. Naming the
          field here keeps a team from switching units while still reading a story points field. */}
      <p className="text-xs text-slate-500" data-testid="estimate-field-hint">
        {estimateField ? (
          <>
            Estimate field is currently set to <span className="font-semibold">{estimateField}</span>
          </>
        ) : (
          'Estimate field is not set'
        )}
      </p>
      {ASKS_SPRINT_LENGTH.includes(unit) &&
        numberField('sprintLength', 'How many working days are in a sprint?', 'working days')}
      {ASKS_TEAM_SHARE.includes(unit) &&
        selectField(
          'estimateTeamShare',
          `When estimating, how much of the team do you assume will work on a single ${items.singular}?`,
          ESTIMATE_TEAM_SHARE_OPTIONS,
        )}
      {unit === 'teamWeeks' && <p className="text-sm text-slate-500">One week is 5 working days.</p>}

      <div className="mt-2">
        <Heading size="xsmall">Team capacity</Heading>
      </div>
      {unit === 'storyPoints' &&
        numberField('velocityPerSprint', 'How many story points does your team complete per sprint?', 'story points')}
      {unit === 'devDays' &&
        numberField('teamMembers', 'How many full-time team members are working on your team?', 'members')}
      {numberField('tracks', `How many ${items.plural} can your team work on in parallel, on average?`)}
      {showsOverstaffWarning && (
        <SectionMessage appearance="warning">
          Team members will need to split their time across multiple {items.plural}.
        </SectionMessage>
      )}

      <div className="mt-2 flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2">
        <span className="shrink-0 pt-0.5">
          <InformationIcon label="" color={token('color.icon.information')} />
        </span>
        <p className="text-sm text-slate-700" data-testid="estimation-summary">
          {describeEstimation(values, items)}
        </p>
      </div>
    </>
  );
};

export default EstimationQuestions;
