import type { FC } from 'react';

import type { Configuration, IssueFields } from './services/team-configuration';
import type { NormalizeIssueConfig } from '../../../../../../jira/normalized/normalize';
import type { Control, UseFormReturn } from 'react-hook-form';

import React from 'react';
import { Flex } from '@atlaskit/primitives';

import Hr from '../../../../../components/Hr';

import InheritanceTextField from './components/InheritanceTextField';
import InheritanceToggleField from './components/InheritanceToggleField';
import InheritanceSelect from './components/InheritanceSelect';
import { RequiredAsterisk } from './components/Label';

export interface ConfigureTeamsFormProps {
  onInitialDefaultsLoad?: (overrides: Partial<NormalizeIssueConfig>) => void;
  savedUserData: Configuration;
  jiraFields: IssueFields;
  register: UseFormReturn<Configuration>['register'];
  control: Control<Configuration>;
  update: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
  toggleInheritance: (field: keyof Configuration, shouldCustomize: boolean) => void;
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
  toggleInheritance,
}) => {
  const selectableFields = jiraFields.map(({ name }) => ({ value: name, label: name }));

  return (
    <div className="py-2">
      <Flex direction="column" gap="space.100">
        <div className="flex gap-1">
          <RequiredAsterisk /> <p className="text-sm text-slate-300"> indicates a required field</p>
        </div>
        <InheritanceTextField
          isInheriting={!savedUserData.velocityPerSprint}
          onInheritanceChange={(shouldCustomize) => toggleInheritance('velocityPerSprint', shouldCustomize)}
          name="velocityPerSprint"
          type="number"
          label="Velocity per sprint"
          unit="estimating units"
          min={1}
          register={register}
          onSave={update}
        />
        <InheritanceTextField
          isInheriting={!savedUserData.tracks}
          onInheritanceChange={(shouldCustomize) => toggleInheritance('tracks', shouldCustomize)}
          name="tracks"
          type="number"
          label="Tracks"
          min={1}
          register={register}
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
        <InheritanceTextField
          isInheriting={!savedUserData.sprintLength}
          onInheritanceChange={(shouldCustomize) => toggleInheritance('sprintLength', shouldCustomize)}
          name="sprintLength"
          type="number"
          label="Sprint length"
          unit="business days"
          min={1}
          register={register}
          onSave={update}
        />
        <Hr />
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
      </Flex>
    </div>
  );
};

export default ConfigureTeamsForm;
