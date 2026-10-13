import type { FC } from 'react';

import type { Configuration, IssueFields } from './services/team-configuration';
import type { NormalizeIssueConfig } from '../../../../../../jira/normalized/normalize';
import type { Control, UseFormReturn } from 'react-hook-form';
import type { ItemLabel } from './shared/estimation';

import React from 'react';
import { Flex } from '@atlaskit/primitives';

import InheritanceToggleField from './components/InheritanceToggleField';
import InheritanceSelect from './components/InheritanceSelect';
import EstimationQuestions from './components/EstimationQuestions';
import AdvancedSettings from './components/AdvancedSettings';
import { RequiredAsterisk } from './components/Label';
import { buildSelectableFields } from './shared/selectable-fields';

export interface ConfigureTeamsFormProps {
  onInitialDefaultsLoad?: (overrides: Partial<NormalizeIssueConfig>) => void;
  savedUserData: Configuration;
  jiraFields: IssueFields;
  register: UseFormReturn<Configuration>['register'];
  control: Control<Configuration>;
  update: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
  updateFields: (patch: Partial<Configuration>) => void;
  setValue: UseFormReturn<Configuration>['setValue'];
  toggleInheritance: (field: keyof Configuration, shouldCustomize: boolean) => void;
  /** `null` on a team's defaults; the work item type's name on a per-type accordion. */
  itemLabel?: ItemLabel | null;
}

export interface FieldUpdates<TProperty extends keyof Configuration> {
  name: TProperty;
  value: Configuration[TProperty];
}

const ConfigureTeamsForm: FC<ConfigureTeamsFormProps> = ({
  savedUserData,
  jiraFields,
  register,
  control,
  update,
  updateFields,
  setValue,
  toggleInheritance,
  itemLabel = null,
}) => {
  const selectableFields = buildSelectableFields(jiraFields);

  return (
    <div className="py-2">
      <Flex direction="column" gap="space.100">
        <span className="text-xs text-slate-500">
          <RequiredAsterisk /> indicates a required field
        </span>
        <EstimationQuestions
          mode="inheriting"
          control={control}
          register={register}
          update={update}
          updateFields={updateFields}
          setValue={setValue}
          savedUserData={savedUserData}
          toggleInheritance={toggleInheritance}
          itemLabel={itemLabel}
          estimateFieldOptions={selectableFields}
        />
        <AdvancedSettings>
          <InheritanceSelect
            isInheriting={!savedUserData.estimateField}
            onInheritanceChange={(shouldCustomize) => toggleInheritance('estimateField', shouldCustomize)}
            name="estimateField"
            label="Estimate Field"
            jiraFields={selectableFields}
            control={control}
            onSave={update}
          />
          <InheritanceSelect
            optional
            isInheriting={!savedUserData.confidenceField}
            onInheritanceChange={(shouldCustomize) => toggleInheritance('confidenceField', shouldCustomize)}
            name="confidenceField"
            label="Confidence field"
            jiraFields={[
              {
                label: '',
                options: [{ value: 'confidence-not-used', label: "Don't use confidence" }],
              },
              { label: 'Fields', options: selectableFields },
            ]}
            control={control}
            onSave={update}
          />
          <InheritanceSelect
            isInheriting={!savedUserData.startDateField}
            onInheritanceChange={(shouldCustomize) => toggleInheritance('startDateField', shouldCustomize)}
            name="startDateField"
            label="Start date field"
            jiraFields={selectableFields}
            control={control}
            onSave={update}
          />
          <InheritanceSelect
            isInheriting={!savedUserData.dueDateField}
            onInheritanceChange={(shouldCustomize) => toggleInheritance('dueDateField', shouldCustomize)}
            name="dueDateField"
            label="End date field"
            jiraFields={selectableFields}
            control={control}
            onSave={update}
          />
          <InheritanceToggleField
            isInheriting={
              // Look for undefined and null but not false
              savedUserData.spreadEffortAcrossDates == null
            }
            onInheritanceChange={(shouldCustomize) => toggleInheritance('spreadEffortAcrossDates', shouldCustomize)}
            name="spreadEffortAcrossDates"
            control={control}
            onSave={update}
            label="Spread effort"
            description="Spread estimate across dates"
          />
        </AdvancedSettings>
      </Flex>
    </div>
  );
};

export default ConfigureTeamsForm;
