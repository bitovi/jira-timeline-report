import type { FC } from "react";

import type { NormalizedIssue } from "../../../jira/shared/types";
import type { NormalizeIssueConfig } from "../../../jira/normalized/normalize";
import type { TeamConfiguration } from "./services/team-configuration";

import React, { useEffect } from "react";
import Form from "@atlaskit/form";
import { useForm } from "react-hook-form";
import { Flex } from "@atlaskit/primitives";

import TextField from "./components/TextField";
import Select from "./components/Select";
import Toggle from "./components/Toggle";
import Hr from "../../components/Hr";

import {
  addDefaultFormData,
  useGlobalTeamConfiguration,
  useSaveGlobalTeamConfiguration,
} from "./services/team-configuration";
import { useJiraIssueFields } from "./services/jira";
import { createNormalizeConfiguration } from "./shared/normalize";
// import EnableableTextField from "./components/EnableableTextField";

export interface ConfigureTeamsProps {
  normalizedIssues?: Array<NormalizedIssue>;
  onInitialDefaultsLoad?: (overrides: Partial<NormalizeIssueConfig>) => void;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
}

export type DefaultFormFields = TeamConfiguration;

export interface FieldUpdates<TProperty extends keyof DefaultFormFields> {
  name: TProperty;
  value: DefaultFormFields[TProperty];
}

const ConfigureTeams: FC<ConfigureTeamsProps> = ({ onUpdate, onInitialDefaultsLoad }) => {
  const fieldValues = useGlobalTeamConfiguration();
  const save = useSaveGlobalTeamConfiguration({ onUpdate });

  const jiraFields = useJiraIssueFields();
  const selectableFields = jiraFields.map(({ name }) => ({ value: name, label: name }));

  const { register, handleSubmit, getValues, control } = useForm<DefaultFormFields>({
    defaultValues: addDefaultFormData(jiraFields, fieldValues),
  });

  useOnMount(() => {
    onInitialDefaultsLoad?.(createNormalizeConfiguration(getValues()));
  });

  function update<TProperty extends keyof DefaultFormFields>({ name, value }: FieldUpdates<TProperty>) {
    const values = getValues();

    save({ ...values, [name]: value });
  }

  return (
    <Form
      onSubmit={() =>
        handleSubmit((values, event) => {
          event?.preventDefault();
          save(values);
        })
      }
    >
      {() => (
        <form>
          <Flex direction="column" gap="space.100">
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
              jiraFields={selectableFields}
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
              min={1}
              register={register}
              onSave={update}
            />
            <TextField
              name="velocityPerSprint"
              type="number"
              label="Velocity Per Sprint"
              min={1}
              register={register}
              onSave={update}
            />
            <TextField name="tracks" type="number" label="Tracks" min={1} register={register} onSave={update} />
            <Toggle label="Spread effort" description="Spread estimate access dates" />
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
        </form>
      )}
    </Form>
  );
};

export default ConfigureTeams;

// Temporary - don't use
const useOnMount = (effect: () => void) => {
  useEffect(() => {
    effect();
  }, []);
};
