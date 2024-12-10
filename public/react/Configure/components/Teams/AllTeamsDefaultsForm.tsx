import type { FC } from "react";

import type { Configuration, IssueFields } from "./services/team-configuration";

import React from "react";
import { useForm } from "react-hook-form";
import { Flex } from "@atlaskit/primitives";

import TextField from "./components/TextField";
import Select from "./components/Select";
import Hr from "../../../components/Hr";
import { FormToggle } from "./components/Toggle";
import { RequiredAsterisk } from "./components/Label";

export interface AllTeamsDefaultFormProps {
  save: (newConfiguration: Configuration) => void;
  jiraFields: IssueFields;
  userData: Configuration;
  augmented: Configuration;
}

export interface FieldUpdates<TProperty extends keyof Configuration> {
  name: TProperty;
  value: Configuration[TProperty];
}

const AllTeamsDefaultForm: FC<AllTeamsDefaultFormProps> = ({
  save,
  userData,
  augmented,
  jiraFields,
}) => {
  const selectableFields = jiraFields.map(({ name }) => ({ value: name, label: name }));

  const { register, handleSubmit, control } = useForm<Configuration>({
    defaultValues: augmented,
  });

  function update<TProperty extends keyof Configuration>({ name, value }: FieldUpdates<TProperty>) {
    save({ ...userData, [name]: value });
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
        <div className="flex gap-1">
          <RequiredAsterisk /> <p className="text-sm text-slate-300"> indicates a required field</p>
        </div>
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
          jiraFields={[
            {
              label: "",
              options: [{ value: "confidence-not-used", label: "Don't use confidence" }],
            },
            { label: "Fields", options: selectableFields },
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
        <Hr />
        <TextField
          name="sprintLength"
          type="number"
          label="Sprint length"
          unit="business days"
          min={1}
          register={register}
          onSave={update}
        />
        <TextField
          name="velocityPerSprint"
          type="number"
          label="Velocity per sprint"
          unit="estimating units per sprint"
          min={1}
          register={register}
          onSave={update}
        />
        <TextField
          name="tracks"
          type="number"
          label="Tracks"
          min={1}
          register={register}
          onSave={update}
        />
        <FormToggle
          name="spreadEffortAcrossDates"
          control={control}
          onSave={update}
          label="Spread effort"
          description="Spread estimate across dates"
        />
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
