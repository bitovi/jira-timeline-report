import type { FC } from 'react';

import type { Configuration, IssueFields } from './services/team-configuration';

import React from 'react';
import { useForm } from 'react-hook-form';
import { Flex } from '@atlaskit/primitives';

import Select from './components/Select';
import { FormToggle } from './components/Toggle';
import { RequiredAsterisk } from './components/Label';
import { buildSelectableFields } from './shared/selectable-fields';
import EstimationQuestions from './components/EstimationQuestions';
import AdvancedSettings from './components/AdvancedSettings';

export interface AllTeamsDefaultFormProps {
  save: (newConfiguration: Configuration) => void;
  jiraFields: IssueFields;
  savedUserData: Configuration;
  inheritedData: Configuration;
}

export interface FieldUpdates<TProperty extends keyof Configuration> {
  name: TProperty;
  value: Configuration[TProperty];
}

const AllTeamsDefaultForm: FC<AllTeamsDefaultFormProps> = ({ save, savedUserData, inheritedData, jiraFields }) => {
  const selectableFields = buildSelectableFields(jiraFields);

  const { register, handleSubmit, control, setValue } = useForm<Configuration>({
    defaultValues: inheritedData,
  });

  function update<TProperty extends keyof Configuration>({ name, value }: FieldUpdates<TProperty>) {
    save({ ...savedUserData, [name]: value });
  }

  /** Several fields in one write: separate `update`s would each spread the same saved snapshot. */
  function updateFields(patch: Partial<Configuration>) {
    save({ ...savedUserData, ...patch });
  }

  return (
    <form
      className="py-2"
      onSubmit={handleSubmit((values, event) => {
        event?.preventDefault();

        save(values);
      })}
    >
      <Flex direction="column" gap="space.100">
        <span className="text-xs text-slate-500">
          <RequiredAsterisk /> indicates a required field
        </span>
        <EstimationQuestions
          mode="global"
          control={control}
          register={register}
          update={update}
          updateFields={updateFields}
          setValue={setValue}
          savedUserData={savedUserData}
          // The global defaults are the end of every chain.
          hasSavedHeadcount={savedUserData.teamMembers != null}
          itemLabel={null}
          estimateFieldOptions={selectableFields}
        />
        <AdvancedSettings>
          <Select
            name="estimateField"
            label="Estimate Field"
            jiraFields={selectableFields}
            control={control}
            onSave={update}
          />
          <Select
            name="confidenceField"
            label="Confidence field"
            optional
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
          <Select
            name="startDateField"
            label="Start date field"
            jiraFields={selectableFields}
            control={control}
            onSave={update}
          />
          <Select
            name="dueDateField"
            label="End date field"
            jiraFields={selectableFields}
            control={control}
            onSave={update}
          />
          <Select
            name="statusSummaryField"
            label="Status summary field"
            optional
            jiraFields={[
              {
                label: '',
                options: [{ value: 'status-summary-not-used', label: "Don't show a status summary" }],
              },
              { label: 'Fields', options: selectableFields },
            ]}
            control={control}
            onSave={update}
          />
          <FormToggle
            name="spreadEffortAcrossDates"
            control={control}
            onSave={update}
            label="Spread effort"
            description="Spread estimate across dates"
          />
        </AdvancedSettings>
        {/* <EnableableTextField
              toggleLabel="Estimates"
              toggleDescription="Assign average estimate to issues without estimates"
              textFieldLabel="Default estimate"
              message="Assign this value to issues without estimates"
              type="number"
              name="tracks"
              onSave={update}
              register={register}
            /> */}
      </Flex>
      <input type="submit" hidden />
    </form>
  );
};

export default AllTeamsDefaultForm;
