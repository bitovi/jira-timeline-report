import type { FC } from "react";

import type { NormalizedIssue } from "../../../jira/shared/types";
import type { NormalizeIssueConfig } from "../../../jira/normalized/normalize";
import type { SprintDefaults } from "./services/team-configuration";

import React from "react";
import { useForm } from "react-hook-form";
import Form, { FormHeader } from "@atlaskit/form";
import { useQueryClient } from "@tanstack/react-query";

import TextField from "./components/TextField";
import Select from "./components/Select";

import { createNormalizeConfiguration } from "./shared/normalize";
import {
  useGlobalTeamConfiguration,
  useSaveGlobalTeamConfiguration,
  teamConfigurationKeys,
} from "./services/team-configuration";
import { useJiraIssueFields } from "./services/jira";

export interface ConfigureTeamsProps {
  normalizedIssues?: Array<NormalizedIssue>;
  onInitialDefaultsLoad?: (overrides: Partial<NormalizeIssueConfig>) => void;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
}

export type DefaultFormFields = SprintDefaults;

export interface FieldUpdates<TProperty extends keyof DefaultFormFields> {
  name: TProperty;
  value: DefaultFormFields[TProperty];
}

const ConfigureTeams: FC<ConfigureTeamsProps> = ({ onUpdate, onInitialDefaultsLoad }) => {
  const queryClient = useQueryClient();

  const fieldValues = useGlobalTeamConfiguration({ onInitialDefaultsLoad });
  const save = useSaveGlobalTeamConfiguration();

  const jiraFields = useJiraIssueFields();
  const selectableFields = jiraFields.map(({ name }) => ({ value: name, label: name }));

  const { register, handleSubmit, getValues, control } = useForm<DefaultFormFields>({ defaultValues: fieldValues });

  function update<TProperty extends keyof DefaultFormFields>({ name, value }: FieldUpdates<TProperty>) {
    const values = getValues();

    save(
      { ...values, [name]: value },
      {
        onSuccess: () => {
          onUpdate?.(createNormalizeConfiguration(values));

          queryClient.invalidateQueries({ queryKey: teamConfigurationKeys.globalConfiguration() });
        },
      }
    );
  }

  return (
    <Form
      onSubmit={() =>
        handleSubmit((values) => {
          save(values, {
            onSuccess: () => {
              onUpdate?.(createNormalizeConfiguration(values));

              queryClient.invalidateQueries({ queryKey: teamConfigurationKeys.globalConfiguration() });
            },
          });
        })
      }
    >
      {() => (
        <form>
          <FormHeader title="Team Configuration" />
          <Select
            name="estimateField"
            label="Estimate Field"
            jiraFields={selectableFields}
            control={control}
            onSave={update}
          />
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
        </form>
      )}
    </Form>
  );
};

export default ConfigureTeams;
